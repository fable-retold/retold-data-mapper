/**
 * Retold Data Mapper — ExtractRecords Solvers Suite
 *
 * ExtractRecords previously hardcoded Solvers: [] — caller-supplied derived
 * columns silently never ran (callers saw rows without the solver columns,
 * with no error). These tests pin the pass-through, including the numeric
 * validity idiom the projection pipelines depend on.
 */
const libAssert = require('assert');
const libPict = require('pict');
const libBeaconProvider = require('../source/services/DataMapper-BeaconProvider.js');

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
	// Pict (not plain fable): Solvers run through the full TabularTransform
	// path only when parseTemplate is available — same as the production beacon.
	let tmpFable = new libPict({ Product: 'ExtractSolversTest', LogStreams: [ { streamtype: 'console', level: 'fatal' } ] });
	tmpFable.serviceManager.addServiceType('DataMapperBeaconProvider', libBeaconProvider);
	let tmpProvider = tmpFable.serviceManager.instantiateServiceProvider('DataMapperBeaconProvider');
	tmpProvider.registerCapabilities(tmpStubBeacon);
	return tmpHandlers;
}

function invokeExtract(pSettings)
{
	return new Promise((fResolve) =>
		captureHandlers()['DataMapperTransform:ExtractRecords'].Handler(
			{ Settings: pSettings }, {},
			(pError, pResult) => fResolve({ Error: pError, Rows: pResult ? JSON.parse(pResult.Outputs.Result || '[]') : [] })));
}

suite('ExtractRecords Solvers pass-through', function ()
{
	test('caller Solvers produce derived columns (the validity-indicator idiom)', async function ()
	{
		const tmpOutcome = await invokeExtract(
			{
				Records: [ { A: '6.9' }, { A: 'Enter Dry and Wet Weights' }, { A: '0' } ],
				OperationConfiguration:
				{
					Entity: 'Probe', GUIDTemplate: 'P_{~D:Record.A~}',
					Projection: { A: '{~D:Record.A~}' },
					Solvers: [ 'AIsNum = ISNUMERIC(Record.A)', 'ANum = TONUMBER(Record.A, 0)' ]
				}
			});
		libAssert.strictEqual(tmpOutcome.Error, null);
		libAssert.strictEqual(tmpOutcome.Rows.length, 3);
		libAssert.strictEqual(String(tmpOutcome.Rows[0].AIsNum), '1');
		libAssert.strictEqual(String(tmpOutcome.Rows[1].AIsNum), '0', 'placeholder text is not numeric');
		libAssert.strictEqual(String(tmpOutcome.Rows[1].ANum), '0', 'dirty values fall back');
		libAssert.strictEqual(String(tmpOutcome.Rows[2].AIsNum), '1', 'a real zero reading counts');
	});

	test('absent Solvers behave exactly as before (no derived columns, no error)', async function ()
	{
		const tmpOutcome = await invokeExtract(
			{
				Records: [ { A: '1' } ],
				OperationConfiguration: { Entity: 'Probe', GUIDTemplate: 'P_{~D:Record.A~}', Projection: { A: '{~D:Record.A~}' } }
			});
		libAssert.strictEqual(tmpOutcome.Error, null);
		libAssert.strictEqual(tmpOutcome.Rows.length, 1);
		libAssert.strictEqual(tmpOutcome.Rows[0].AIsNum, undefined);
	});
});

suite('UnnestRecords Solvers pass-through', function ()
{
	test('solvers run per emitted element row (Record scope reaches parent + Element)', async function ()
	{
		const tmpOutcome = await new Promise((fResolve) =>
			captureHandlers()['DataMapperTransform:UnnestRecords'].Handler(
				{
					Settings:
					{
						Records: [ { IDDoc: 9, Table: [ { V: '6.9' }, { V: '' } ] } ],
						OperationConfiguration:
						{
							Entity: 'Probe', GUIDName: 'GUIDProbe',
							GUIDTemplate: 'U_{~D:Record.IDDoc~}_{~D:Record.ElementIndex~}',
							ArrayPath: 'Table',
							ParentCarry: { IDDoc: '{~D:Record.IDDoc~}' },
							ElementProjection: { VRaw: '{~D:Element.V~}' },
							Solvers: [ 'VIsNum = ISNUMERIC(Record.Element.V)', 'VNum = TONUMBER(Record.Element.V, 0)' ]
						}
					}
				}, {},
				(pError, pResult) => fResolve({ Error: pError, Rows: pResult ? JSON.parse(pResult.Outputs.Result || '[]') : [] })));
		libAssert.strictEqual(tmpOutcome.Error, null);
		libAssert.strictEqual(tmpOutcome.Rows.length, 2);
		libAssert.strictEqual(String(tmpOutcome.Rows[0].VIsNum), '1');
		libAssert.strictEqual(String(tmpOutcome.Rows[0].VNum), '6.9');
		libAssert.strictEqual(String(tmpOutcome.Rows[1].VIsNum), '0', 'empty element value is not numeric');
	});
});

suite('ExtractRecords graph-node config shape', function ()
{
	test('a STRINGIFIED OperationConfiguration (the compiled-graph shape) parses and solvers run', async function ()
	{
		const tmpOutcome = await invokeExtract(
			{
				Records: [ { A: '6.9' } ],
				OperationConfiguration: JSON.stringify(
				{
					Entity: 'Probe', GUIDTemplate: 'P_{~D:Record.A~}',
					Projection: { A: '{~D:Record.A~}' },
					Solvers: [ 'AIsNum = ISNUMERIC(Record.A)' ]
				})
			});
		libAssert.strictEqual(tmpOutcome.Error, null);
		libAssert.strictEqual(String(tmpOutcome.Rows[0].AIsNum), '1', 'solvers must run when the config arrives stringified');
		libAssert.strictEqual(tmpOutcome.Rows[0].A, '6.9', 'projection must apply too (not a passthrough no-op)');
	});

	test('the extraction compiler bundles Solvers onto the extract node', function ()
	{
		const libConnectionBridge = require('../source/services/DataMapper-ConnectionBridge.js');
		const tmpGraph = libConnectionBridge.prototype._compileExtractionToOperation.call(
			Object.create(libConnectionBridge.prototype),
			{
				Hash: 'solver-bundle-test', Name: 'T', OperationType: 'Extraction',
				SourceBeaconName: 's', SourceConnectionHash: 'sc', SourceEntity: 'E',
				TargetBeaconName: 't', TargetConnectionHash: 'tc', TargetTable: 'Out',
				OperationConfiguration: JSON.stringify({ Entity: 'Out', GUIDTemplate: 'O_{~D:Record.ID~}', Projection: { ID: '{~D:Record.ID~}' }, Solvers: [ 'X = ISNUMERIC(Record.ID)' ] })
			});
		const tmpExtract = tmpGraph.Graph.Nodes.find((pNode) => pNode.Hash === 'extract');
		const tmpBundled = JSON.parse(tmpExtract.Data.OperationConfiguration);
		libAssert.deepStrictEqual(tmpBundled.Solvers, [ 'X = ISNUMERIC(Record.ID)' ], 'Solvers must survive compilation into the node bundle');
	});
});

suite('PullRecords source-error handling', function ()
{
	function buildPullHarness(pScript)
	{
		let tmpHandlers = {};
		let tmpFable = new libPict({ Product: 'PullErrorTest', LogStreams: [ { streamtype: 'console', level: 'fatal' } ] });
		tmpFable.serviceManager.addServiceType('DataMapperBeaconProvider', require('../source/services/DataMapper-BeaconProvider.js'));
		let tmpProvider = tmpFable.serviceManager.instantiateServiceProvider('DataMapperBeaconProvider');
		tmpProvider.registerCapabilities({ registerCapability: (pSpec) => { for (const k of Object.keys(pSpec.actions || {})) { tmpHandlers[pSpec.Capability + ':' + k] = pSpec.actions[k]; } } });
		tmpProvider._Client = {};
		tmpProvider._dispatch = (pWorkItem, fCallback) => fCallback(null, pScript(pWorkItem));
		return tmpHandlers;
	}

	function pull(pHandlers)
	{
		return new Promise((fResolve) =>
			pHandlers['DataMapperRecords:PullRecords'].Handler(
				{ Settings: { SourceBeaconName: 'src', ConnectionHash: 'conn', Entity: 'Thing', BatchSize: 100 } }, {},
				(pError, pResult) => fResolve({ Error: pError, Outputs: (pResult && pResult.Outputs) || {} })));
	}

	test('a 500 from the source FAILS the pull instead of reading an empty page', async function ()
	{
		this.timeout(8000);
		const tmpHandlers = buildPullHarness(() => ({ Status: 500, Body: '{"Error":"Invalid column name ID Thing"}' }));
		const tmpOutcome = await pull(tmpHandlers);
		libAssert.strictEqual(tmpOutcome.Outputs.Errors, 1);
		libAssert.match(tmpOutcome.Outputs.ErrorLog[0].Error, /HTTP 500/);
		libAssert.strictEqual(tmpOutcome.Outputs.Pulled, 0);
	});

	test('a transient 500 is retried with backoff and the pull succeeds', async function ()
	{
		this.timeout(8000);
		let tmpCalls = 0;
		const tmpHandlers = buildPullHarness(() =>
		{
			tmpCalls++;
			return (tmpCalls === 1)
				? { Status: 500, Body: '{"Error":"pool exhausted"}' }
				: { Status: 200, Body: '[]' };
		});
		const tmpOutcome = await pull(tmpHandlers);
		libAssert.ok(!tmpOutcome.Outputs.Errors, 'retry recovered the pull');
		libAssert.strictEqual(tmpCalls, 2, 'exactly one retry was needed');
	});

	test('a persistent 500 fails after bounded retries with attempts recorded', async function ()
	{
		this.timeout(8000);
		const tmpHandlers = buildPullHarness(() => ({ Status: 500, Body: '{"Error":"Invalid column name"}' }));
		const tmpOutcome = await pull(tmpHandlers);
		libAssert.strictEqual(tmpOutcome.Outputs.Errors, 1);
		libAssert.strictEqual(tmpOutcome.Outputs.ErrorLog[0].Attempts, 3);
	});

	test('a genuinely empty source still reads as zero rows successfully', async function ()
	{
		const tmpHandlers = buildPullHarness(() => ({ Status: 200, Body: '[]' }));
		const tmpOutcome = await pull(tmpHandlers);
		libAssert.strictEqual(tmpOutcome.Error, null);
		libAssert.ok(!tmpOutcome.Outputs.Errors, 'no error for a real empty result');
	});
});
