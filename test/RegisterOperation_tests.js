/**
 * Retold Data Mapper — DataMapperManagement:RegisterOperation Suite
 *
 * The mesh-dispatchable definition path: callers register-or-update an
 * OperationConfig as a UV work item (no data-mapper REST anywhere) and get
 * back the CompiledOperationHash to trigger runs with. Covers the shared
 * bridge method (normalization, validation status codes, persist + eager-
 * register envelope) and the capability handler's delegation contract.
 */
const libAssert = require('assert');
const libFable = require('fable');
const libBeaconProvider = require('../source/services/DataMapper-BeaconProvider.js');
const libConnectionBridge = require('../source/services/DataMapper-ConnectionBridge.js');

const VALID_BODY =
{
	Hash: 'reg-op-test',
	Scope: 'register-tests',
	Name: 'Register Test',
	OperationType: 'Unnest',
	SourceBeaconName: 'src', SourceConnectionHash: 'src-conn', SourceEntity: 'Document',
	TargetBeaconName: 'tgt', TargetConnectionHash: 'tgt-conn', TargetTable: 'Out',
	OperationConfiguration: { Entity: 'Out', ArrayPath: 'T', ElementProjection: { A: '{~D:Element.A~}' } }
};

function buildBridge(pLedger)
{
	let tmpFable = new libFable({ Product: 'RegisterOpTest', LogStreams: [ { streamtype: 'console', level: 'fatal' } ] });
	tmpFable.serviceManager.addServiceType('DataMapperConnectionBridge', libConnectionBridge);
	let tmpBridge = tmpFable.serviceManager.instantiateServiceProvider('DataMapperConnectionBridge');
	tmpBridge._meadowProxyRequest = (pBeacon, pMethod, pPath, pBody, fCb) =>
	{
		pLedger.stores.push({ Beacon: pBeacon, Method: pMethod, Path: pPath, Body: pBody });
		if (pLedger.storeFails) { return fCb(new Error('configs store down')); }
		return fCb(null, Object.assign({ IDOperationConfig: 42 }, pBody));
	};
	tmpBridge._eagerRegisterOperationGraph = (pOperation, fCb) =>
	{
		pLedger.registrations.push(pOperation);
		return fCb(null, { Compiled: true, OperationHash: 'OPR-REG-1', CacheHit: false });
	};
	tmpBridge._validateAgainstTarget = (pRecord, fCb) => fCb(null, null);
	return { bridge: tmpBridge, fable: tmpFable };
}

function register(pBridge, pBody, pOptions)
{
	return new Promise((fResolve) => pBridge.registerOperationConfig(pBody, pOptions || {}, (pError, pResult) => fResolve({ Error: pError, Result: pResult })));
}

suite('ConnectionBridge.registerOperationConfig', function ()
{
	test('normalizes, persists, eager-registers, and returns the compiled hash', async function ()
	{
		const tmpLedger = { stores: [], registrations: [] };
		const tmpOutcome = await register(buildBridge(tmpLedger).bridge, VALID_BODY);
		libAssert.strictEqual(tmpOutcome.Error, null);
		libAssert.strictEqual(tmpOutcome.Result.CompiledOperationHash, 'OPR-REG-1');
		libAssert.strictEqual(tmpOutcome.Result.Operation.IDOperationConfig, 42);
		const tmpStored = tmpLedger.stores[0].Body;
		libAssert.strictEqual(tmpStored.Hash, 'reg-op-test');
		libAssert.strictEqual(typeof tmpStored.OperationConfiguration, 'string', 'the per-type block persists stringified');
		libAssert.strictEqual(tmpStored.ResetMode, 'Append');
		libAssert.strictEqual(tmpLedger.registrations.length, 1);
	});

	test('Aggregation accepts CollectDistinct/CountDistinct and still rejects unknown functions', async function ()
	{
		const tmpLedger = { stores: [], registrations: [] };
		const tmpBody = {
			Hash: 'agg-collect-test', Name: 'AggCollect', OperationType: 'Aggregation',
			SourceBeaconName: 'lake', SourceConnectionHash: 'lake', SourceEntity: 'Facts',
			TargetBeaconName: 'lake', TargetConnectionHash: 'lake', TargetEntity: 'Daily', TargetTable: 'Daily',
			OperationConfiguration: {
				Entity: 'Daily', GroupBy: ['Day'],
				Aggregates: [
					{ Source: 'V', Function: 'Sum', As: 'Total' },
					{ Source: 'IDDocument', Function: 'CollectDistinct', As: 'IDDocuments' },
					{ Source: 'IDDocument', Function: 'CountDistinct', As: 'IDDocumentCount' }
				]
			}
		};
		const tmpOutcome = await register(buildBridge(tmpLedger).bridge, tmpBody);
		libAssert.strictEqual(tmpOutcome.Error, null, 'provenance aggregates accepted');

		const tmpBad = JSON.parse(JSON.stringify(tmpBody));
		tmpBad.Hash = 'agg-bad-test';
		tmpBad.OperationConfiguration.Aggregates.push({ Source: 'V', Function: 'Median', As: 'Nope' });
		const tmpRejected = await register(buildBridge({ stores: [], registrations: [] }).bridge, tmpBad);
		libAssert.strictEqual(tmpRejected.Error.StatusCode, 400);
		libAssert.ok(/CollectDistinct/.test(tmpRejected.Error.message), 'error message advertises the full list');
	});

	test('missing Hash / OperationType fail with StatusCode 400', async function ()
	{
		const tmpBridge = buildBridge({ stores: [], registrations: [] }).bridge;
		const tmpNoHash = await register(tmpBridge, { OperationType: 'Unnest' });
		libAssert.strictEqual(tmpNoHash.Error.StatusCode, 400);
		const tmpNoType = await register(tmpBridge, { Hash: 'x' });
		libAssert.strictEqual(tmpNoType.Error.StatusCode, 400);
	});

	test('per-type configuration validation rejects with 400 (Unnest without ArrayPath)', async function ()
	{
		const tmpLedger = { stores: [], registrations: [] };
		const tmpBody = Object.assign({}, VALID_BODY, { OperationConfiguration: { Entity: 'Out' } });
		const tmpOutcome = await register(buildBridge(tmpLedger).bridge, tmpBody);
		libAssert.strictEqual(tmpOutcome.Error.StatusCode, 400);
		libAssert.match(tmpOutcome.Error.message, /ArrayPath/);
		libAssert.strictEqual(tmpLedger.stores.length, 0, 'nothing persisted on validation failure');
	});

	test('SkipValidation bypasses validation and reports the warning', async function ()
	{
		const tmpLedger = { stores: [], registrations: [] };
		const tmpBody = Object.assign({}, VALID_BODY, { OperationConfiguration: { Entity: 'Out' } });
		const tmpOutcome = await register(buildBridge(tmpLedger).bridge, tmpBody, { SkipValidation: true });
		libAssert.strictEqual(tmpOutcome.Error, null);
		libAssert.match(tmpOutcome.Result.ValidationWarning, /skipped/i);
	});

	test('an existing (Scope, Hash) row updates in place (create-or-update)', async function ()
	{
		const tmpLedger = { stores: [], registrations: [] };
		const tmpHarness = buildBridge(tmpLedger);
		tmpHarness.bridge._meadowProxyRequest = (pBeacon, pMethod, pPath, pBody, fCb) =>
		{
			tmpLedger.stores.push({ Method: pMethod, Path: pPath, Body: pBody });
			if (pMethod === 'POST') { return fCb(new Error('UNIQUE constraint failed: OperationConfig.Scope, OperationConfig.Hash')); }
			if (pMethod === 'GET') { return fCb(null, [ { IDOperationConfig: 42, Hash: 'reg-op-test', Scope: 'register-tests' } ]); }
			return fCb(null, { Updated: true });
		};
		const tmpOutcome = await register(tmpHarness.bridge, VALID_BODY);
		libAssert.strictEqual(tmpOutcome.Error, null);
		libAssert.strictEqual(tmpOutcome.Result.Operation.IDOperationConfig, 42);
		libAssert.strictEqual(tmpOutcome.Result.CompiledOperationHash, 'OPR-REG-1');
		libAssert.deepStrictEqual(tmpLedger.stores.map((pStore) => pStore.Method), [ 'POST', 'GET', 'PUT' ]);
		libAssert.match(tmpLedger.stores[2].Path, /OperationConfig\/42$/);
	});

	test('a configs-store failure surfaces with StatusCode 502', async function ()
	{
		const tmpLedger = { stores: [], registrations: [], storeFails: true };
		const tmpOutcome = await register(buildBridge(tmpLedger).bridge, VALID_BODY);
		libAssert.strictEqual(tmpOutcome.Error.StatusCode, 502);
	});
});

suite('DataMapperManagement:RegisterOperation handler', function ()
{
	function captureHandlers()
	{
		let tmpHandlers = {};
		let tmpStubBeacon =
		{
			registerCapability: function (pSpec)
			{
				let tmpKeys = Object.keys(pSpec.actions || {});
				for (let i = 0; i < tmpKeys.length; i++)
				{
					tmpHandlers[pSpec.Capability + ':' + tmpKeys[i]] = pSpec.actions[tmpKeys[i]];
				}
			}
		};
		let tmpFable = new libFable({ Product: 'RegisterOpHandlerTest', LogStreams: [ { streamtype: 'console', level: 'fatal' } ] });
		tmpFable.serviceManager.addServiceType('DataMapperBeaconProvider', libBeaconProvider);
		let tmpProvider = tmpFable.serviceManager.instantiateServiceProvider('DataMapperBeaconProvider');
		tmpProvider.registerCapabilities(tmpStubBeacon);
		return { fable: tmpFable, handlers: tmpHandlers };
	}

	function invoke(pHarness, pSettings)
	{
		return new Promise((fResolve) =>
			pHarness.handlers['DataMapperManagement:RegisterOperation'].Handler(
				{ Settings: pSettings || {} }, {},
				(pError, pResult) => fResolve({ Error: pError, Result: pResult })));
	}

	test('the action is registered', function ()
	{
		const tmpHarness = captureHandlers();
		libAssert.ok(tmpHarness.handlers['DataMapperManagement:RegisterOperation']);
	});

	test('delegates to the bridge and returns the registration outputs', async function ()
	{
		const tmpHarness = captureHandlers();
		let tmpReceived = null;
		tmpHarness.fable.DataMapperConnectionBridge =
		{
			registerOperationConfig: (pBody, pOptions, fCb) =>
			{
				tmpReceived = { Body: pBody, Options: pOptions };
				return fCb(null, { Operation: { IDOperationConfig: 7, Hash: pBody.Hash, Scope: pBody.Scope }, CompiledOperationHash: 'OPR-9', UVRegistration: { Compiled: true }, ValidationWarning: null });
			}
		};
		const tmpOutcome = await invoke(tmpHarness, { OperationConfig: VALID_BODY });
		libAssert.strictEqual(tmpOutcome.Error, null);
		libAssert.strictEqual(tmpOutcome.Result.Outputs.CompiledOperationHash, 'OPR-9');
		libAssert.strictEqual(tmpOutcome.Result.Outputs.IDOperationConfig, 7);
		libAssert.strictEqual(tmpReceived.Body.Hash, 'reg-op-test');
	});

	test('a stringified OperationConfig is parsed before delegation', async function ()
	{
		const tmpHarness = captureHandlers();
		tmpHarness.fable.DataMapperConnectionBridge =
		{
			registerOperationConfig: (pBody, pOptions, fCb) => fCb(null, { Operation: { IDOperationConfig: 1, Hash: pBody.Hash }, CompiledOperationHash: 'OPR-1' })
		};
		const tmpOutcome = await invoke(tmpHarness, { OperationConfig: JSON.stringify(VALID_BODY) });
		libAssert.strictEqual(tmpOutcome.Error, null);
		libAssert.strictEqual(tmpOutcome.Result.Outputs.Hash, 'reg-op-test');
	});

	test('a missing OperationConfig is a clear error', async function ()
	{
		const tmpOutcome = await invoke(captureHandlers(), {});
		libAssert.ok(tmpOutcome.Error instanceof Error);
		libAssert.match(tmpOutcome.Error.message, /OperationConfig/);
	});
});

/**
 * The compiled-graph cache.
 *
 * `_eagerRegisterOperationGraph` skips the UV `POST /Operation` when the
 * operation it is handed already carries a `CompiledOperationConfigHash`
 * matching the freshly computed fingerprint AND a `CompiledOperationHash` to
 * return. Both of those live on the persisted OperationConfig row — so the
 * re-registration path has to carry them forward, or the cache can never hit
 * and every stage of every sweep recompiles and re-registers.
 */
function buildCacheBridge(pLedger)
{
	let tmpFable = new libFable({ Product: 'RegisterOpCacheTest', LogStreams: [ { streamtype: 'console', level: 'fatal' } ] });
	tmpFable.serviceManager.addServiceType('DataMapperConnectionBridge', libConnectionBridge);
	let tmpBridge = tmpFable.serviceManager.instantiateServiceProvider('DataMapperConnectionBridge');
	// Route by method/path so the UNIQUE-violation re-registration path runs:
	// POST conflicts, the GET finds the existing row, the PUT updates it.
	tmpBridge._meadowProxyRequest = (pBeacon, pMethod, pPath, pBody, fCb) =>
	{
		pLedger.stores.push({ Method: pMethod, Path: pPath, Body: pBody });
		if ((pMethod === 'POST') && /\/OperationConfig$/.test(pPath))
		{
			return fCb(new Error('UNIQUE constraint failed: OperationConfig.Scope, OperationConfig.Hash'));
		}
		if ((pMethod === 'GET') && /\/OperationConfigs\/FilteredTo\//.test(pPath))
		{
			return fCb(null, [ pLedger.existing ]);
		}
		return fCb(null, Object.assign({}, pBody));
	};
	tmpBridge._eagerRegisterOperationGraph = (pOperation, fCb) =>
	{
		pLedger.registrations.push(pOperation);
		return fCb(null, { Compiled: false, OperationHash: 'OPR-CACHED', CacheHit: true });
	};
	tmpBridge._validateAgainstTarget = (pRecord, fCb) => fCb(null, null);
	return tmpBridge;
}

suite('ConnectionBridge.registerOperationConfig compile cache', function ()
{
	/** @return {object} the persisted row a prior registration would have left behind */
	function existingRow()
	{
		return {
			IDOperationConfig: 42,
			Scope: 'register-tests',
			Hash: 'reg-op-test',
			CompiledOperationHash: 'OPR-CACHED',
			CompiledOperationConfigHash: 'fingerprint-abc'
		};
	}

	test('re-registration carries the stored cache hashes to eager-registration', async function ()
	{
		const tmpLedger = { stores: [], registrations: [], existing: existingRow() };
		const tmpOutcome = await register(buildCacheBridge(tmpLedger), VALID_BODY);
		libAssert.strictEqual(tmpOutcome.Error, null);
		libAssert.strictEqual(tmpLedger.registrations.length, 1);
		const tmpRegistered = tmpLedger.registrations[0];
		// Without these the cache check short-circuits to false on every run, so
		// all 79 stages of a sweep recompile and re-POST their graph to UV.
		libAssert.strictEqual(tmpRegistered.CompiledOperationConfigHash, 'fingerprint-abc',
			'the stored fingerprint must reach the cache check');
		libAssert.strictEqual(tmpRegistered.CompiledOperationHash, 'OPR-CACHED',
			'the cached compiled hash must reach the cache check');
	});

	test('the cache hashes are still never written FROM the caller', async function ()
	{
		const tmpLedger = { stores: [], registrations: [], existing: existingRow() };
		await register(buildCacheBridge(tmpLedger),
			Object.assign({}, VALID_BODY, { CompiledOperationHash: 'OPR-FORGED', CompiledOperationConfigHash: 'forged' }));
		const tmpPut = tmpLedger.stores.find((pStore) => pStore.Method === 'PUT');
		libAssert.ok(tmpPut, 'the re-registration path PUTs the row');
		// A caller must not be able to plant a compiled hash: that is how one
		// ConfigHash ends up pointing at another operation's graph.
		libAssert.strictEqual(tmpPut.Body.CompiledOperationHash, undefined);
		libAssert.strictEqual(tmpPut.Body.CompiledOperationConfigHash, undefined);
		libAssert.strictEqual(tmpLedger.registrations[0].CompiledOperationHash, 'OPR-CACHED',
			'the STORED hash wins over anything the caller sent');
	});

	test('a brand-new definition registers with no cache to carry', async function ()
	{
		const tmpLedger = { stores: [], registrations: [] };
		let tmpBridge = buildCacheBridge(tmpLedger);
		// No UNIQUE conflict this time: the POST succeeds and returns the new row.
		tmpBridge._meadowProxyRequest = (pBeacon, pMethod, pPath, pBody, fCb) =>
		{
			tmpLedger.stores.push({ Method: pMethod, Path: pPath, Body: pBody });
			return fCb(null, Object.assign({ IDOperationConfig: 99 }, pBody));
		};
		const tmpOutcome = await register(tmpBridge, VALID_BODY);
		libAssert.strictEqual(tmpOutcome.Error, null);
		libAssert.strictEqual(tmpLedger.registrations[0].IDOperationConfig, 99);
		libAssert.strictEqual(tmpLedger.registrations[0].CompiledOperationHash, undefined,
			'nothing is cached yet, so eager-registration must compile');
	});
});

/**
 * `_eagerRegisterOperationGraph` — the cache's actual effect.
 *
 * The compile runs unconditionally, so what the cache saves is the UV
 * `POST /Operation` round trip (and keeps UV's Operation list from filling up
 * with N copies of one graph). These assert the round trip, not the compile.
 */
function buildEagerBridge(pLedger)
{
	let tmpFable = new libFable({ Product: 'EagerRegisterTest', LogStreams: [ { streamtype: 'console', level: 'fatal' } ] });
	tmpFable.serviceManager.addServiceType('DataMapperConnectionBridge', libConnectionBridge);
	let tmpBridge = tmpFable.serviceManager.instantiateServiceProvider('DataMapperConnectionBridge');
	// _eagerRegisterOperationGraph refuses to compile without a live UV client.
	tmpBridge._client = () => ({ Connected: true });
	tmpBridge._request = (pMethod, pPath, pBody, fCb) =>
	{
		pLedger.uv.push({ Method: pMethod, Path: pPath });
		return fCb(null, { Hash: 'OPR-FRESH' });
	};
	tmpBridge._meadowProxyRequest = (pBeacon, pMethod, pPath, pBody, fCb) =>
	{
		pLedger.stores.push({ Method: pMethod, Path: pPath, Body: pBody });
		return fCb(null, {});
	};
	return tmpBridge;
}

function eagerRegister(pBridge, pOperation)
{
	return new Promise((fResolve) => pBridge._eagerRegisterOperationGraph(pOperation, (pIgnored, pResult) => fResolve(pResult)));
}

/** @return {object} an OperationConfig row that compiles */
function compilableRow(pOverrides)
{
	return Object.assign({}, VALID_BODY, { IDOperationConfig: 42 }, pOverrides || {});
}

suite('ConnectionBridge._eagerRegisterOperationGraph compile cache', function ()
{
	test('the key is the COMPILED GRAPH, so the same graph digests the same', function ()
	{
		let tmpBridge = buildEagerBridge({ uv: [], stores: [] });
		const tmpGraph = { Name: 'g', Version: '1.0.0', Graph: { Nodes: [ { Data: { AffinityKey: 'x' } } ] } };
		libAssert.strictEqual(tmpBridge._hashCompiledGraph(tmpGraph), tmpBridge._hashCompiledGraph(tmpGraph));
		// A compiler change emits a different graph and must therefore miss.
		libAssert.notStrictEqual(
			tmpBridge._hashCompiledGraph(tmpGraph),
			tmpBridge._hashCompiledGraph({ Name: 'g', Version: '1.0.1', Graph: { Nodes: [ { Data: { AffinityKey: 'x' } } ] } }),
			'a changed graph must not reuse the cached UV operation');
	});

	test('a miss compiles, POSTs the graph to UV, and caches against the row id', async function ()
	{
		const tmpLedger = { uv: [], stores: [] };
		const tmpResult = await eagerRegister(buildEagerBridge(tmpLedger), compilableRow());
		libAssert.strictEqual(tmpResult.Compiled, true);
		libAssert.strictEqual(tmpResult.CacheHit, false);
		libAssert.strictEqual(tmpResult.OperationHash, 'OPR-FRESH');
		libAssert.deepStrictEqual(tmpLedger.uv.map((pCall) => pCall.Method + ' ' + pCall.Path), [ 'POST /Operation' ]);
		const tmpPut = tmpLedger.stores.find((pStore) => pStore.Method === 'PUT');
		libAssert.ok(tmpPut, 'the fingerprint is persisted so the NEXT run can hit');
		libAssert.ok(/\/OperationConfig\/42$/.test(tmpPut.Path), 'cached against its own row: ' + tmpPut.Path);
		libAssert.strictEqual(tmpPut.Body.CompiledOperationHash, 'OPR-FRESH');
	});

	test('a hit skips the UV round trip entirely', async function ()
	{
		const tmpLedger = { uv: [], stores: [] };
		let tmpBridge = buildEagerBridge(tmpLedger);
		// Prime the row with the fingerprint this operation's graph will produce.
		const tmpPrimed = compilableRow();
		const tmpMiss = await eagerRegister(tmpBridge, tmpPrimed);
		libAssert.strictEqual(tmpMiss.CacheHit, false);
		const tmpFingerprint = tmpLedger.stores.find((pStore) => pStore.Method === 'PUT').Body.CompiledOperationConfigHash;

		const tmpSecondLedger = { uv: [], stores: [] };
		const tmpHit = await eagerRegister(buildEagerBridge(tmpSecondLedger),
			compilableRow({ CompiledOperationConfigHash: tmpFingerprint, CompiledOperationHash: 'OPR-FRESH' }));
		libAssert.strictEqual(tmpHit.CacheHit, true);
		libAssert.strictEqual(tmpHit.OperationHash, 'OPR-FRESH');
		// The whole point: no POST /Operation, and nothing re-persisted.
		libAssert.deepStrictEqual(tmpSecondLedger.uv, [], 'a cache hit must not re-register the graph on UV');
		libAssert.deepStrictEqual(tmpSecondLedger.stores, []);
	});

	test('a stale fingerprint misses and re-registers', async function ()
	{
		const tmpLedger = { uv: [], stores: [] };
		const tmpResult = await eagerRegister(buildEagerBridge(tmpLedger),
			compilableRow({ CompiledOperationConfigHash: 'from-an-older-compiler', CompiledOperationHash: 'OPR-OLD' }));
		libAssert.strictEqual(tmpResult.CacheHit, false);
		libAssert.deepStrictEqual(tmpLedger.uv.map((pCall) => pCall.Path), [ '/Operation' ]);
	});

	test('without a row id the graph registers but is NOT cached', async function ()
	{
		const tmpLedger = { uv: [], stores: [] };
		const tmpResult = await eagerRegister(buildEagerBridge(tmpLedger), compilableRow({ IDOperationConfig: 0 }));
		libAssert.strictEqual(tmpResult.Compiled, true);
		libAssert.strictEqual(tmpResult.CachePersisted, false);
		// An unaddressed PUT is how one ConfigHash ends up pointing at another
		// operation's graph; skipping it costs only a recompile next run.
		libAssert.deepStrictEqual(tmpLedger.stores, [], 'no PUT to /OperationConfig/undefined');
	});
});

/**
 * End to end on the path the refresh beacon actually takes: the beacon
 * dispatches RegisterOperation for every stage of every sweep, so
 * `registerOperationConfig` -> `_eagerRegisterOperationGraph` is the hot path.
 * Nothing is stubbed between them here.
 */
suite('RegisterOperation end to end: a re-registered stage hits the cache', function ()
{
	/**
	 * @param {object} pStoredRow - the OperationConfig row already in the store
	 * @return {{ bridge: object, ledger: object }}
	 */
	function build(pStoredRow)
	{
		const tmpLedger = { uv: [], stores: [] };
		let tmpFable = new libFable({ Product: 'RegisterE2ETest', LogStreams: [ { streamtype: 'console', level: 'fatal' } ] });
		tmpFable.serviceManager.addServiceType('DataMapperConnectionBridge', libConnectionBridge);
		let tmpBridge = tmpFable.serviceManager.instantiateServiceProvider('DataMapperConnectionBridge');
		tmpBridge._client = () => ({ Connected: true });
		tmpBridge._request = (pMethod, pPath, pBody, fCb) =>
		{
			tmpLedger.uv.push(pMethod + ' ' + pPath);
			return fCb(null, { Hash: 'OPR-E2E' });
		};
		tmpBridge._meadowProxyRequest = (pBeacon, pMethod, pPath, pBody, fCb) =>
		{
			tmpLedger.stores.push({ Method: pMethod, Path: pPath, Body: pBody });
			if ((pMethod === 'POST') && /\/OperationConfig$/.test(pPath))
			{
				return fCb(new Error('UNIQUE constraint failed: OperationConfig.Scope, OperationConfig.Hash'));
			}
			if ((pMethod === 'GET') && /\/OperationConfigs\/FilteredTo\//.test(pPath))
			{
				return fCb(null, [ pStoredRow ]);
			}
			return fCb(null, Object.assign({}, pBody));
		};
		tmpBridge._validateAgainstTarget = (pRecord, fCb) => fCb(null, null);
		return { bridge: tmpBridge, ledger: tmpLedger };
	}

	test('first registration compiles and registers, and persists a fingerprint', async function ()
	{
		const tmpHarness = build({ IDOperationConfig: 42, Scope: 'register-tests', Hash: 'reg-op-test' });
		const tmpOutcome = await register(tmpHarness.bridge, VALID_BODY);
		libAssert.strictEqual(tmpOutcome.Error, null);
		libAssert.strictEqual(tmpOutcome.Result.CompiledOperationHash, 'OPR-E2E');
		libAssert.deepStrictEqual(tmpHarness.ledger.uv, [ 'POST /Operation' ]);
		const tmpCacheWrite = tmpHarness.ledger.stores.filter((pStore) => pStore.Method === 'PUT')
			.find((pStore) => pStore.Body && pStore.Body.CompiledOperationConfigHash);
		libAssert.ok(tmpCacheWrite, 'the fingerprint must be persisted or the next run cannot hit');
		return tmpCacheWrite.Body.CompiledOperationConfigHash;
	});

	test('the SECOND registration of the same stage does NOT re-register on UV', async function ()
	{
		// Run once to learn the fingerprint this stage's graph produces...
		const tmpFirst = build({ IDOperationConfig: 42, Scope: 'register-tests', Hash: 'reg-op-test' });
		await register(tmpFirst.bridge, VALID_BODY);
		const tmpFingerprint = tmpFirst.ledger.stores.filter((pStore) => pStore.Method === 'PUT')
			.find((pStore) => pStore.Body && pStore.Body.CompiledOperationConfigHash).Body.CompiledOperationConfigHash;

		// ...then re-register with the store in the state the first run left it.
		const tmpSecond = build(
			{
				IDOperationConfig: 42, Scope: 'register-tests', Hash: 'reg-op-test',
				CompiledOperationHash: 'OPR-E2E', CompiledOperationConfigHash: tmpFingerprint
			});
		const tmpOutcome = await register(tmpSecond.bridge, VALID_BODY);
		libAssert.strictEqual(tmpOutcome.Error, null);
		libAssert.strictEqual(tmpOutcome.Result.CompiledOperationHash, 'OPR-E2E',
			'the caller still gets a hash to trigger');
		libAssert.strictEqual(tmpOutcome.Result.UVRegistration.CacheHit, true);
		// This is the defect §0.3 describes: before the carry-forward this list was
		// [ 'POST /Operation' ] on every single sweep, for every stage.
		libAssert.deepStrictEqual(tmpSecond.ledger.uv, [], 'no UV round trip on a re-registration');
	});

	test('an edited stage still re-registers, because its graph changed', async function ()
	{
		const tmpFirst = build({ IDOperationConfig: 42, Scope: 'register-tests', Hash: 'reg-op-test' });
		await register(tmpFirst.bridge, VALID_BODY);
		const tmpFingerprint = tmpFirst.ledger.stores.filter((pStore) => pStore.Method === 'PUT')
			.find((pStore) => pStore.Body && pStore.Body.CompiledOperationConfigHash).Body.CompiledOperationConfigHash;

		const tmpSecond = build(
			{
				IDOperationConfig: 42, Scope: 'register-tests', Hash: 'reg-op-test',
				CompiledOperationHash: 'OPR-E2E', CompiledOperationConfigHash: tmpFingerprint
			});
		const tmpEdited = Object.assign({}, VALID_BODY,
			{ OperationConfiguration: { Entity: 'Out', ArrayPath: 'T', ElementProjection: { A: '{~D:Element.A~}', B: '{~D:Element.B~}' } } });
		await register(tmpSecond.bridge, tmpEdited);
		libAssert.deepStrictEqual(tmpSecond.ledger.uv, [ 'POST /Operation' ],
			'a changed projection must produce a different graph and miss the cache');
	});
});
