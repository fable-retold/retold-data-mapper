/**
 * Retold Data Mapper — WriteRecords ResetMode='Replace' Suite
 *
 * Replace mode is the new pipeline's answer to the legacy
 * truncate-and-reinsert: after a successful upsert of the full current
 * comprehension, existing rows whose GUID is NOT in the comprehension are
 * soft-deleted via meadow's DELETE-by-id surface — dead aggregates are
 * purged without a transaction or a destructive truncate. These tests pin
 * the purge conversation at the MeadowProxy dispatch seam.
 */
const libAssert = require('assert');
const libPict = require('pict');
const libBeaconProvider = require('../source/services/DataMapper-BeaconProvider.js');

function buildHarness(pExistingRows)
{
	let tmpHandlers = {};
	let tmpStubBeacon =
	{
		registerCapability: function (pSpec)
		{
			for (const tmpKey of Object.keys(pSpec.actions || {}))
			{
				tmpHandlers[pSpec.Capability + ':' + tmpKey] = pSpec.actions[tmpKey];
			}
		}
	};
	let tmpFable = new libPict({ Product: 'ReplaceModeTest', LogStreams: [ { streamtype: 'console', level: 'fatal' } ] });
	tmpFable.serviceManager.addServiceType('DataMapperBeaconProvider', libBeaconProvider);
	let tmpProvider = tmpFable.serviceManager.instantiateServiceProvider('DataMapperBeaconProvider');
	tmpProvider.registerCapabilities(tmpStubBeacon);

	tmpProvider._Client = {};
	const tmpLedger = { upserts: [], pageReads: [], deletes: [] };
	tmpProvider._dispatch = (pWorkItem, fCallback) =>
	{
		const tmpSettings = pWorkItem.Settings || {};
		if (tmpSettings.Method === 'PUT' && /\/Upserts$/.test(tmpSettings.Path))
		{
			tmpLedger.upserts.push(tmpSettings.Path);
			return fCallback(null, { Status: 200, Body: '{}' });
		}
		if (tmpSettings.Method === 'GET')
		{
			tmpLedger.pageReads.push(tmpSettings.Path);
			const tmpOffset = parseInt(tmpSettings.Path.split('/').slice(-2)[0], 10) || 0;
			const tmpPage = (tmpOffset === 0) ? pExistingRows : [];
			return fCallback(null, { Status: 200, Body: JSON.stringify(tmpPage) });
		}
		if (tmpSettings.Method === 'DELETE')
		{
			tmpLedger.deletes.push(tmpSettings.Path);
			return fCallback(null, { Status: 200, Body: '{"Count":1}' });
		}
		return fCallback(new Error(`unexpected dispatch: ${tmpSettings.Method} ${tmpSettings.Path}`));
	};
	return { handlers: tmpHandlers, ledger: tmpLedger };
}

function writeRecords(pHarness, pResetMode)
{
	return new Promise((fResolve) =>
		pHarness.handlers['DataMapperRecords:WriteRecords'].Handler(
			{
				Settings:
				{
					TargetBeaconName: 'lake-beacon', ConnectionHash: 'private-data-lake', Entity: 'AggDaily',
					Comprehension: { AggDaily: { 'DLY_A': { GUIDAggDaily: 'DLY_A', Sum: 5 }, 'DLY_B': { GUIDAggDaily: 'DLY_B', Sum: 7 } } },
					GUIDName: 'GUIDAggDaily',
					ResetMode: pResetMode
				}
			}, {},
			(pError, pResult) => fResolve({ Error: pError, Result: pResult })));
}

suite('WriteRecords ResetMode=Replace (dead-aggregate purge)', function ()
{
	test('orphaned rows are deleted; live rows are kept', async function ()
	{
		const tmpHarness = buildHarness([
			{ IDAggDaily: 1, GUIDAggDaily: 'DLY_A' },
			{ IDAggDaily: 2, GUIDAggDaily: 'DLY_DEAD' },
			{ IDAggDaily: 3, GUIDAggDaily: 'DLY_B' }
		]);
		const tmpOutcome = await writeRecords(tmpHarness, 'Replace');
		libAssert.strictEqual(tmpOutcome.Error, null);
		libAssert.ok(tmpHarness.ledger.upserts.length >= 1, 'upsert happens first');
		libAssert.ok(tmpHarness.ledger.pageReads.length >= 1, 'existing rows are paged');
		libAssert.deepStrictEqual(tmpHarness.ledger.deletes, [ '/1.0/private-data-lake/AggDaily/2' ],
			'exactly the dead GUID is deleted, by primary key');
		const tmpLog = (tmpOutcome.Result.Log || []).join(' ');
		libAssert.match(tmpLog, /1 orphans purged/);
	});

	test('Append mode performs no page reads and no deletes', async function ()
	{
		const tmpHarness = buildHarness([ { IDAggDaily: 2, GUIDAggDaily: 'DLY_DEAD' } ]);
		const tmpOutcome = await writeRecords(tmpHarness, 'Append');
		libAssert.strictEqual(tmpOutcome.Error, null);
		libAssert.strictEqual(tmpHarness.ledger.pageReads.length, 0);
		libAssert.strictEqual(tmpHarness.ledger.deletes.length, 0);
	});

	test('a failed existing-rows fetch skips the purge without failing the write', async function ()
	{
		const tmpHarness = buildHarness([]);
		const tmpInnerDispatch = tmpHarness.handlers['DataMapperRecords:WriteRecords'];
		// Rewire GETs to fail; upserts still succeed.
		const tmpLedger = tmpHarness.ledger;
		const tmpProviderDispatchOwner = tmpInnerDispatch.Handler;
		// Simplest: rebuild with a failing GET stub.
		let tmpHandlers = {};
		const libPictB = require('pict');
		let tmpFable = new libPictB({ Product: 'ReplaceModeTestB', LogStreams: [ { streamtype: 'console', level: 'fatal' } ] });
		tmpFable.serviceManager.addServiceType('DataMapperBeaconProvider', libBeaconProvider);
		let tmpProvider = tmpFable.serviceManager.instantiateServiceProvider('DataMapperBeaconProvider');
		tmpProvider.registerCapabilities({ registerCapability: (pSpec) => { for (const k of Object.keys(pSpec.actions || {})) { tmpHandlers[pSpec.Capability + ':' + k] = pSpec.actions[k]; } } });
		tmpProvider._Client = {};
		const tmpDeletes = [];
		tmpProvider._dispatch = (pWorkItem, fCallback) =>
		{
			const tmpSettings = pWorkItem.Settings || {};
			if (tmpSettings.Method === 'PUT') { return fCallback(null, { Status: 200, Body: '{}' }); }
			if (tmpSettings.Method === 'GET') { return fCallback(new Error('beacon flaked')); }
			if (tmpSettings.Method === 'DELETE') { tmpDeletes.push(tmpSettings.Path); return fCallback(null, { Status: 200, Body: '{}' }); }
			return fCallback(new Error('unexpected'));
		};
		const tmpOutcome = await new Promise((fResolve) =>
			tmpHandlers['DataMapperRecords:WriteRecords'].Handler(
				{ Settings: { TargetBeaconName: 'b', ConnectionHash: 'c', Entity: 'AggDaily', Comprehension: { AggDaily: { 'DLY_A': { GUIDAggDaily: 'DLY_A' } } }, GUIDName: 'GUIDAggDaily', ResetMode: 'Replace' } }, {},
				(pError, pResult) => fResolve({ Error: pError, Result: pResult })));
		libAssert.strictEqual(tmpOutcome.Error, null, 'the write itself succeeds');
		libAssert.strictEqual(tmpDeletes.length, 0, 'no deletes when the live-set fetch failed (fail-safe)');
	});
});

function writeWithSettings(pHarness, pSettings)
{
	return new Promise((fResolve) =>
		pHarness.handlers['DataMapperRecords:WriteRecords'].Handler(
			{ Settings: pSettings }, {},
			(pError, pResult) => fResolve({ Error: pError, Result: pResult })));
}

// The live set (what this run wrote) and the target scan (what is already
// there) have to read the identity off the same column, or they are disjoint
// by construction and the purge deletes the whole table — including the rows
// the same call just wrote.
suite('WriteRecords ResetMode=Replace (live-set identity)', function ()
{
	const ENTITY = 'C10_SpecYear2026_XformProof';
	const RECORDS =
	[
		{ EntityName: 'Material', RecordGUID: 'LADOTD-Material-0001', RecordJSON: '{}' },
		{ EntityName: 'Material', RecordGUID: 'LADOTD-Material-0002', RecordJSON: '{}' }
	];

	function replaceSettings(pOverrides)
	{
		return Object.assign(
			{
				TargetBeaconName: 'private_data_lake_beacon', ConnectionHash: 'private-data-lake',
				Entity: ENTITY, GUIDName: 'RecordGUID', ResetMode: 'Replace', Records: RECORDS
			}, pOverrides || {});
	}

	test('Records[] + a GUIDName other than GUID<Entity> purges nothing against an empty target', async function ()
	{
		const tmpHarness = buildHarness([]);
		const tmpOutcome = await writeWithSettings(tmpHarness, replaceSettings());
		libAssert.strictEqual(tmpOutcome.Error, null);
		libAssert.deepStrictEqual(tmpHarness.ledger.deletes, [], 'the rows just written are not orphans');
		libAssert.strictEqual(tmpOutcome.Result.Outputs.OrphansDeleted, 0);
	});

	test('Records[] + a GUIDName other than GUID<Entity> deletes only genuinely stale rows', async function ()
	{
		const tmpHarness = buildHarness([
			{ ['ID' + ENTITY]: 1, RecordGUID: 'LADOTD-Material-0001' },
			{ ['ID' + ENTITY]: 2, RecordGUID: 'LADOTD-Material-DEAD' },
			{ ['ID' + ENTITY]: 3, RecordGUID: 'LADOTD-Material-0002' }
		]);
		const tmpOutcome = await writeWithSettings(tmpHarness, replaceSettings());
		libAssert.strictEqual(tmpOutcome.Error, null);
		libAssert.deepStrictEqual(tmpHarness.ledger.deletes, [ `/1.0/private-data-lake/${ENTITY}/2` ],
			'only the row absent from this run is purged, by primary key');
		libAssert.strictEqual(tmpOutcome.Result.Outputs.OrphansDeleted, 1);
	});

	test('a record with no value at GUIDName skips the purge entirely and says why', async function ()
	{
		const tmpHarness = buildHarness([
			{ ['ID' + ENTITY]: 1, RecordGUID: 'LADOTD-Material-0001' },
			{ ['ID' + ENTITY]: 2, RecordGUID: 'LADOTD-Material-DEAD' }
		]);
		const tmpOutcome = await writeWithSettings(tmpHarness, replaceSettings(
			{ Records: RECORDS.concat([ { EntityName: 'Material', RecordJSON: '{}' } ]) }));
		libAssert.strictEqual(tmpOutcome.Error, null);
		libAssert.strictEqual(tmpHarness.ledger.upserts.length, 1, 'the write still happens');
		libAssert.deepStrictEqual(tmpHarness.ledger.deletes, [], 'nothing is purged against an incomplete live set');
		libAssert.deepStrictEqual(tmpOutcome.Result.Outputs.PurgeSkipped, [ ENTITY ]);
		libAssert.match(JSON.stringify(tmpOutcome.Result.Outputs.ErrorLog), /1 of 3 records carry no value at 'RecordGUID'/);
		libAssert.match(tmpOutcome.Result.Log.join(' '), /orphan purge SKIPPED/);
	});

	test('a comprehension keyed off a different field than GUIDName still purges by GUIDName', async function ()
	{
		const tmpHarness = buildHarness([
			{ ['ID' + ENTITY]: 7, RecordGUID: 'LADOTD-Material-0001' },
			{ ['ID' + ENTITY]: 8, RecordGUID: 'LADOTD-Material-DEAD' }
		]);
		let tmpComprehension = {};
		tmpComprehension[ENTITY] = { 'record-0': RECORDS[0], 'record-1': RECORDS[1] };
		const tmpOutcome = await writeWithSettings(tmpHarness, replaceSettings({ Records: null, Comprehension: tmpComprehension }));
		libAssert.strictEqual(tmpOutcome.Error, null);
		libAssert.deepStrictEqual(tmpHarness.ledger.deletes, [ `/1.0/private-data-lake/${ENTITY}/8` ],
			'the comprehension key is not identity — the record payload is');
	});

	test('OrphansDeleted is reported under Replace even when it is zero', async function ()
	{
		const tmpHarness = buildHarness([]);
		const tmpOutcome = await writeWithSettings(tmpHarness, replaceSettings());
		libAssert.strictEqual(tmpOutcome.Result.Outputs.OrphansDeleted, 0);
		libAssert.strictEqual(tmpOutcome.Result.Outputs.OrphanErrors, 0);
		const tmpAppend = await writeWithSettings(buildHarness([]), replaceSettings({ ResetMode: 'Append' }));
		libAssert.strictEqual(tmpAppend.Result.Outputs.OrphansDeleted, undefined, 'Append reports no orphan stats at all');
	});
});
