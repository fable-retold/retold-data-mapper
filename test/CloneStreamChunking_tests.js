/**
 * Retold Data Mapper — CloneStream record chunking Suite
 *
 * `OperationConfiguration.ChunkSize` writes one target row per N projected records instead of one
 * row per record. The target's per-row cost dominates a large clone — meadow-endpoints upserts
 * serially within a request — so collapsing 190K rows to ~380 is the throughput lever.
 *
 * It also concentrates risk: a dropped write that used to cost one record now costs ChunkSize of
 * them, and `WriteRecords` has twice reported success while losing whole chunks. So every chunk
 * row carries the totals the stream expects to produce, letting a reader prove the table complete
 * before it yields anything. These tests pin that contract, and pin that ChunkSize absent leaves
 * the row-per-record path untouched.
 */
const libAssert = require('assert');
const libPict = require('pict');
const libBeaconProvider = require('../source/services/DataMapper-BeaconProvider.js');

/**
 * Run CloneStream over a generated source and collect every upsert body.
 *
 * @param {number} pSourceRows
 * @param {object} pOperationConfiguration
 * @param {number} [pBatchSize]
 * @return {Promise<{ Rows: Array<object>, Outputs: object, Puts: number, CountRequested: boolean }>}
 */
function runCloneStream(pSourceRows, pOperationConfiguration, pBatchSize)
{
	return new Promise((fResolve, fReject) =>
	{
		let tmpHandlers = {};
		let tmpFable = new libPict({ Product: 'CloneStreamChunkTest', LogStreams: [ { streamtype: 'console', level: 'fatal' } ] });
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

		const tmpBatchSize = pBatchSize || 500;
		let tmpUpserted = [];
		let tmpPuts = 0;
		let tmpCountRequested = false;
		tmpProvider._Client = {};
		tmpProvider._dispatch = (pWorkItem, fCallback) =>
		{
			const tmpSettings = pWorkItem.Settings || {};
			if (tmpSettings.Method === 'GET' && /\/Count(\/|$)/.test(tmpSettings.Path))
			{
				tmpCountRequested = true;
				return setImmediate(() => fCallback(null, { Outputs: { Status: 200, Body: JSON.stringify({ Count: pSourceRows }) } }));
			}
			if (tmpSettings.Method === 'GET')
			{
				const tmpMatch = tmpSettings.Path.match(/\/(\d+)\/(\d+)$/);
				const tmpOffset = tmpMatch ? parseInt(tmpMatch[1], 10) : 0;
				const tmpRows = [];
				for (let i = tmpOffset; (i < pSourceRows) && (tmpRows.length < tmpBatchSize); i++)
				{
					tmpRows.push({ IDPlanRow: i + 1, ItemCode: `ITEM-${i + 1}`, MaterialCode: `MAT-${i + 1}` });
				}
				return setImmediate(() => fCallback(null, { Outputs: { Status: 200, Body: JSON.stringify(tmpRows) } }));
			}
			if (tmpSettings.Method === 'PUT')
			{
				tmpPuts++;
				const tmpBody = JSON.parse(tmpSettings.Body);
				tmpUpserted = tmpUpserted.concat(tmpBody);
				return setImmediate(() => fCallback(null,
					{ Outputs: { Status: 200, Body: '{}', Headers: { 'x-meadow-upsert-succeeded': String(tmpBody.length), 'x-meadow-upsert-errored': '0' } } }));
			}
			return setImmediate(() => fCallback(null, { Outputs: { Status: 200, Body: '{}' } }));
		};

		tmpHandlers['DataMapperRecords:CloneStream'].Handler(
			{
				Settings:
				{
					SourceBeaconName: 'src', SourceConnectionHash: 'src-conn', SourceEntity: 'PlanRow',
					TargetBeaconName: 'tgt', TargetConnectionHash: 'tgt-conn', TargetEntity: 'PlanComp',
					GUIDName: 'GUIDPlanComp', BatchSize: tmpBatchSize, SortField: '',
					OperationConfiguration: JSON.stringify(pOperationConfiguration)
				}
			},
			{},
			(pError, pResult) =>
			{
				if (pError)
				{
					return fReject(pError);
				}
				return fResolve({ Rows: tmpUpserted, Outputs: (pResult || {}).Outputs || {}, Puts: tmpPuts, CountRequested: tmpCountRequested });
			},
			() => {});
	});
}

const CHUNKED_CONFIG =
	{
		Entity: 'PayItemMaterialTestRequirement',
		ChunkSize: 100,
		Projection: { ItemCode: '{~D:Record.ItemCode~}', _GUIDMaterial: 'LADOTD-Material-{~D:Record.MaterialCode~}' }
	};

suite('CloneStream record chunking', function ()
{
	this.timeout(20000);

	test('ChunkSize absent leaves the row-per-record path untouched', async function ()
	{
		const tmpResult = await runCloneStream(250, { GUIDTemplate: 'PC_{~D:Record.IDPlanRow~}', Projection: { ItemCode: '{~D:Record.ItemCode~}' } });
		libAssert.strictEqual(tmpResult.Rows.length, 250);
		libAssert.strictEqual(tmpResult.CountRequested, false, 'an unchunked run must not pay for the count request');
		libAssert.strictEqual(tmpResult.Outputs.ChunkCount, undefined);
	});

	test('a whole number of chunks writes one row per chunk', async function ()
	{
		const tmpResult = await runCloneStream(1000, CHUNKED_CONFIG);
		libAssert.strictEqual(tmpResult.Rows.length, 10);
		libAssert.strictEqual(tmpResult.Rows[0].RecordCount, 100);
		libAssert.strictEqual(JSON.parse(tmpResult.Rows[0].RecordsJSON).length, 100);
	});

	test('a trailing partial chunk is flushed, not dropped', async function ()
	{
		// The bug this pins: buffered records with no full chunk left to drain
		// simply never get written, and the run reports success.
		const tmpResult = await runCloneStream(1050, CHUNKED_CONFIG);
		libAssert.strictEqual(tmpResult.Rows.length, 11);
		libAssert.strictEqual(tmpResult.Rows[10].RecordCount, 50);
		const tmpTotal = tmpResult.Rows.reduce((pSum, pRow) => pSum + pRow.RecordCount, 0);
		libAssert.strictEqual(tmpTotal, 1050);
	});

	test('chunks buffer across pull batches rather than following them', async function ()
	{
		// ChunkSize larger than BatchSize is the case that matters — it is what
		// collapses the row count, and it only works if the buffer survives a batch.
		const tmpResult = await runCloneStream(1000, Object.assign({}, CHUNKED_CONFIG, { ChunkSize: 400 }), 100);
		libAssert.strictEqual(tmpResult.Rows.length, 3);
		libAssert.deepStrictEqual(tmpResult.Rows.map((pRow) => pRow.RecordCount), [ 400, 400, 200 ]);
	});

	test('ordinals are contiguous from zero and the GUID is derived from them', async function ()
	{
		const tmpResult = await runCloneStream(1050, CHUNKED_CONFIG);
		libAssert.deepStrictEqual(tmpResult.Rows.map((pRow) => pRow.ChunkOrdinal), [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ]);
		libAssert.strictEqual(tmpResult.Rows[0].GUIDPlanComp, 'PayItemMaterialTestRequirement-000000000');
		libAssert.strictEqual(tmpResult.Rows[10].GUIDPlanComp, 'PayItemMaterialTestRequirement-000000010');
	});

	test('every chunk row carries the totals a reader needs to prove completeness', async function ()
	{
		const tmpResult = await runCloneStream(1050, CHUNKED_CONFIG);
		for (const tmpRow of tmpResult.Rows)
		{
			libAssert.strictEqual(tmpRow.EntityName, 'PayItemMaterialTestRequirement');
			libAssert.strictEqual(tmpRow.ChunkCount, 11);
			libAssert.strictEqual(tmpRow.SourceRowCount, 1050);
		}
		// A reader holding any single row can now check all three invariants.
		const tmpSum = tmpResult.Rows.reduce((pSum, pRow) => pSum + pRow.RecordCount, 0);
		libAssert.strictEqual(tmpResult.Rows.length, tmpResult.Rows[0].ChunkCount);
		libAssert.strictEqual(tmpSum, tmpResult.Rows[0].SourceRowCount);
	});

	test('the projection still runs per record inside a chunk', async function ()
	{
		const tmpResult = await runCloneStream(100, CHUNKED_CONFIG);
		const tmpRecords = JSON.parse(tmpResult.Rows[0].RecordsJSON);
		libAssert.strictEqual(tmpRecords[0].ItemCode, 'ITEM-1');
		libAssert.strictEqual(tmpRecords[0]._GUIDMaterial, 'LADOTD-Material-MAT-1');
		libAssert.strictEqual(tmpRecords[99]._GUIDMaterial, 'LADOTD-Material-MAT-100');
	});

	test('counts are reported in records, and chunk totals alongside', async function ()
	{
		const tmpResult = await runCloneStream(1050, CHUNKED_CONFIG);
		libAssert.strictEqual(tmpResult.Outputs.Pulled, 1050);
		libAssert.strictEqual(tmpResult.Outputs.Written, 1050, 'Written must stay in records, not chunk rows');
		libAssert.strictEqual(tmpResult.Outputs.Errors, 0);
		libAssert.strictEqual(tmpResult.Outputs.ChunksWritten, 11);
		libAssert.strictEqual(tmpResult.Outputs.ChunkCount, 11);
	});

	test('chunking collapses the target row count by the chunk factor', async function ()
	{
		const tmpResult = await runCloneStream(1000, CHUNKED_CONFIG);
		libAssert.strictEqual(tmpResult.Rows.length, 10, '1000 records land as 10 rows');
		libAssert.ok(tmpResult.Puts <= 10, `expected at most one PUT per chunk, got ${tmpResult.Puts}`);
	});
});
