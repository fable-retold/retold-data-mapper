/**
 * DataMapper - Connection Bridge Service
 *
 * REST endpoints for the mapping editor web UI. Every call that needs to
 * reach another beacon (source / target DataBeacons) is dispatched through
 * the Ultravisor mesh via fable-ultravisor-client — the web UI never talks
 * to foreign beacons directly.
 *
 * Endpoints live under options.RoutePrefix (default: /mapper).
 *
 * @author Steven Velozo <steven@velozo.com>
 * @license MIT
 */
const libFableServiceProviderBase = require('fable-serviceproviderbase');

const defaultConnectionBridgeOptions = (
	{
		RoutePrefix: '/mapper'
	});

class DataMapperConnectionBridge extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, defaultConnectionBridgeOptions, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		this.serviceType = 'DataMapperConnectionBridge';

		// Set by Retold-DataMapper.initializeService — needed so we can reach
		// the Ultravisor client that lives on the owner service.
		this._Owner = null;
	}

	setOwner(pOwnerService)
	{
		this._Owner = pOwnerService;
	}

	_client()
	{
		return this._Owner ? this._Owner.getUltravisorClient() : null;
	}

	_dispatch(pWorkItem, fCallback)
	{
		let tmpClient = this._client();
		if (!tmpClient)
		{
			return fCallback(new Error('Not connected to an Ultravisor'));
		}
		return tmpClient.dispatch(pWorkItem, fCallback);
	}

	_request(pMethod, pPath, pBody, fCallback)
	{
		let tmpClient = this._client();
		if (!tmpClient)
		{
			return fCallback(new Error('Not connected to an Ultravisor'));
		}
		return tmpClient.request(pMethod, pPath, pBody, fCallback);
	}

	_sendError(pResponse, pStatus, pMessage, fNext)
	{
		pResponse.send(pStatus || 500, { Error: pMessage });
		return fNext();
	}

	/**
	 * Extract a unique beacon name set from the Ultravisor action catalog.
	 * A beacon is anything providing DataBeaconAccess (excludes the mapper
	 * itself, which provides only DataMapperSource/Records/Transform).
	 */
	_extractBeaconsFromCatalog(pCapabilities)
	{
		let tmpCatalog = (pCapabilities && pCapabilities.ActionCatalog) || [];
		let tmpBeaconSet = {};

		for (let i = 0; i < tmpCatalog.length; i++)
		{
			let tmpAction = tmpCatalog[i];
			let tmpSourceBeacons = tmpAction.SourceBeacons || [];

			// Only include beacons that provide DataBeaconAccess.
			if (tmpAction.Capability !== 'DataBeaconAccess')
			{
				continue;
			}

			for (let b = 0; b < tmpSourceBeacons.length; b++)
			{
				let tmpID = tmpSourceBeacons[b];
				// BeaconIDs follow bcn-<name>-<timestamp>
				let tmpMatch = tmpID.match(/^bcn-(.+)-\d+$/);
				let tmpName = tmpMatch ? tmpMatch[1] : tmpID;
				if (!tmpBeaconSet[tmpName])
				{
					tmpBeaconSet[tmpName] = { Name: tmpName, BeaconID: tmpID };
				}
			}
		}

		return Object.keys(tmpBeaconSet).map((pName) => tmpBeaconSet[pName]);
	}

	connectRoutes(pOratorServiceServer)
	{
		let tmpRoutePrefix = this.options.RoutePrefix;

		// ── Ultravisor connection management ────────────────────

		pOratorServiceServer.doPost(`${tmpRoutePrefix}/ultravisor/connect`,
			(pRequest, pResponse, fNext) =>
			{
				let tmpBody = pRequest.body || {};
				if (!tmpBody.URL)
				{
					return this._sendError(pResponse, 400, 'URL is required', fNext);
				}
				if (!this._Owner)
				{
					return this._sendError(pResponse, 500, 'DataMapper owner not set', fNext);
				}

				this._Owner.connectUltravisor(
					tmpBody.URL,
					tmpBody.BeaconName || '',
					tmpBody.Password || '',
					(pError) =>
					{
						if (pError)
						{
							pResponse.send({ Success: false, Error: pError.message || String(pError), Status: 'Failed' });
							return fNext();
						}
						pResponse.send(Object.assign({ Success: true }, this._Owner.getUltravisorStatus()));
						return fNext();
					});
			});

		pOratorServiceServer.doPost(`${tmpRoutePrefix}/ultravisor/disconnect`,
			(pRequest, pResponse, fNext) =>
			{
				if (!this._Owner)
				{
					return this._sendError(pResponse, 500, 'DataMapper owner not set', fNext);
				}
				this._Owner.disconnectUltravisor((pError) =>
				{
					pResponse.send({ Success: !pError, Status: 'Disconnected' });
					return fNext();
				});
			});

		pOratorServiceServer.doGet(`${tmpRoutePrefix}/ultravisor/status`,
			(pRequest, pResponse, fNext) =>
			{
				if (!this._Owner)
				{
					pResponse.send({ Connected: false, Status: 'Unknown', URL: '' });
					return fNext();
				}
				pResponse.send(this._Owner.getUltravisorStatus());
				return fNext();
			});

		// ── Beacon discovery ────────────────────────────────────

		pOratorServiceServer.doGet(`${tmpRoutePrefix}/beacons`,
			(pRequest, pResponse, fNext) =>
			{
				let tmpClient = this._client();
				if (!tmpClient)
				{
					pResponse.send({ Beacons: [] });
					return fNext();
				}

				this._request('GET', '/Beacon/Capabilities', null,
					(pError, pResult) =>
					{
						if (pError)
						{
							return this._sendError(pResponse, 502, pError.message || String(pError), fNext);
						}
						let tmpBeacons = this._extractBeaconsFromCatalog(pResult);
						pResponse.send({ Count: tmpBeacons.length, Beacons: tmpBeacons });
						return fNext();
					});
			});

		// ── Beacon connections ──────────────────────────────────

		pOratorServiceServer.doGet(`${tmpRoutePrefix}/beacon/:name/connections`,
			(pRequest, pResponse, fNext) =>
			{
				let tmpName = pRequest.params.name;
				this._dispatch(
					{
						Capability: 'DataBeaconAccess',
						Action: 'ListConnections',
						Settings: {},
						AffinityKey: tmpName,
						TimeoutMs: 15000
					},
					(pError, pResult) =>
					{
						if (pError)
						{
							return this._sendError(pResponse, 502, pError.message || String(pError), fNext);
						}
						let tmpOutputs = (pResult && pResult.Outputs) || pResult || {};
						pResponse.send({ BeaconName: tmpName, Connections: tmpOutputs.Connections || [] });
						return fNext();
					});
			});

		// ── Introspection ───────────────────────────────────────

		pOratorServiceServer.doPost(`${tmpRoutePrefix}/beacon/:name/introspect`,
			(pRequest, pResponse, fNext) =>
			{
				let tmpName = pRequest.params.name;
				let tmpBody = pRequest.body || {};

				this._dispatch(
					{
						Capability: 'DataBeaconManagement',
						Action: 'Introspect',
						Settings: { IDBeaconConnection: tmpBody.IDBeaconConnection },
						AffinityKey: tmpName,
						TimeoutMs: 30000
					},
					(pError, pResult) =>
					{
						if (pError)
						{
							return this._sendError(pResponse, 502, pError.message || String(pError), fNext);
						}
						let tmpOutputs = (pResult && pResult.Outputs) || pResult || {};
						pResponse.send(
							{
								BeaconName: tmpName,
								Tables: tmpOutputs.Tables || [],
								ConnectionHash: tmpOutputs.ConnectionHash || ''
							});
						return fNext();
					});
			});

		// ── MappingConfig CRUD ──────────────────────────────────

		pOratorServiceServer.doGet(`${tmpRoutePrefix}/mappings`,
			(pRequest, pResponse, fNext) =>
			{
				if (!this.fable.DAL || !this.fable.DAL.MappingConfig)
				{
					pResponse.send({ Mappings: [] });
					return fNext();
				}
				let tmpQuery = this.fable.DAL.MappingConfig.query.clone().addFilter('Deleted', 0);
				this.fable.DAL.MappingConfig.doReads(tmpQuery,
					(pError, pQuery, pRecords) =>
					{
						if (pError)
						{
							return this._sendError(pResponse, 500, pError.message || String(pError), fNext);
						}
						pResponse.send({ Count: pRecords.length, Mappings: pRecords });
						return fNext();
					});
			});

		pOratorServiceServer.doPost(`${tmpRoutePrefix}/mappings`,
			(pRequest, pResponse, fNext) =>
			{
				if (!this.fable.DAL || !this.fable.DAL.MappingConfig)
				{
					return this._sendError(pResponse, 500, 'MappingConfig DAL not initialized', fNext);
				}
				let tmpBody = pRequest.body || {};
				let tmpRecord =
				{
					Name: tmpBody.Name || 'Untitled Mapping',
					Description: tmpBody.Description || '',
					SourceBeaconName: tmpBody.SourceBeaconName || '',
					SourceConnectionHash: tmpBody.SourceConnectionHash || '',
					SourceEntity: tmpBody.SourceEntity || '',
					TargetBeaconName: tmpBody.TargetBeaconName || '',
					TargetConnectionHash: tmpBody.TargetConnectionHash || '',
					TargetEntity: tmpBody.TargetEntity || '',
					MappingConfiguration: (typeof tmpBody.MappingConfiguration === 'string')
						? tmpBody.MappingConfiguration
						: JSON.stringify(tmpBody.MappingConfiguration || {}),
					FlowDiagramState: (typeof tmpBody.FlowDiagramState === 'string')
						? tmpBody.FlowDiagramState
						: JSON.stringify(tmpBody.FlowDiagramState || {})
				};

				let tmpQuery = this.fable.DAL.MappingConfig.query.clone()
					.setIDUser(0)
					.addRecord(tmpRecord);

				this.fable.DAL.MappingConfig.doCreate(tmpQuery,
					(pError, pQuery, pQueryRead, pRecord) =>
					{
						if (pError)
						{
							return this._sendError(pResponse, 500, pError.message || String(pError), fNext);
						}
						pResponse.send({ Success: true, Mapping: pRecord });
						return fNext();
					});
			});

		pOratorServiceServer.doGet(`${tmpRoutePrefix}/mapping/:id`,
			(pRequest, pResponse, fNext) =>
			{
				if (!this.fable.DAL || !this.fable.DAL.MappingConfig)
				{
					return this._sendError(pResponse, 500, 'MappingConfig DAL not initialized', fNext);
				}
				let tmpID = parseInt(pRequest.params.id, 10);
				let tmpQuery = this.fable.DAL.MappingConfig.query.clone()
					.addFilter('IDMappingConfig', tmpID);
				this.fable.DAL.MappingConfig.doRead(tmpQuery,
					(pError, pQuery, pRecord) =>
					{
						if (pError || !pRecord || !pRecord.IDMappingConfig)
						{
							return this._sendError(pResponse, 404, 'Mapping not found', fNext);
						}
						pResponse.send({ Mapping: pRecord });
						return fNext();
					});
			});

		pOratorServiceServer.doPut(`${tmpRoutePrefix}/mapping/:id`,
			(pRequest, pResponse, fNext) =>
			{
				if (!this.fable.DAL || !this.fable.DAL.MappingConfig)
				{
					return this._sendError(pResponse, 500, 'MappingConfig DAL not initialized', fNext);
				}
				let tmpID = parseInt(pRequest.params.id, 10);
				let tmpBody = pRequest.body || {};

				let tmpReadQuery = this.fable.DAL.MappingConfig.query.clone()
					.addFilter('IDMappingConfig', tmpID);

				this.fable.DAL.MappingConfig.doRead(tmpReadQuery,
					(pReadError, pReadQuery, pExisting) =>
					{
						if (pReadError || !pExisting || !pExisting.IDMappingConfig)
						{
							return this._sendError(pResponse, 404, 'Mapping not found', fNext);
						}

						let tmpFields =
						[
							'Name', 'Description',
							'SourceBeaconName', 'SourceConnectionHash', 'SourceEntity',
							'TargetBeaconName', 'TargetConnectionHash', 'TargetEntity'
						];
						for (let i = 0; i < tmpFields.length; i++)
						{
							if (tmpBody[tmpFields[i]] !== undefined)
							{
								pExisting[tmpFields[i]] = tmpBody[tmpFields[i]];
							}
						}
						if (tmpBody.MappingConfiguration !== undefined)
						{
							pExisting.MappingConfiguration = (typeof tmpBody.MappingConfiguration === 'string')
								? tmpBody.MappingConfiguration
								: JSON.stringify(tmpBody.MappingConfiguration);
						}
						if (tmpBody.FlowDiagramState !== undefined)
						{
							pExisting.FlowDiagramState = (typeof tmpBody.FlowDiagramState === 'string')
								? tmpBody.FlowDiagramState
								: JSON.stringify(tmpBody.FlowDiagramState);
						}

						let tmpUpdateQuery = this.fable.DAL.MappingConfig.query.clone()
							.addRecord(pExisting);
						this.fable.DAL.MappingConfig.doUpdate(tmpUpdateQuery,
							(pError, pQuery, pQueryRead, pRecord) =>
							{
								if (pError)
								{
									return this._sendError(pResponse, 500, pError.message || String(pError), fNext);
								}
								pResponse.send({ Success: true, Mapping: pRecord });
								return fNext();
							});
					});
			});

		pOratorServiceServer.doDel(`${tmpRoutePrefix}/mapping/:id`,
			(pRequest, pResponse, fNext) =>
			{
				if (!this.fable.DAL || !this.fable.DAL.MappingConfig)
				{
					return this._sendError(pResponse, 500, 'MappingConfig DAL not initialized', fNext);
				}
				let tmpID = parseInt(pRequest.params.id, 10);
				let tmpQuery = this.fable.DAL.MappingConfig.query.clone()
					.addFilter('IDMappingConfig', tmpID);
				this.fable.DAL.MappingConfig.doDelete(tmpQuery,
					(pError) =>
					{
						if (pError)
						{
							return this._sendError(pResponse, 500, pError.message || String(pError), fNext);
						}
						pResponse.send({ Success: true });
						return fNext();
					});
			});

		// ── OperationTemplate CRUD ──────────────────────────────

		pOratorServiceServer.doGet(`${tmpRoutePrefix}/operations`,
			(pRequest, pResponse, fNext) =>
			{
				if (!this.fable.DAL || !this.fable.DAL.OperationTemplate)
				{
					pResponse.send({ Operations: [] });
					return fNext();
				}
				let tmpQuery = this.fable.DAL.OperationTemplate.query.clone().addFilter('Deleted', 0);
				this.fable.DAL.OperationTemplate.doReads(tmpQuery,
					(pError, pQuery, pRecords) =>
					{
						if (pError)
						{
							return this._sendError(pResponse, 500, pError.message || String(pError), fNext);
						}
						pResponse.send({ Count: pRecords.length, Operations: pRecords });
						return fNext();
					});
			});

		pOratorServiceServer.doPost(`${tmpRoutePrefix}/operations`,
			(pRequest, pResponse, fNext) =>
			{
				if (!this.fable.DAL || !this.fable.DAL.OperationTemplate)
				{
					return this._sendError(pResponse, 500, 'OperationTemplate DAL not initialized', fNext);
				}
				let tmpBody = pRequest.body || {};
				let tmpRecord =
				{
					Name: tmpBody.Name || 'Untitled Operation',
					Description: tmpBody.Description || '',
					OperationHash: tmpBody.OperationHash || '',
					OperationJSON: (typeof tmpBody.OperationJSON === 'string')
						? tmpBody.OperationJSON
						: JSON.stringify(tmpBody.OperationJSON || tmpBody.Operation || {})
				};

				let tmpQuery = this.fable.DAL.OperationTemplate.query.clone()
					.setIDUser(0)
					.addRecord(tmpRecord);
				this.fable.DAL.OperationTemplate.doCreate(tmpQuery,
					(pError, pQuery, pQueryRead, pRecord) =>
					{
						if (pError)
						{
							return this._sendError(pResponse, 500, pError.message || String(pError), fNext);
						}
						pResponse.send({ Success: true, Operation: pRecord });
						return fNext();
					});
			});

		// Run an operation on the Ultravisor (by hash)
		pOratorServiceServer.doPost(`${tmpRoutePrefix}/operation/:hash/run`,
			(pRequest, pResponse, fNext) =>
			{
				let tmpHash = pRequest.params.hash;
				let tmpClient = this._client();
				if (!tmpClient)
				{
					return this._sendError(pResponse, 503, 'Not connected to an Ultravisor', fNext);
				}
				tmpClient.request('POST', `/Operation/${tmpHash}/Trigger`, null,
					(pError, pResult) =>
					{
						if (pError)
						{
							return this._sendError(pResponse, 502, pError.message || String(pError), fNext);
						}
						pResponse.send(pResult || { Success: true });
						return fNext();
					});
			});

		pOratorServiceServer.doGet(`${tmpRoutePrefix}/operation/:hash/status`,
			(pRequest, pResponse, fNext) =>
			{
				let tmpHash = pRequest.params.hash;
				let tmpClient = this._client();
				if (!tmpClient)
				{
					return this._sendError(pResponse, 503, 'Not connected to an Ultravisor', fNext);
				}
				tmpClient.request('GET', `/Operation/${tmpHash}`, null,
					(pError, pResult) =>
					{
						if (pError)
						{
							return this._sendError(pResponse, 502, pError.message || String(pError), fNext);
						}
						pResponse.send(pResult || {});
						return fNext();
					});
			});

		this.fable.log.info(`DataMapper ConnectionBridge routes connected at ${tmpRoutePrefix}/*`);
	}
}

module.exports = DataMapperConnectionBridge;
module.exports.serviceType = 'DataMapperConnectionBridge';
module.exports.default_configuration = defaultConnectionBridgeOptions;
