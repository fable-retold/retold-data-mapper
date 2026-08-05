/**
 * Retold Data Mapper — IntersectRecords JoinMode Suite
 *
 * A sync pipeline needs three sets: source ∩ target (update), source − target
 * (create), and target − source (delete). The third is the anti-join, and
 * before JoinMode the handler counted those rows and threw them away. These
 * tests pin all three modes, and — because this output can drive deletions —
 * the rule that a row with no usable join key is never treated as evidence
 * that its counterpart is gone.
 */
const libAssert = require('assert');
const libPict = require('pict');
const libBeaconProvider = require('../source/services/DataMapper-BeaconProvider.js');

function buildHandlers()
{
	let tmpHandlers = {};
	let tmpFable = new libPict({ Product: 'IntersectJoinModeTest', LogStreams: [ { streamtype: 'console', level: 'fatal' } ] });
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
	return tmpHandlers;
}

const _Handlers = buildHandlers();

function intersect(pSource, pRelated, pConfig)
{
	return new Promise((fResolve) =>
		_Handlers['DataMapperTransform:IntersectRecords'].Handler(
			{ Settings: { SourceRecords: pSource, RelatedRecords: pRelated, OperationConfiguration: pConfig } }, {},
			(pError, pResult) => fResolve({ Error: pError, Outputs: (pResult || {}).Outputs, Log: (pResult || {}).Log })));
}

function config(pOverrides)
{
	return Object.assign(
		{
			Entity: 'PlanRow',
			JoinOn: { SourceField: 'ItemCode', RelatedField: 'LookupItemCode' },
			Projection: { ItemCode: '{~D:Source.ItemCode~}', Requirement: '{~D:Related.Requirement~}' }
		}, pOverrides || {});
}

// The platform holds three rows; the latest workbook still carries two of them.
const PLATFORM = [ { ItemCode: 'KEEP-1' }, { ItemCode: 'GONE-1' }, { ItemCode: 'KEEP-2' } ];
const WORKBOOK = [ { LookupItemCode: 'KEEP-1', Requirement: 'AASHTO T27' }, { LookupItemCode: 'KEEP-2', Requirement: 'AASHTO T96' } ];

suite('IntersectRecords JoinMode', function ()
{
	suite('_isUsableJoinKey', function ()
	{
		const _isUsableJoinKey = libBeaconProvider._isUsableJoinKey;

		test('absent, null and blank values are not usable keys', function ()
		{
			libAssert.strictEqual(_isUsableJoinKey(undefined), false);
			libAssert.strictEqual(_isUsableJoinKey(null), false);
			libAssert.strictEqual(_isUsableJoinKey(''), false);
			libAssert.strictEqual(_isUsableJoinKey('   '), false);
		});

		test('zero and "0" are legitimate keys', function ()
		{
			libAssert.strictEqual(_isUsableJoinKey(0), true);
			libAssert.strictEqual(_isUsableJoinKey('0'), true);
			libAssert.strictEqual(_isUsableJoinKey(false), true);
		});
	});

	test('Inner is the default and emits only matched rows', async function ()
	{
		const tmpOutcome = await intersect(PLATFORM, WORKBOOK, config());
		libAssert.strictEqual(tmpOutcome.Error, null);
		const tmpRecords = JSON.parse(tmpOutcome.Outputs.Result);
		libAssert.strictEqual(tmpOutcome.Outputs.JoinMode, 'Inner');
		libAssert.strictEqual(tmpRecords.length, 2);
		libAssert.deepStrictEqual(tmpRecords.map((r) => r.ItemCode), [ 'KEEP-1', 'KEEP-2' ]);
		libAssert.strictEqual(tmpRecords[0].hasOwnProperty('_Matched'), false, 'Inner rows carry no marker');
		libAssert.strictEqual(tmpOutcome.Outputs.EmittedUnmatchedCount, 0);
	});

	test('Unmatched emits the anti-join — exactly the rows with no counterpart', async function ()
	{
		const tmpOutcome = await intersect(PLATFORM, WORKBOOK, config({ JoinMode: 'Unmatched' }));
		libAssert.strictEqual(tmpOutcome.Error, null);
		const tmpRecords = JSON.parse(tmpOutcome.Outputs.Result);
		libAssert.strictEqual(tmpRecords.length, 1, 'only the dropped requirement comes back');
		libAssert.strictEqual(tmpRecords[0].ItemCode, 'GONE-1');
		libAssert.strictEqual(tmpOutcome.Outputs.MatchedSourceCount, 2);
		libAssert.strictEqual(tmpOutcome.Outputs.UnmatchedSourceCount, 1);
		libAssert.strictEqual(tmpOutcome.Outputs.EmittedUnmatchedCount, 1);
	});

	test('an unmatched row projects the related side as undefined rather than throwing', async function ()
	{
		const tmpOutcome = await intersect(PLATFORM, WORKBOOK, config({ JoinMode: 'Unmatched' }));
		const tmpRecords = JSON.parse(tmpOutcome.Outputs.Result);
		libAssert.strictEqual(tmpRecords[0].hasOwnProperty('Requirement'), false, 'JSON drops the undefined related field');
		libAssert.strictEqual(tmpRecords[0].ItemCode, 'GONE-1', 'the source side still projects');
	});

	test('LeftOuter emits both sets, each stamped with _Matched', async function ()
	{
		const tmpOutcome = await intersect(PLATFORM, WORKBOOK, config({ JoinMode: 'LeftOuter' }));
		libAssert.strictEqual(tmpOutcome.Error, null);
		const tmpRecords = JSON.parse(tmpOutcome.Outputs.Result);
		libAssert.strictEqual(tmpRecords.length, 3);
		const tmpByCode = {};
		tmpRecords.forEach((r) => { tmpByCode[r.ItemCode] = r; });
		libAssert.strictEqual(tmpByCode['KEEP-1']._Matched, true);
		libAssert.strictEqual(tmpByCode['KEEP-2']._Matched, true);
		libAssert.strictEqual(tmpByCode['GONE-1']._Matched, false);
		libAssert.strictEqual(tmpByCode['KEEP-1'].Requirement, 'AASHTO T27');
	});

	// "Matched but the related field was genuinely empty" and "never matched"
	// are indistinguishable from a null alone — which is how you delete the
	// wrong records.
	test('_Matched distinguishes an unmatched row from a match whose field is empty', async function ()
	{
		const tmpOutcome = await intersect(
			[ { ItemCode: 'HAS-EMPTY' }, { ItemCode: 'NO-MATCH' } ],
			[ { LookupItemCode: 'HAS-EMPTY', Requirement: null } ],
			config({ JoinMode: 'LeftOuter' }));
		const tmpRecords = JSON.parse(tmpOutcome.Outputs.Result);
		const tmpEmpty = tmpRecords.find((r) => r.ItemCode === 'HAS-EMPTY');
		const tmpMissing = tmpRecords.find((r) => r.ItemCode === 'NO-MATCH');
		libAssert.strictEqual(tmpEmpty.Requirement, null, 'both rows look identical on the related field');
		libAssert.strictEqual(tmpEmpty._Matched, true);
		libAssert.strictEqual(tmpMissing._Matched, false, 'only the marker tells them apart');
	});

	test('an unrecognized JoinMode fails the task rather than silently running Inner', async function ()
	{
		const tmpOutcome = await intersect(PLATFORM, WORKBOOK, config({ JoinMode: 'AntiJoin' }));
		libAssert.ok(tmpOutcome.Error instanceof Error);
		libAssert.match(tmpOutcome.Error.message, /unrecognized JoinMode \[AntiJoin\]/);
		libAssert.match(tmpOutcome.Error.message, /Inner, LeftOuter, Unmatched/);
	});

	test('Unmatched with a Related-referencing GUIDTemplate fails instead of collapsing every GUID', async function ()
	{
		const tmpOutcome = await intersect(PLATFORM, WORKBOOK,
			config({ JoinMode: 'Unmatched', GUIDTemplate: 'PR-{~D:Related.Requirement~}' }));
		libAssert.ok(tmpOutcome.Error instanceof Error);
		libAssert.match(tmpOutcome.Error.message, /no related side/);
	});

	test('Unmatched with a Source-built GUIDTemplate gives each row its own GUID', async function ()
	{
		const tmpOutcome = await intersect(
			[ { ItemCode: 'GONE-1' }, { ItemCode: 'GONE-2' } ],
			WORKBOOK,
			config({ JoinMode: 'Unmatched', GUIDTemplate: 'PR-{~D:Source.ItemCode~}' }));
		libAssert.strictEqual(tmpOutcome.Error, null);
		const tmpRecords = JSON.parse(tmpOutcome.Outputs.Result);
		libAssert.deepStrictEqual(tmpRecords.map((r) => r.GUIDPlanRow), [ 'PR-GONE_1', 'PR-GONE_2' ]);
	});

	// The fail-dangerous case: a missing field is not evidence that a row's
	// counterpart is gone, so it must never reach a delete set.
	test('a source row with no usable join key is never emitted as unmatched', async function ()
	{
		const tmpOutcome = await intersect(
			[ { ItemCode: 'GONE-1' }, { ItemCode: null }, { SomethingElse: 'x' }, { ItemCode: '   ' } ],
			WORKBOOK,
			config({ JoinMode: 'Unmatched' }));
		libAssert.strictEqual(tmpOutcome.Error, null);
		const tmpRecords = JSON.parse(tmpOutcome.Outputs.Result);
		libAssert.strictEqual(tmpRecords.length, 1, 'only the genuinely-unmatched keyed row is emitted');
		libAssert.strictEqual(tmpRecords[0].ItemCode, 'GONE-1');
		libAssert.strictEqual(tmpOutcome.Outputs.UnkeyedSourceCount, 3);
		libAssert.strictEqual(tmpOutcome.Outputs.UnmatchedSourceCount, 4, 'they still count as unmatched');
		libAssert.strictEqual(tmpOutcome.Outputs.EmittedUnkeyedCount, undefined);
		libAssert.match(tmpOutcome.Log.join(' '), /carry no usable value at their join field/);
	});

	test('unkeyed rows are excluded in LeftOuter too', async function ()
	{
		const tmpOutcome = await intersect(
			[ { ItemCode: 'KEEP-1' }, { ItemCode: null } ],
			WORKBOOK,
			config({ JoinMode: 'LeftOuter' }));
		const tmpRecords = JSON.parse(tmpOutcome.Outputs.Result);
		libAssert.strictEqual(tmpRecords.length, 1);
		libAssert.strictEqual(tmpRecords[0]._Matched, true);
		libAssert.strictEqual(tmpOutcome.Outputs.UnkeyedSourceCount, 1);
	});

	// Both sides are stringified to index the join, so without the key check a
	// row with no key indexes under 'undefined' and joins any other row that
	// also lacks one.
	test('a related row with no usable key cannot produce a phantom match', async function ()
	{
		const tmpOutcome = await intersect(
			[ { SomethingElse: 'x' } ],
			[ { Requirement: 'indexed-under-undefined' } ],
			config());
		libAssert.strictEqual(tmpOutcome.Outputs.MatchedSourceCount, 0);
		libAssert.strictEqual(tmpOutcome.Outputs.RecordCount, 0);
		libAssert.strictEqual(tmpOutcome.Outputs.UnkeyedRelatedCount, 1);
	});

	test('null keys on both sides no longer join each other', async function ()
	{
		const tmpOutcome = await intersect(
			[ { ItemCode: null } ],
			[ { LookupItemCode: null, Requirement: 'from-a-null-keyed-row' } ],
			config());
		libAssert.strictEqual(tmpOutcome.Outputs.MatchedSourceCount, 0);
		libAssert.strictEqual(tmpOutcome.Outputs.RecordCount, 0);
	});

	test('zero-valued join keys still match', async function ()
	{
		const tmpOutcome = await intersect(
			[ { ItemCode: 0 } ],
			[ { LookupItemCode: '0', Requirement: 'zero is a real key' } ],
			config());
		libAssert.strictEqual(tmpOutcome.Outputs.MatchedSourceCount, 1);
		libAssert.strictEqual(JSON.parse(tmpOutcome.Outputs.Result)[0].Requirement, 'zero is a real key');
	});

	test('Inner mode keeps its existing OrderBy + Limit behavior', async function ()
	{
		const tmpOutcome = await intersect(
			[ { ItemCode: 'A' } ],
			[
				{ LookupItemCode: 'A', Requirement: 'older', Seq: 1 },
				{ LookupItemCode: 'A', Requirement: 'newest', Seq: 3 },
				{ LookupItemCode: 'A', Requirement: 'middle', Seq: 2 }
			],
			config({ OrderBy: [ { Field: 'Seq', Direction: 'DESC' } ], Limit: 1 }));
		const tmpRecords = JSON.parse(tmpOutcome.Outputs.Result);
		libAssert.strictEqual(tmpRecords.length, 1);
		libAssert.strictEqual(tmpRecords[0].Requirement, 'newest');
	});
});
