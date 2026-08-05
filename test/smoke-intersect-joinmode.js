#!/usr/bin/env node
'use strict';
/**
 * Smoke test — IntersectRecords JoinMode through a whole pipeline.
 *
 * The unit suite pins the handler. This drives the shape a real operation
 * uses: Intersect → (State edge, JSON round trip) → BuildComprehension →
 * WriteRecords, with the mesh dispatch stubbed. It exists to catch the things
 * that only show up once the delete set has to survive the next three stages —
 * State serialization, comprehension keying, and the write body.
 *
 *   node test/smoke-intersect-joinmode.js
 */
const libPict = require('pict');
const libBeaconProvider = require('../source/services/DataMapper-BeaconProvider.js');

let _Pass = 0;
let _Fail = 0;

function check(pLabel, pCondition, pDetail)
{
	if (pCondition)
	{
		_Pass++;
		console.log(`  [ok]   ${pLabel}`);
	}
	else
	{
		_Fail++;
		console.log(`  [fail] ${pLabel}${pDetail ? ' — ' + pDetail : ''}`);
	}
}

function buildRig()
{
	let tmpHandlers = {};
	let tmpFable = new libPict({ Product: 'IntersectSmoke', LogStreams: [ { streamtype: 'console', level: 'fatal' } ] });
	tmpFable.serviceManager.addServiceType('DataMapperBeaconProvider', libBeaconProvider);
	let tmpProvider = tmpFable.serviceManager.instantiateServiceProvider('DataMapperBeaconProvider');
	tmpProvider.registerCapabilities(
		{
			registerCapability: (pSpec) =>
			{
				for (const tmpKey of Object.keys(pSpec.actions || {}))
				{
					tmpHandlers[pSpec.Capability + ':' + tmpKey] = pSpec.actions[tmpKey];
				}
			}
		});
	let tmpWritten = [];
	let tmpDeleted = [];
	let tmpNextID = 1;
	tmpProvider._Client = {};
	tmpProvider._dispatch = (pWorkItem, fCallback) =>
	{
		const tmpSettings = pWorkItem.Settings || {};
		if (tmpSettings.Method === 'PUT' && /\/Upserts$/.test(tmpSettings.Path))
		{
			JSON.parse(tmpSettings.Body).forEach((pRow) =>
			{
				let tmpRow = Object.assign({ IDSpecYearDelete: tmpNextID++ }, pRow);
				tmpWritten.push(tmpRow);
			});
			return setImmediate(() => fCallback(null, { Outputs: { Status: 200, Body: '{}' } }));
		}
		// The target's paged list, so ResetMode=Replace runs its real purge
		// pass instead of tripping the fail-safe skip on a failed fetch.
		let tmpList = tmpSettings.Path && tmpSettings.Path.match(/^\/1\.0\/[^/]+\/(.+)s\/(\d+)\/(\d+)$/);
		if (tmpSettings.Method === 'GET' && tmpList)
		{
			const tmpOffset = parseInt(tmpList[2], 10);
			const tmpLimit = parseInt(tmpList[3], 10);
			const tmpPage = tmpWritten.slice(tmpOffset, tmpOffset + tmpLimit);
			return setImmediate(() => fCallback(null, { Outputs: { Status: 200, Body: JSON.stringify(tmpPage) } }));
		}
		if (tmpSettings.Method === 'DELETE')
		{
			tmpDeleted.push(tmpSettings.Path);
			return setImmediate(() => fCallback(null, { Outputs: { Status: 200, Body: '{}' } }));
		}
		return fCallback(new Error(`smoke: unexpected ${tmpSettings.Method} ${tmpSettings.Path}`));
	};
	return { handlers: tmpHandlers, written: tmpWritten, deleted: tmpDeleted };
}

function run(pRig, pAction, pSettings)
{
	return new Promise((fResolve, fReject) =>
		pRig.handlers[pAction].Handler({ Settings: pSettings }, {},
			(pError, pResult) => pError ? fReject(pError) : fResolve(pResult)));
}

// A spec year the customer has revised: most pay items survive, some are
// dropped, and a handful of platform rows have a blank item code from a bad
// historical load.
function buildFixture(pPlatformCount, pDroppedCount, pBlankKeyCount)
{
	let tmpPlatform = [];
	let tmpWorkbook = [];
	for (let i = 0; i < pPlatformCount; i++)
	{
		let tmpCode = `LADOTD-Item-${String(i).padStart(6, '0')}`;
		tmpPlatform.push({ ItemCode: tmpCode, SpecYear: 2026, ExistingNote: 'platform row ' + i });
		if (i >= pDroppedCount)
		{
			tmpWorkbook.push({ LookupItemCode: tmpCode, Requirement: 'AASHTO T' + (i % 97) });
		}
	}
	for (let b = 0; b < pBlankKeyCount; b++)
	{
		tmpPlatform.push({ ItemCode: (b % 2 === 0) ? null : '   ', SpecYear: 2026, ExistingNote: 'bad historical row ' + b });
	}
	return { platform: tmpPlatform, workbook: tmpWorkbook };
}

const PLATFORM_ROWS = 5000;
const DROPPED_ROWS = 37;
const BLANK_KEY_ROWS = 4;

(async function main()
{
	const tmpFixture = buildFixture(PLATFORM_ROWS, DROPPED_ROWS, BLANK_KEY_ROWS);
	console.log('IntersectRecords JoinMode — pipeline smoke');
	console.log(`  fixture: ${tmpFixture.platform.length} platform rows (${BLANK_KEY_ROWS} with no usable key), ${tmpFixture.workbook.length} workbook rows, ${DROPPED_ROWS} requirements dropped\n`);

	const tmpConfig = (pOverrides) => Object.assign(
		{
			Entity: 'SpecYearDelete',
			GUIDTemplate: 'SYD-{~D:Source.ItemCode~}',
			JoinOn: { SourceField: 'ItemCode', RelatedField: 'LookupItemCode' },
			Projection: { ItemCode: '{~D:Source.ItemCode~}', SpecYear: '{~D:Source.SpecYear~}', Requirement: '{~D:Related.Requirement~}' }
		}, pOverrides || {});

	// ── 1. The delete set ────────────────────────────────────────
	console.log('1. Anti-join (Source = platform, Related = workbook)');
	let tmpRig = buildRig();
	const tmpDeletePass = await run(tmpRig, 'DataMapperTransform:IntersectRecords',
		{ SourceRecords: tmpFixture.platform, RelatedRecords: tmpFixture.workbook, OperationConfiguration: tmpConfig({ JoinMode: 'Unmatched' }) });
	const tmpDeleteSet = JSON.parse(tmpDeletePass.Outputs.Result);

	check('the delete set holds exactly the dropped requirements', tmpDeleteSet.length === DROPPED_ROWS, `got ${tmpDeleteSet.length}, expected ${DROPPED_ROWS}`);
	check('blank-key rows are excluded from the delete set', tmpDeletePass.Outputs.UnkeyedSourceCount === BLANK_KEY_ROWS, `UnkeyedSourceCount=${tmpDeletePass.Outputs.UnkeyedSourceCount}`);
	check('every emitted row has a real item code', tmpDeleteSet.every((r) => typeof r.ItemCode === 'string' && r.ItemCode.length > 0));
	check('no surviving requirement leaked into the delete set',
		tmpDeleteSet.every((r) => !tmpFixture.workbook.some((w) => w.LookupItemCode === r.ItemCode)));
	check('matched + unmatched accounts for every source row',
		(tmpDeletePass.Outputs.MatchedSourceCount + tmpDeletePass.Outputs.UnmatchedSourceCount) === tmpFixture.platform.length,
		`${tmpDeletePass.Outputs.MatchedSourceCount} + ${tmpDeletePass.Outputs.UnmatchedSourceCount} vs ${tmpFixture.platform.length}`);
	check('each delete row got its own GUID', new Set(tmpDeleteSet.map((r) => r.GUIDSpecYearDelete)).size === tmpDeleteSet.length);
	check('the unkeyed exclusion is reported in the log', tmpDeletePass.Log.join(' ').indexOf('no usable value at their join field') > -1);

	// ── 2. The delete set survives the rest of the pipeline ──────
	console.log('\n2. Delete set → BuildComprehension → WriteRecords');
	// UV carries State edges as JSON; round-trip so the smoke matches the wire.
	const tmpStateHop = JSON.parse(JSON.stringify(tmpDeleteSet));
	const tmpComprehensionPass = await run(tmpRig, 'DataMapperTransform:BuildComprehension',
		{ Records: tmpStateHop, Entity: 'SpecYearDelete', GUIDField: 'GUIDSpecYearDelete' });
	const tmpComprehension = tmpComprehensionPass.Outputs.Comprehension;
	const tmpKeys = Object.keys(tmpComprehension.SpecYearDelete || {});

	check('the comprehension keys on the real GUID, not a positional fallback',
		tmpKeys.length === DROPPED_ROWS && tmpKeys.every((k) => k.indexOf('record-') !== 0),
		`${tmpKeys.length} keys, first: ${tmpKeys[0]}`);

	const tmpWritePass = await run(tmpRig, 'DataMapperRecords:WriteRecords',
		{
			TargetBeaconName: 'lake-beacon', ConnectionHash: 'private-data-lake', Entity: 'SpecYearDelete',
			GUIDName: 'GUIDSpecYearDelete', Comprehension: tmpComprehension, BulkChunkSize: 500, ResetMode: 'Replace'
		});

	check('every delete row was written', tmpWritePass.Outputs.Written === DROPPED_ROWS, `Written=${tmpWritePass.Outputs.Written}`);
	check('the write reported no errors', tmpWritePass.Outputs.Errors === 0);
	check('the Replace purge actually ran', tmpWritePass.Outputs.PurgeSkipped === undefined, `PurgeSkipped=${JSON.stringify(tmpWritePass.Outputs.PurgeSkipped)}`);
	check('Replace purged nothing (the rows it just wrote are all live)',
		tmpWritePass.Outputs.OrphansDeleted === 0 && tmpRig.deleted.length === 0,
		`OrphansDeleted=${tmpWritePass.Outputs.OrphansDeleted}, DELETEs=${tmpRig.deleted.length}`);
	check('the written bodies carry the projected columns', tmpRig.written.length === DROPPED_ROWS && tmpRig.written[0].ItemCode && tmpRig.written[0].SpecYear === 2026);

	// ── 3. One pass, both sets ───────────────────────────────────
	console.log('\n3. LeftOuter — updates and deletes from a single pass');
	const tmpBothPass = await run(tmpRig, 'DataMapperTransform:IntersectRecords',
		{ SourceRecords: tmpFixture.platform, RelatedRecords: tmpFixture.workbook, OperationConfiguration: tmpConfig({ JoinMode: 'LeftOuter' }) });
	const tmpBoth = JSON.parse(tmpBothPass.Outputs.Result);
	const tmpUpdates = tmpBoth.filter((r) => r._Matched === true);
	const tmpDeletes = tmpBoth.filter((r) => r._Matched === false);

	check('the two sets partition the keyed source rows', (tmpUpdates.length + tmpDeletes.length) === (tmpFixture.platform.length - BLANK_KEY_ROWS));
	check('the delete half matches the dedicated anti-join pass', tmpDeletes.length === tmpDeleteSet.length);
	check('the same item codes come back either way',
		JSON.stringify(tmpDeletes.map((r) => r.ItemCode).sort()) === JSON.stringify(tmpDeleteSet.map((r) => r.ItemCode).sort()));
	check('updates carry their related-side requirement', tmpUpdates.every((r) => typeof r.Requirement === 'string'));

	// ── 4. Inner is untouched ────────────────────────────────────
	console.log('\n4. Inner mode is unchanged');
	const tmpInnerPass = await run(tmpRig, 'DataMapperTransform:IntersectRecords',
		{ SourceRecords: tmpFixture.platform, RelatedRecords: tmpFixture.workbook, OperationConfiguration: tmpConfig() });
	const tmpInner = JSON.parse(tmpInnerPass.Outputs.Result);
	check('Inner emits only the surviving requirements', tmpInner.length === tmpFixture.workbook.length, `got ${tmpInner.length}, expected ${tmpFixture.workbook.length}`);
	check('Inner rows carry no _Matched marker', !tmpInner.some((r) => r.hasOwnProperty('_Matched')));
	check('Inner agrees with LeftOuter on the matched set', tmpInner.length === tmpUpdates.length);

	console.log(`\n${_Fail === 0 ? 'PASS' : 'FAIL'} — ${_Pass} ok, ${_Fail} failed`);
	process.exit(_Fail === 0 ? 0 : 1);
})().catch((pError) =>
{
	console.error('\nsmoke aborted —', pError.message);
	process.exit(1);
});
