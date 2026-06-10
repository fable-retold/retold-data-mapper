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
