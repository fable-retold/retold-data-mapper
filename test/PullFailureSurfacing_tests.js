/**
 * Retold Data Mapper — PullRecords failure surfacing Suite
 *
 * The transform-input rule these sit under is that '[]' is the ONLY thing that means empty
 * (see SettingResolution_tests.js). PullRecords used to manufacture '[]' out of a failed
 * read — missing settings, a dispatch error, a 404, or a body that simply was not an array —
 * so a broken source was laundered into the one value every downstream guard trusts.
 *
 * The shape that cost two months of stale dashboards: the source connection had been deleted,
 * the pull read zero rows and reported success, and the stages downstream of it re-read and
 * rewrote the stale lake rows, bumping UpdateDate so the lake looked refreshed.
 *
 * The most dangerous body is not the 404 — it is HTTP 200 carrying
 * {"Error":"You must be authenticated to access this resource."}, which is how the platform
 * API answers an auth failure. These pin every one of those paths as a task failure, and pin
 * the one case that must NOT regress: a genuinely empty source still succeeds.
 */
const libAssert = require('assert');
const libPict = require('pict');
const libBeaconProvider = require('../source/services/DataMapper-BeaconProvider.js');

const _resolvePullBody = libBeaconProvider._resolvePullBody;

const BEACON = 'source-beacon';
const CONNECTION = 'lims';
const ENTITY = 'MoistureSample';

/**
 * Build a PullRecords harness whose GET behavior is programmable per batch.
 *
 * @param {function} pReadBehavior - function(pBatchNumber, pPath) returning
 *        { Error: '<message>' } | { Status: <number>, Body: <any> } — Body defaults to '[]'
 * @param {object} pOptions - { NoClient: true } to simulate an unconnected beacon
 * @return {object} { handlers, ledger }
 */
function buildPullHarness(pReadBehavior, pOptions)
{
	let tmpOptions = pOptions || {};
	let tmpHandlers = {};
	let tmpFable = new libPict({ Product: 'PullFailureSurfacingTest', LogStreams: [ { streamtype: 'console', level: 'fatal' } ] });
	tmpFable.serviceManager.addServiceType('DataMapperBeaconProvider', libBeaconProvider);
	let tmpProvider = tmpFable.serviceManager.instantiateServiceProvider('DataMapperBeaconProvider');
	tmpProvider.registerCapabilities(
		{
			registerCapability: function (pSpec)
			{
				for (const tmpKey of Object.keys(pSpec.actions || {}))
				{
					tmpHandlers[pSpec.Capability + ':' + tmpKey] = pSpec.actions[tmpKey];
				}
			}
		});

	if (!tmpOptions.NoClient)
	{
		tmpProvider._Client = {};
	}
	const tmpLedger = { reads: 0, paths: [] };
	tmpProvider._dispatch = (pWorkItem, fCallback) =>
	{
		const tmpSettings = pWorkItem.Settings || {};
		if (tmpSettings.Method !== 'GET')
		{
			return setImmediate(() => fCallback(new Error(`unexpected dispatch: ${tmpSettings.Method} ${tmpSettings.Path}`)));
		}
		tmpLedger.reads++;
		tmpLedger.paths.push(tmpSettings.Path);
		const tmpVerdict = pReadBehavior(tmpLedger.reads, tmpSettings.Path) || {};
		if (tmpVerdict.Error)
		{
			return setImmediate(() => fCallback(new Error(tmpVerdict.Error)));
		}
		const tmpBody = (tmpVerdict.Body === undefined) ? '[]' : tmpVerdict.Body;
		return setImmediate(() => fCallback(null, { Outputs: { Status: (tmpVerdict.Status === undefined) ? 200 : tmpVerdict.Status, Body: tmpBody } }));
	};
	return { handlers: tmpHandlers, ledger: tmpLedger };
}

function runPull(pHarness, pSettings)
{
	return new Promise((fResolve) =>
		pHarness.handlers['DataMapperRecords:PullRecords'].Handler(
			{ Settings: pSettings }, {},
			(pError, pResult) => fResolve({ Error: pError, Outputs: (pResult || {}).Outputs, Log: (pResult || {}).Log })));
}

function baseSettings(pOverrides)
{
	return Object.assign({ SourceBeaconName: BEACON, ConnectionHash: CONNECTION, Entity: ENTITY, BatchSize: 2 }, pOverrides || {});
}

function makeRows(pCount, pStartID)
{
	let tmpRows = [];
	for (let i = 0; i < pCount; i++)
	{
		tmpRows.push({ ['ID' + ENTITY]: (pStartID || 0) + i, Moisture: 12.5 });
	}
	return tmpRows;
}

suite
(
	'Data Mapper - PullRecords Failure Surfacing',
	() =>
	{
		suite
		(
			'the only shape that means a successful read',
			() =>
			{
				test
				(
					'a 200 with a JSON array of records succeeds',
					async () =>
					{
						const tmpHarness = buildPullHarness((pBatch) =>
							(pBatch === 1) ? { Body: JSON.stringify(makeRows(2, 1)) } : { Body: JSON.stringify(makeRows(1, 3)) });
						const tmpResult = await runPull(tmpHarness, baseSettings());
						libAssert.ok(!tmpResult.Error, 'a well-formed paginated read must succeed');
						libAssert.strictEqual(tmpResult.Outputs.RecordCount, 3);
						libAssert.strictEqual(JSON.parse(tmpResult.Outputs.Result).length, 3);
					}
				);
				test
				(
					'a genuinely empty source still succeeds and emits Result \'[]\' — the case that must not regress',
					async () =>
					{
						const tmpHarness = buildPullHarness(() => ({ Status: 200, Body: '[]' }));
						const tmpResult = await runPull(tmpHarness, baseSettings());
						libAssert.ok(!tmpResult.Error, 'an empty source is a valid result, not a failure');
						libAssert.strictEqual(tmpResult.Outputs.RecordCount, 0);
						libAssert.strictEqual(tmpResult.Outputs.Result, '[]');
					}
				);
				test
				(
					'an already-parsed array body succeeds too',
					async () =>
					{
						const tmpHarness = buildPullHarness(() => ({ Status: 200, Body: makeRows(1, 1) }));
						const tmpResult = await runPull(tmpHarness, baseSettings());
						libAssert.ok(!tmpResult.Error);
						libAssert.strictEqual(tmpResult.Outputs.RecordCount, 1);
					}
				);
			}
		);

		suite
		(
			'a pull that cannot address a source fails by name',
			() =>
			{
				test
				(
					'each missing setting is named in the failure',
					async () =>
					{
						for (const tmpSetting of [ 'SourceBeaconName', 'ConnectionHash', 'Entity' ])
						{
							const tmpHarness = buildPullHarness(() => ({ Body: '[]' }));
							const tmpSettings = baseSettings();
							delete tmpSettings[tmpSetting];
							const tmpResult = await runPull(tmpHarness, tmpSettings);
							libAssert.ok(tmpResult.Error, `a missing ${tmpSetting} must fail the task`);
							libAssert.match(tmpResult.Error.message, new RegExp(tmpSetting));
							libAssert.strictEqual(tmpHarness.ledger.reads, 0, 'nothing should have been dispatched');
						}
					}
				);
				test
				(
					'several missing settings are all named at once',
					async () =>
					{
						const tmpHarness = buildPullHarness(() => ({ Body: '[]' }));
						const tmpResult = await runPull(tmpHarness, { BatchSize: 2 });
						libAssert.ok(tmpResult.Error);
						libAssert.match(tmpResult.Error.message, /SourceBeaconName, ConnectionHash, Entity/);
					}
				);
				test
				(
					'an unconnected beacon fails rather than reporting an empty read',
					async () =>
					{
						const tmpHarness = buildPullHarness(() => ({ Body: '[]' }), { NoClient: true });
						const tmpResult = await runPull(tmpHarness, baseSettings());
						libAssert.ok(tmpResult.Error, 'no ultravisor client must fail the task');
						libAssert.match(tmpResult.Error.message, /no ultravisor client/i);
					}
				);
			}
		);

		suite
		(
			'a body that is not an array of records fails',
			() =>
			{
				test
				(
					'HTTP 200 with an error payload says so — the platform API answers auth failures this way',
					async () =>
					{
						const tmpHarness = buildPullHarness(() => ({ Status: 200, Body: '{"Error":"You must be authenticated to access this resource."}' }));
						const tmpResult = await runPull(tmpHarness, baseSettings());
						libAssert.ok(tmpResult.Error, 'a 200 carrying an error object must fail the task');
						libAssert.match(tmpResult.Error.message, /answered HTTP 200 with an error payload/);
						libAssert.match(tmpResult.Error.message, /must be authenticated/);
					}
				);
				test
				(
					'a non-array JSON body fails rather than becoming an empty page',
					async () =>
					{
						libAssert.throws(() => _resolvePullBody(200, '{"Count":0}', 0), /not an array of records/);
						libAssert.throws(() => _resolvePullBody(200, '"[]"', 0), /not an array of records/);
						libAssert.throws(() => _resolvePullBody(200, null, 0), /not an array of records/);
					}
				);
				test
				(
					'an unparseable body fails and reports what arrived',
					async () =>
					{
						libAssert.throws(() => _resolvePullBody(200, '[{"ID":1},{"ID":', 0), /unparseable body/);
						libAssert.throws(() => _resolvePullBody(200, '', 0), /unparseable body/);
					}
				);
				test
				(
					'an array body resolves, whether serialized or not',
					() =>
					{
						libAssert.deepStrictEqual(_resolvePullBody(200, '[]', 0), []);
						libAssert.deepStrictEqual(_resolvePullBody(200, [ { ID: 1 } ], 0), [ { ID: 1 } ]);
					}
				);
				test
				(
					'a mid-pull non-array body fails instead of truncating the result',
					async () =>
					{
						const tmpHarness = buildPullHarness((pBatch) =>
							(pBatch === 1) ? { Body: JSON.stringify(makeRows(2, 1)) } : { Status: 200, Body: '{"Error":"session expired"}' });
						const tmpResult = await runPull(tmpHarness, baseSettings());
						libAssert.ok(tmpResult.Error, 'a page that is not an array must fail the pull');
						libAssert.match(tmpResult.Error.message, /offset 2/);
					}
				);
			}
		);

		suite
		(
			'non-2xx statuses fail once the sort-filter fallback is spent',
			() =>
			{
				test
				(
					'the first-batch 404 sort-filter fallback still runs before any failure',
					async () =>
					{
						const tmpHarness = buildPullHarness((pBatch, pPath) =>
							(/FilteredTo/.test(pPath)) ? { Status: 404, Body: '{"Error":"not found"}' } : { Status: 200, Body: JSON.stringify(makeRows(1, 1)) });
						const tmpResult = await runPull(tmpHarness, baseSettings());
						libAssert.ok(!tmpResult.Error, 'a source without /FilteredTo support must still pull');
						libAssert.strictEqual(tmpResult.Outputs.RecordCount, 1);
						libAssert.strictEqual(tmpHarness.ledger.reads, 2);
						libAssert.ok(/FilteredTo/.test(tmpHarness.ledger.paths[0]));
						libAssert.ok(!/FilteredTo/.test(tmpHarness.ledger.paths[1]));
					}
				);
				test
				(
					'a 404 that survives the fallback fails, and points at the likely cause',
					async () =>
					{
						const tmpHarness = buildPullHarness(() => ({ Status: 404, Body: '{"Error":"not found"}' }));
						const tmpResult = await runPull(tmpHarness, baseSettings());
						libAssert.ok(tmpResult.Error, 'a persistent 404 must fail the pull');
						libAssert.match(tmpResult.Error.message, /HTTP 404/);
						libAssert.match(tmpResult.Error.message, /deleted source connection|dynamic endpoint/);
						libAssert.strictEqual(tmpHarness.ledger.reads, 2, 'the fallback is tried exactly once, then it fails');
					}
				);
				test
				(
					'a 401 fails immediately without retrying',
					async () =>
					{
						const tmpHarness = buildPullHarness(() => ({ Status: 401, Body: '{"Error":"unauthorized"}' }));
						const tmpResult = await runPull(tmpHarness, baseSettings());
						libAssert.ok(tmpResult.Error);
						libAssert.match(tmpResult.Error.message, /HTTP 401/);
						libAssert.strictEqual(tmpHarness.ledger.reads, 1);
					}
				);
				test
				(
					'a 500 is still retried twice, then fails as an error rather than a success',
					async () =>
					{
						const tmpHarness = buildPullHarness(() => ({ Status: 503, Body: 'gateway down' }));
						const tmpResult = await runPull(tmpHarness, baseSettings());
						libAssert.ok(tmpResult.Error, 'an exhausted retry must fail the task, not report Errors: 1 on a success');
						libAssert.match(tmpResult.Error.message, /HTTP 503/);
						libAssert.match(tmpResult.Error.message, /3 attempt/);
						libAssert.strictEqual(tmpHarness.ledger.reads, 3);
					}
				);
				test
				(
					'a 500 that clears on retry still succeeds',
					async () =>
					{
						const tmpHarness = buildPullHarness((pBatch) =>
							(pBatch === 1) ? { Status: 500, Body: 'boom' } : { Status: 200, Body: JSON.stringify(makeRows(1, 1)) });
						const tmpResult = await runPull(tmpHarness, baseSettings());
						libAssert.ok(!tmpResult.Error);
						libAssert.strictEqual(tmpResult.Outputs.RecordCount, 1);
					}
				);
			}
		);

		suite
		(
			'a dispatch error never returns the rows it already had',
			() =>
			{
				test
				(
					'a mid-pull dispatch error fails with the offset and the underlying message',
					async () =>
					{
						const tmpHarness = buildPullHarness((pBatch) =>
							(pBatch === 1) ? { Body: JSON.stringify(makeRows(2, 1)) } : { Error: 'socket hang up' });
						const tmpResult = await runPull(tmpHarness, baseSettings());
						libAssert.ok(tmpResult.Error, 'a dispatch error must fail the task');
						libAssert.match(tmpResult.Error.message, /socket hang up/);
						libAssert.match(tmpResult.Error.message, /offset 2/);
						libAssert.strictEqual(tmpResult.Outputs, undefined, 'partial rows must not be returned as a result');
					}
				);
			}
		);
	}
);
