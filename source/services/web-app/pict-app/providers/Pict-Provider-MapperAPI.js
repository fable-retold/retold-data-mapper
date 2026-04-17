/**
 * Retold DataMapper — API Provider
 *
 * Calls the DataMapper's own REST API at /mapper/* and stores results in
 * AppData. The server-side dispatches foreign-beacon calls through the
 * Ultravisor mesh, so this provider never has to know about mesh routing.
 */
const libPictProvider = require('pict-view');

class MapperAPIProvider extends libPictProvider
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
		this.serviceType = 'MapperAPIProvider';
	}

	_apiCall(pMethod, pPath, pBody, fCallback)
	{
		let tmpOptions =
			{
				method: pMethod,
				headers: { 'Content-Type': 'application/json' }
			};

		if (pBody && pMethod !== 'GET')
		{
			tmpOptions.body = JSON.stringify(pBody);
		}

		fetch(pPath, tmpOptions)
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				if (fCallback) fCallback(null, pData);
			})
			.catch((pError) =>
			{
				if (fCallback) fCallback(pError);
			});
	}

	// ── Ultravisor ──────────────────────────────────────────

	loadUltravisorStatus(fCallback)
	{
		this._apiCall('GET', '/mapper/ultravisor/status', null,
			(pError, pData) =>
			{
				if (!pError && pData)
				{
					this._applyUltravisorStatus(pData);
				}
				this._renderLayout();
				if (fCallback) fCallback(pError, pData);
			});
	}

	connectUltravisor(pURL, pBeaconName, fCallback)
	{
		this._apiCall('POST', '/mapper/ultravisor/connect',
			{ URL: pURL, BeaconName: pBeaconName || 'retold-data-mapper' },
			(pError, pData) =>
			{
				if (!pError && pData)
				{
					this._applyUltravisorStatus(pData);
				}
				this._renderLayout();
				if (!pError && pData && pData.Success)
				{
					this.loadBeacons();
				}
				if (fCallback) fCallback(pError, pData);
			});
	}

	disconnectUltravisor(fCallback)
	{
		this._apiCall('POST', '/mapper/ultravisor/disconnect', null,
			(pError, pData) =>
			{
				this.pict.AppData.Mapper.UltravisorStatus = 'Disconnected';
				this.pict.AppData.Mapper.UltravisorStatusLabel = 'Disconnected';
				this.pict.AppData.Mapper.UltravisorBadgeClass = 'badge-neutral';
				this.pict.AppData.Mapper.Beacons = [];
				this.pict.AppData.Mapper.SourceBeacons = [];
				this.pict.AppData.Mapper.TargetBeacons = [];
				this._renderLayout();
				this._renderBeaconBrowser();
				if (fCallback) fCallback(pError, pData);
			});
	}

	_applyUltravisorStatus(pData)
	{
		let tmpStatus = pData.Status || (pData.Connected ? 'Connected' : 'Disconnected');
		let tmpLabel = tmpStatus;
		let tmpBadge = 'badge-neutral';
		if (pData.Connected) { tmpBadge = 'badge-success'; }
		else if (tmpStatus === 'Failed') { tmpBadge = 'badge-error'; }

		this.pict.AppData.Mapper.UltravisorStatus = tmpStatus;
		this.pict.AppData.Mapper.UltravisorStatusLabel = tmpLabel;
		this.pict.AppData.Mapper.UltravisorBadgeClass = tmpBadge;
		this.pict.AppData.Mapper.UltravisorURL = pData.URL || this.pict.AppData.Mapper.UltravisorURL;
	}

	// ── Beacons ─────────────────────────────────────────────

	loadBeacons(fCallback)
	{
		this._apiCall('GET', '/mapper/beacons', null,
			(pError, pData) =>
			{
				if (!pError && pData)
				{
					this.pict.AppData.Mapper.Beacons = pData.Beacons || [];
					this._recomputeBeaconOptions();
				}
				this._renderBeaconBrowser();
				if (fCallback) fCallback(pError, pData);
			});
	}

	loadSourceConnections(pBeaconName, fCallback)
	{
		this.pict.AppData.Mapper.SourceBeaconName = pBeaconName;
		this.pict.AppData.Mapper.SourceConnections = [];
		this.pict.AppData.Mapper.SourceConnectionID = null;
		this.pict.AppData.Mapper.SourceConnectionHash = '';
		this.pict.AppData.Mapper.SourceEntities = [];
		this.pict.AppData.Mapper.SourceEntity = '';
		this.pict.AppData.Mapper.SourceFields = [];

		if (!pBeaconName)
		{
			this._recomputeBeaconOptions();
			this._renderBeaconBrowser();
			this._renderFieldMapper();
			if (fCallback) fCallback();
			return;
		}

		this._apiCall('GET', `/mapper/beacon/${encodeURIComponent(pBeaconName)}/connections`, null,
			(pError, pData) =>
			{
				if (!pError && pData)
				{
					this.pict.AppData.Mapper.SourceConnections = pData.Connections || [];
				}
				this._recomputeBeaconOptions();
				this._renderBeaconBrowser();
				this._renderFieldMapper();
				if (fCallback) fCallback(pError, pData);
			});
	}

	loadTargetConnections(pBeaconName, fCallback)
	{
		this.pict.AppData.Mapper.TargetBeaconName = pBeaconName;
		this.pict.AppData.Mapper.TargetConnections = [];
		this.pict.AppData.Mapper.TargetConnectionID = null;
		this.pict.AppData.Mapper.TargetConnectionHash = '';
		this.pict.AppData.Mapper.TargetEntities = [];
		this.pict.AppData.Mapper.TargetEntity = '';
		this.pict.AppData.Mapper.TargetFields = [];

		if (!pBeaconName)
		{
			this._recomputeBeaconOptions();
			this._renderBeaconBrowser();
			this._renderFieldMapper();
			if (fCallback) fCallback();
			return;
		}

		this._apiCall('GET', `/mapper/beacon/${encodeURIComponent(pBeaconName)}/connections`, null,
			(pError, pData) =>
			{
				if (!pError && pData)
				{
					this.pict.AppData.Mapper.TargetConnections = pData.Connections || [];
				}
				this._recomputeBeaconOptions();
				this._renderBeaconBrowser();
				this._renderFieldMapper();
				if (fCallback) fCallback(pError, pData);
			});
	}

	introspectSource(pIDBeaconConnection, fCallback)
	{
		let tmpBeaconName = this.pict.AppData.Mapper.SourceBeaconName;
		if (!tmpBeaconName || !pIDBeaconConnection) { if (fCallback) fCallback(new Error('beacon + id required')); return; }

		this.pict.AppData.Mapper.SourceConnectionID = pIDBeaconConnection;
		let tmpConn = this._findConnection(this.pict.AppData.Mapper.SourceConnections, pIDBeaconConnection);
		this.pict.AppData.Mapper.SourceConnectionHash = this._slugify(tmpConn ? tmpConn.Name : '');

		this._apiCall('POST', `/mapper/beacon/${encodeURIComponent(tmpBeaconName)}/introspect`,
			{ IDBeaconConnection: pIDBeaconConnection },
			(pError, pData) =>
			{
				if (!pError && pData)
				{
					this.pict.AppData.Mapper.SourceEntities = pData.Tables || [];
					if (pData.ConnectionHash) { this.pict.AppData.Mapper.SourceConnectionHash = pData.ConnectionHash; }
				}
				this._recomputeBeaconOptions();
				this._renderBeaconBrowser();
				if (fCallback) fCallback(pError, pData);
			});
	}

	introspectTarget(pIDBeaconConnection, fCallback)
	{
		let tmpBeaconName = this.pict.AppData.Mapper.TargetBeaconName;
		if (!tmpBeaconName || !pIDBeaconConnection) { if (fCallback) fCallback(new Error('beacon + id required')); return; }

		this.pict.AppData.Mapper.TargetConnectionID = pIDBeaconConnection;
		let tmpConn = this._findConnection(this.pict.AppData.Mapper.TargetConnections, pIDBeaconConnection);
		this.pict.AppData.Mapper.TargetConnectionHash = this._slugify(tmpConn ? tmpConn.Name : '');

		this._apiCall('POST', `/mapper/beacon/${encodeURIComponent(tmpBeaconName)}/introspect`,
			{ IDBeaconConnection: pIDBeaconConnection },
			(pError, pData) =>
			{
				if (!pError && pData)
				{
					this.pict.AppData.Mapper.TargetEntities = pData.Tables || [];
					if (pData.ConnectionHash) { this.pict.AppData.Mapper.TargetConnectionHash = pData.ConnectionHash; }
				}
				this._recomputeBeaconOptions();
				this._renderBeaconBrowser();
				if (fCallback) fCallback(pError, pData);
			});
	}

	setSourceEntity(pEntityName)
	{
		this.pict.AppData.Mapper.SourceEntity = pEntityName;
		let tmpEntity = this._findEntity(this.pict.AppData.Mapper.SourceEntities, pEntityName);
		this.pict.AppData.Mapper.SourceFields = this._extractFields(tmpEntity);
		this._recomputeBeaconOptions();
		this._renderBeaconBrowser();
		this._renderFieldMapper();
	}

	setTargetEntity(pEntityName)
	{
		this.pict.AppData.Mapper.TargetEntity = pEntityName;
		let tmpEntity = this._findEntity(this.pict.AppData.Mapper.TargetEntities, pEntityName);
		this.pict.AppData.Mapper.TargetFields = this._extractFields(tmpEntity);
		this._recomputeBeaconOptions();
		this._renderBeaconBrowser();
		this._renderFieldMapper();
	}

	// ── Mappings ────────────────────────────────────────────

	selectSourceField(pFieldName)
	{
		let tmpCurrent = this.pict.AppData.Mapper.SelectedSourceField;
		this.pict.AppData.Mapper.SelectedSourceField = (tmpCurrent === pFieldName) ? '' : pFieldName;
		this._renderFieldMapper();
	}

	addMapping(pSource, pTarget)
	{
		if (!pSource || !pTarget) { return; }

		let tmpMappings = this.pict.AppData.Mapper.Mappings || [];
		tmpMappings = tmpMappings.filter((pM) => pM.Target !== pTarget);
		tmpMappings.push({ Source: pSource, Target: pTarget });
		this.pict.AppData.Mapper.Mappings = tmpMappings;
		this.pict.AppData.Mapper.SelectedSourceField = '';
		this._regenerateJSON();
		this._renderFieldMapper();
	}

	removeMapping(pIndex)
	{
		let tmpMappings = this.pict.AppData.Mapper.Mappings || [];
		tmpMappings.splice(pIndex, 1);
		this.pict.AppData.Mapper.Mappings = tmpMappings;
		this._regenerateJSON();
		this._renderFieldMapper();
	}

	clearMappings()
	{
		this.pict.AppData.Mapper.Mappings = [];
		this.pict.AppData.Mapper.SelectedSourceField = '';
		this._regenerateJSON();
		this._renderFieldMapper();
	}

	// ── Saved MappingConfigs (CRUD against our own SQLite) ──

	loadSavedMappings(fCallback)
	{
		this._apiCall('GET', '/mapper/mappings', null,
			(pError, pData) =>
			{
				if (!pError && pData)
				{
					this.pict.AppData.Mapper.SavedMappings = pData.Mappings || [];
				}
				this._renderMappingList();
				if (fCallback) fCallback(pError, pData);
			});
	}

	saveMapping(fCallback)
	{
		let tmpState = this.pict.AppData.Mapper;
		let tmpConfig = this._buildMappingConfiguration();
		let tmpBody =
			{
				Name: tmpState.TargetEntity
					? `${tmpState.SourceEntity || 'source'} → ${tmpState.TargetEntity}`
					: 'Untitled Mapping',
				Description: '',
				SourceBeaconName: tmpState.SourceBeaconName,
				SourceConnectionHash: tmpState.SourceConnectionHash,
				SourceEntity: tmpState.SourceEntity,
				TargetBeaconName: tmpState.TargetBeaconName,
				TargetConnectionHash: tmpState.TargetConnectionHash,
				TargetEntity: tmpState.TargetEntity,
				MappingConfiguration: tmpConfig,
				FlowDiagramState: {}
			};

		this._apiCall('POST', '/mapper/mappings', tmpBody,
			(pError, pData) =>
			{
				if (!pError && pData && pData.Success)
				{
					this.pict.AppData.Mapper.StatusMessage = 'Mapping saved.';
					this.loadSavedMappings();
				}
				else
				{
					this.pict.AppData.Mapper.StatusMessage = 'Save failed.';
				}
				this._renderLayout();
				if (fCallback) fCallback(pError, pData);
			});
	}

	deleteSavedMapping(pID, fCallback)
	{
		this._apiCall('DELETE', `/mapper/mapping/${pID}`, null,
			(pError, pData) =>
			{
				if (!pError) { this.loadSavedMappings(); }
				if (fCallback) fCallback(pError, pData);
			});
	}

	loadSavedMapping(pID, fCallback)
	{
		this._apiCall('GET', `/mapper/mapping/${pID}`, null,
			(pError, pData) =>
			{
				if (!pError && pData && pData.Mapping)
				{
					this._applySavedMapping(pData.Mapping);
				}
				if (fCallback) fCallback(pError, pData);
			});
	}

	_applySavedMapping(pRecord)
	{
		let tmpState = this.pict.AppData.Mapper;
		tmpState.SourceBeaconName = pRecord.SourceBeaconName || '';
		tmpState.SourceConnectionHash = pRecord.SourceConnectionHash || '';
		tmpState.SourceEntity = pRecord.SourceEntity || '';
		tmpState.TargetBeaconName = pRecord.TargetBeaconName || '';
		tmpState.TargetConnectionHash = pRecord.TargetConnectionHash || '';
		tmpState.TargetEntity = pRecord.TargetEntity || '';

		let tmpConfig = {};
		try { tmpConfig = JSON.parse(pRecord.MappingConfiguration || '{}'); } catch (e) { /* ignore */ }

		tmpState.Mappings = this._mappingsFromConfig(tmpConfig);
		tmpState.JSONText = JSON.stringify(tmpConfig, null, '\t');
		tmpState.StatusMessage = `Loaded "${pRecord.Name}".`;
		tmpState.ActivePanel = 'mapper';

		// If source/target fields aren't loaded, derive placeholders from mappings
		if (tmpState.SourceFields.length === 0)
		{
			let tmpSet = {};
			tmpState.Mappings.forEach((pM) => { if (pM.Source) tmpSet[pM.Source] = true; });
			tmpState.SourceFields = Object.keys(tmpSet).map((pN) => ({ Name: pN, Type: '' }));
		}
		if (tmpState.TargetFields.length === 0)
		{
			let tmpSet = {};
			tmpState.Mappings.forEach((pM) => { if (pM.Target) tmpSet[pM.Target] = true; });
			tmpState.TargetFields = Object.keys(tmpSet).map((pN) => ({ Name: pN, Type: '' }));
		}

		this._recomputeBeaconOptions();
		this._renderLayout();
		this._renderBeaconBrowser();
		this._renderFieldMapper();
		this._renderJSONEditor();
	}

	// ── JSON editor sync ────────────────────────────────────

	applyJSONText(pText)
	{
		let tmpParsed;
		try { tmpParsed = JSON.parse(pText); }
		catch (e)
		{
			this.pict.AppData.Mapper.StatusMessage = `Invalid JSON: ${e.message}`;
			this._renderLayout();
			return false;
		}

		if (!tmpParsed || !tmpParsed.Mappings)
		{
			this.pict.AppData.Mapper.StatusMessage = 'JSON must contain a "Mappings" object.';
			this._renderLayout();
			return false;
		}

		this.pict.AppData.Mapper.JSONText = JSON.stringify(tmpParsed, null, '\t');
		this.pict.AppData.Mapper.Mappings = this._mappingsFromConfig(tmpParsed);
		if (tmpParsed.Entity) { this.pict.AppData.Mapper.TargetEntity = tmpParsed.Entity; }

		if (tmpParsed._meta)
		{
			if (tmpParsed._meta.SourceBeacon) this.pict.AppData.Mapper.SourceBeaconName = tmpParsed._meta.SourceBeacon;
			if (tmpParsed._meta.SourceConnectionHash) this.pict.AppData.Mapper.SourceConnectionHash = tmpParsed._meta.SourceConnectionHash;
			if (tmpParsed._meta.TargetBeacon) this.pict.AppData.Mapper.TargetBeaconName = tmpParsed._meta.TargetBeacon;
			if (tmpParsed._meta.TargetConnectionHash) this.pict.AppData.Mapper.TargetConnectionHash = tmpParsed._meta.TargetConnectionHash;
		}

		this.pict.AppData.Mapper.StatusMessage = `Imported ${this.pict.AppData.Mapper.Mappings.length} mappings.`;
		this._renderLayout();
		this._renderBeaconBrowser();
		this._renderFieldMapper();
		return true;
	}

	// ── Helpers ─────────────────────────────────────────────

	_buildMappingConfiguration()
	{
		let tmpState = this.pict.AppData.Mapper;
		let tmpMappings = {};
		(tmpState.Mappings || []).forEach((pM) =>
		{
			tmpMappings[pM.Target] = '{~D:Record.' + pM.Source + '~}';
		});

		let tmpEntity = tmpState.TargetEntity || 'TargetEntity';

		return {
			Entity: tmpEntity,
			GUIDTemplate: '',
			GUIDName: 'GUID' + tmpEntity,
			Mappings: tmpMappings,
			Solvers: [],
			_meta:
				{
					SourceBeacon: tmpState.SourceBeaconName,
					SourceConnectionHash: tmpState.SourceConnectionHash,
					SourceEntity: tmpState.SourceEntity,
					TargetBeacon: tmpState.TargetBeaconName,
					TargetConnectionHash: tmpState.TargetConnectionHash
				}
		};
	}

	_mappingsFromConfig(pConfig)
	{
		let tmpMappings = [];
		let tmpSource = pConfig && pConfig.Mappings ? pConfig.Mappings : {};
		let tmpKeys = Object.keys(tmpSource);
		for (let i = 0; i < tmpKeys.length; i++)
		{
			let tmpTarget = tmpKeys[i];
			let tmpExpr = tmpSource[tmpTarget];
			let tmpMatch = (typeof tmpExpr === 'string') ? tmpExpr.match(/^\{~D:Record\.(\w+)~\}$/) : null;
			tmpMappings.push({ Source: tmpMatch ? tmpMatch[1] : String(tmpExpr), Target: tmpTarget });
		}
		return tmpMappings;
	}

	_regenerateJSON()
	{
		this.pict.AppData.Mapper.JSONText = JSON.stringify(this._buildMappingConfiguration(), null, '\t');
	}

	_slugify(pValue)
	{
		return String(pValue || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
	}

	_findConnection(pConnections, pID)
	{
		let tmpList = pConnections || [];
		for (let i = 0; i < tmpList.length; i++)
		{
			if (String(tmpList[i].IDBeaconConnection) === String(pID)) return tmpList[i];
		}
		return null;
	}

	_findEntity(pEntities, pName)
	{
		let tmpList = pEntities || [];
		for (let i = 0; i < tmpList.length; i++)
		{
			if (tmpList[i].TableName === pName) return tmpList[i];
		}
		return null;
	}

	_extractFields(pEntity)
	{
		if (!pEntity) return [];
		let tmpCols = pEntity.Columns || [];
		let tmpFields = [];
		for (let i = 0; i < tmpCols.length; i++)
		{
			tmpFields.push(
				{
					Name: tmpCols[i].Name || tmpCols[i].Column,
					Type: tmpCols[i].NativeType || tmpCols[i].MeadowType || ''
				});
		}
		return tmpFields;
	}

	_recomputeBeaconOptions()
	{
		let tmpState = this.pict.AppData.Mapper;
		let tmpBeacons = tmpState.Beacons || [];

		tmpState.SourceBeacons = tmpBeacons.map((pB) =>
			(
				{
					Name: pB.Name,
					BeaconID: pB.BeaconID,
					SelectedAttr: (pB.Name === tmpState.SourceBeaconName) ? 'selected' : ''
				}));
		tmpState.TargetBeacons = tmpBeacons.map((pB) =>
			(
				{
					Name: pB.Name,
					BeaconID: pB.BeaconID,
					SelectedAttr: (pB.Name === tmpState.TargetBeaconName) ? 'selected' : ''
				}));

		tmpState.SourceConnectionsForTemplate = (tmpState.SourceConnections || []).map((pC) =>
			(
				{
					IDBeaconConnection: pC.IDBeaconConnection,
					Name: pC.Name,
					Type: pC.Type,
					SelectedAttr: (String(pC.IDBeaconConnection) === String(tmpState.SourceConnectionID)) ? 'selected' : ''
				}));
		tmpState.TargetConnectionsForTemplate = (tmpState.TargetConnections || []).map((pC) =>
			(
				{
					IDBeaconConnection: pC.IDBeaconConnection,
					Name: pC.Name,
					Type: pC.Type,
					SelectedAttr: (String(pC.IDBeaconConnection) === String(tmpState.TargetConnectionID)) ? 'selected' : ''
				}));

		tmpState.SourceEntitiesForTemplate = (tmpState.SourceEntities || []).map((pE) =>
			(
				{
					TableName: pE.TableName,
					ColumnCount: (pE.Columns || []).length,
					SelectedAttr: (pE.TableName === tmpState.SourceEntity) ? 'selected' : ''
				}));
		tmpState.TargetEntitiesForTemplate = (tmpState.TargetEntities || []).map((pE) =>
			(
				{
					TableName: pE.TableName,
					ColumnCount: (pE.Columns || []).length,
					SelectedAttr: (pE.TableName === tmpState.TargetEntity) ? 'selected' : ''
				}));
	}

	_renderLayout()
	{
		if (this.pict.views['Mapper-Layout']) this.pict.views['Mapper-Layout'].render();
	}

	_renderBeaconBrowser()
	{
		if (this.pict.views['Mapper-BeaconBrowser']) this.pict.views['Mapper-BeaconBrowser'].render();
	}

	_renderFieldMapper()
	{
		if (this.pict.views['Mapper-FieldMapper']) this.pict.views['Mapper-FieldMapper'].render();
	}

	_renderMappingList()
	{
		if (this.pict.views['Mapper-MappingList']) this.pict.views['Mapper-MappingList'].render();
	}

	_renderJSONEditor()
	{
		if (this.pict.views['Mapper-JSONEditor']) this.pict.views['Mapper-JSONEditor'].render();
	}
}

module.exports = MapperAPIProvider;
module.exports.default_configuration =
{
	ProviderIdentifier: 'MapperAPI',
	AutoInitialize: true,
	AutoRender: false
};
