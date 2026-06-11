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
