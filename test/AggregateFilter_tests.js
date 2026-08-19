/**
 * Retold Data Mapper — SQLAggregate source-filter suite
 *
 * Three layers, one behavior: an operation that aggregates a table must be
 * able to say which rows enter the GROUP BY.
 *
 *   1. the meadow-string → structured-filter translator
 *   2. the SQLAggregate compiler threading both filter forms onto the node
 *   3. the save-time validator rejecting filters that cannot be pushed down
 *
 * The emitter that turns the structured form into SQL is tested in
 * retold-databeacon (DataBeacon-SQLEmitter-Aggregate_tests.js).
 */
const libAssert = require('assert');
const libConnectionBridge = require('../source/services/DataMapper-ConnectionBridge.js');
const { translateFilterExpression } = require('../source/services/DataMapper-MeadowFilter-Translator.js');

function aggregateOp(pCfg)
{
	return {
		OperationType: 'SQLAggregate', Hash: 'agg-filter',
		SourceBeaconName: 'src', SourceConnectionHash: 'src-conn', SourceEntity: 'PlanRow',
		TargetBeaconName: 'tgt', TargetConnectionHash: 'tgt-conn', TargetTable: 'PlanRollup',
		OperationConfiguration: Object.assign(
			{
				Entity: 'PlanRollup',
				GUIDTemplate: 'PR_{~D:Record.ItemCode~}',
				GroupBy: ['ItemCode', 'MaterialCode'],
				Aggregates: [{ Source: '*', Function: 'Count', As: 'RowCount' }]
			}, pCfg)
	};
}

function compile(pOp)
{
	return libConnectionBridge.prototype._compileSQLAggregateToOperation.call(Object.create(libConnectionBridge.prototype), pOp);
}

function aggNode(pGraph)
{
	return pGraph.Graph.Nodes.find((n) => n.Hash === 'agg');
}

function validate(pOp)
{
	return libConnectionBridge.prototype._validateOperationConfiguration.call(Object.create(libConnectionBridge.prototype), pOp);
}

suite('SQLAggregate source filter', function ()
{
	suite('meadow filter translation', function ()
	{
		test('translates a single FBV stanza to a SQL operator token', function ()
		{
			libAssert.deepStrictEqual(translateFilterExpression('FBV~Action~NE~DELETE'),
				[{ Operator: '!=', Column: 'Action', Value: 'DELETE', Connector: 'AND' }]);
		});

		test('translates multiple stanzas in order', function ()
		{
			const tmpTerms = translateFilterExpression('FBV~Action~NE~DELETE~FBV~Deleted~EQ~0');
			libAssert.strictEqual(tmpTerms.length, 2);
			libAssert.strictEqual(tmpTerms[1].Operator, '=');
			libAssert.strictEqual(tmpTerms[1].Column, 'Deleted');
		});

		test('translates FBL list stanzas to IN with an array value', function ()
		{
			libAssert.deepStrictEqual(translateFilterExpression('FBL~ItemCode~INN~A,B,C'),
				[{ Operator: 'IN', Column: 'ItemCode', Value: ['A', 'B', 'C'], Connector: 'AND' }]);
		});

		test('maps the null mnemonics, which do NOT mean what the SQL tokens mean', function ()
		{
			libAssert.strictEqual(translateFilterExpression('FBV~Action~IN~0')[0].Operator, 'IS NULL');
			libAssert.strictEqual(translateFilterExpression('FBV~Action~NN~0')[0].Operator, 'IS NOT NULL');
		});

		test('translates paren grouping and OR connectors', function ()
		{
			const tmpTerms = translateFilterExpression('FOP~0~(~0~FBV~Action~EQ~ADD~FBVOR~Action~EQ~UPDATE~FCP~0~)~0');
			libAssert.deepStrictEqual(tmpTerms.map((t) => t.Operator), ['(', '=', '=', ')']);
			libAssert.strictEqual(tmpTerms[2].Connector, 'OR');
		});

		test('rejects stanzas that cannot be pushed down, rather than dropping them', function ()
		{
			// meadow-filter itself ignores what it cannot parse and reports
			// success. In a push-down context that silently aggregates rows
			// the caller asked to exclude, so each of these must throw.
			libAssert.throws(() => translateFilterExpression('FBJV~Data.Flag~EQ~1'), /JSON stanzas/);
			libAssert.throws(() => translateFilterExpression('FBD~UpdateDate~EQ~2015-10-01'), /DATE\(\)/);
			libAssert.throws(() => translateFilterExpression('FSF~Action~ASC~0'), /OrderBy/);
			libAssert.throws(() => translateFilterExpression('NOPE~Action~EQ~1'), /unrecognized instruction/);
			libAssert.throws(() => translateFilterExpression('garbage'), /not a meadow filter string/);
			libAssert.throws(() => translateFilterExpression(''), /non-empty meadow filter string/);
		});
	});

	suite('compiler pass-through', function ()
	{
		test('threads FilterExpression onto the aggregate stream node', function ()
		{
			const tmpNode = aggNode(compile(aggregateOp({ FilterExpression: 'FBV~Action~NE~DELETE' })));
			libAssert.strictEqual(tmpNode.Data.FilterExpression, 'FBV~Action~NE~DELETE');
		});

		test('emits an empty FilterExpression when unset', function ()
		{
			libAssert.strictEqual(aggNode(compile(aggregateOp({}))).Data.FilterExpression, '');
		});

		test('bundles a structured Filter inside OperationConfiguration', function ()
		{
			const tmpFilter = [{ Column: 'Action', Operator: '!=', Value: 'DELETE' }];
			const tmpNode = aggNode(compile(aggregateOp({ Filter: tmpFilter })));
			libAssert.deepStrictEqual(JSON.parse(tmpNode.Data.OperationConfiguration).Filter, tmpFilter);
		});

		test('leaves Filter out of the bundle when unset', function ()
		{
			const tmpBundle = JSON.parse(aggNode(compile(aggregateOp({}))).Data.OperationConfiguration);
			libAssert.strictEqual(tmpBundle.Filter, undefined);
			libAssert.deepStrictEqual(tmpBundle.GroupBy, ['ItemCode', 'MaterialCode']);
		});
	});

	suite('save-time validation', function ()
	{
		test('accepts a pushable FilterExpression', function ()
		{
			libAssert.strictEqual(validate(aggregateOp({ FilterExpression: 'FBV~Action~NE~DELETE' })), null);
		});

		test('rejects a FilterExpression that cannot be pushed down', function ()
		{
			const tmpError = validate(aggregateOp({ FilterExpression: 'FBJV~Data.Flag~EQ~1' }));
			libAssert.ok(tmpError instanceof Error);
			libAssert.match(tmpError.message, /SQLAggregate FilterExpression/);
		});

		test('rejects both filter forms at once', function ()
		{
			const tmpError = validate(aggregateOp(
				{ FilterExpression: 'FBV~Action~NE~DELETE', Filter: [{ Column: 'Action', Operator: '!=', Value: 'DELETE' }] }));
			libAssert.ok(tmpError instanceof Error);
			libAssert.match(tmpError.message, /not both/);
		});

		test('rejects a non-array structured Filter', function ()
		{
			const tmpError = validate(aggregateOp({ Filter: 'FBV~Action~NE~DELETE' }));
			libAssert.ok(tmpError instanceof Error);
			libAssert.match(tmpError.message, /must be an array/);
		});
	});
});
