/**
 * Retold Data Mapper — CloneStream projection grammar Suite
 *
 * CloneStream projected with a matcher that understood exactly two forms: a
 * single whole `{~D:Record.Field~}` reference and a bare source-column alias.
 * Anything else — a multi-token composite, `{~DataJson:Record~}` — fell through
 * and was written to every row as its own literal template text, with the run
 * reporting success. That made the streaming layout unusable for any target
 * whose columns are composed rather than copied.
 *
 * These tests pin both halves: the two forms that already worked keep their
 * exact semantics (including passing non-string values through unrendered),
 * and the forms that used to land as literals now resolve.
 */
const libAssert = require('assert');
const libPict = require('pict');
const libBeaconProvider = require('../source/services/DataMapper-BeaconProvider.js');

const SOURCE_ROWS =
	[
		{ IDPlanRow: 41, ItemCode: '201-01-00100', MaterialCode: '0204M00010', SampleFrequency: 999999, Active: true },
		{ IDPlanRow: 42, ItemCode: '203-02-00200', MaterialCode: '0301M00020', SampleFrequency: 12, Active: false },
	];

/**
 * Drive one CloneStream run against a two-row source and hand back what it
 * tried to upsert.
 *
 * @param {object} pOperationConfiguration - the bundled { Projection, GUIDTemplate } setting
 * @return {Promise<Array<object>>} the projected records from the single PUT
 */
function runCloneStream(pOperationConfiguration)
{
	return new Promise((fResolve, fReject) =>
	{
		let tmpHandlers = {};
		let tmpFable = new libPict({ Product: 'CloneStreamProjectionTest', LogStreams: [ { streamtype: 'console', level: 'fatal' } ] });
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

		tmpProvider._Client = {};
		let tmpServed = false;
		let tmpUpserted = null;
		tmpProvider._dispatch = (pWorkItem, fCallback) =>
		{
			const tmpSettings = pWorkItem.Settings || {};
			if (tmpSettings.Method === 'GET')
			{
				// Second read returns empty, which is how the stream terminates.
				const tmpBody = tmpServed ? [] : SOURCE_ROWS;
				tmpServed = true;
				return setImmediate(() => fCallback(null, { Outputs: { Status: 200, Body: JSON.stringify(tmpBody) } }));
			}
			if (tmpSettings.Method === 'PUT')
			{
				tmpUpserted = JSON.parse(tmpSettings.Body);
				return setImmediate(() => fCallback(null, { Outputs: { Status: 200, Body: '{}' } }));
			}
			return setImmediate(() => fCallback(null, { Outputs: { Status: 200, Body: '{}' } }));
		};

		tmpHandlers['DataMapperRecords:CloneStream'].Handler(
			{
				Settings:
				{
					SourceBeaconName: 'src', SourceConnectionHash: 'src-conn', SourceEntity: 'PlanRow',
					TargetBeaconName: 'tgt', TargetConnectionHash: 'tgt-conn', TargetEntity: 'PlanComp',
					GUIDName: 'GUIDPlanComp', BatchSize: 500, SortField: '',
					OperationConfiguration: JSON.stringify(pOperationConfiguration)
				}
			},
			{},
			(pError) =>
			{
				if (pError)
				{
					return fReject(pError);
				}
				if (!tmpUpserted)
				{
					return fReject(new Error('CloneStream never issued an upsert.'));
				}
				return fResolve(tmpUpserted);
			},
			() => {});
	});
}

suite('CloneStream projection grammar', function ()
{
	this.timeout(10000);

	suite('forms that already worked keep their semantics', function ()
	{
		test('a single whole reference copies the source value', async function ()
		{
			const tmpRows = await runCloneStream({ GUIDTemplate: 'PC_{~D:Record.IDPlanRow~}', Projection: { ItemCode: '{~D:Record.ItemCode~}' } });
			libAssert.strictEqual(tmpRows[0].ItemCode, '201-01-00100');
			libAssert.strictEqual(tmpRows[1].ItemCode, '203-02-00200');
		});

		test('a single whole reference passes non-strings through unrendered', async function ()
		{
			// Rendering these through the template engine would stringify them,
			// which changes what the target column receives.
			const tmpRows = await runCloneStream(
				{ GUIDTemplate: 'PC_{~D:Record.IDPlanRow~}', Projection: { Frequency: '{~D:Record.SampleFrequency~}', Active: '{~D:Record.Active~}' } });
			libAssert.strictEqual(tmpRows[0].Frequency, 999999);
			libAssert.strictEqual(tmpRows[0].Active, true);
			libAssert.strictEqual(tmpRows[1].Active, false);
		});

		test('a bare source-column name is an alias copy', async function ()
		{
			const tmpRows = await runCloneStream({ GUIDTemplate: 'PC_{~D:Record.IDPlanRow~}', Projection: { Code: 'ItemCode' } });
			libAssert.strictEqual(tmpRows[0].Code, '201-01-00100');
		});

		test('a literal that names no column stays literal', async function ()
		{
			const tmpRows = await runCloneStream({ GUIDTemplate: 'PC_{~D:Record.IDPlanRow~}', Projection: { EntityName: 'PayItemMaterialTestRequirement' } });
			libAssert.strictEqual(tmpRows[0].EntityName, 'PayItemMaterialTestRequirement');
		});

		test('the GUID template composes multiple field tokens, missing fields empty', async function ()
		{
			const tmpRows = await runCloneStream(
				{ GUIDTemplate: 'LADOTD-PIMTR-{~D:Record.ItemCode~}-{~D:Record.MaterialCode~}-{~D:Record.NotAColumn~}', Projection: { A: 'ItemCode' } });
			libAssert.strictEqual(tmpRows[0].GUIDPlanComp, 'LADOTD-PIMTR-201-01-00100-0204M00010-');
		});
	});

	suite('forms that used to land as literal template text', function ()
	{
		test('a multi-token composite resolves', async function ()
		{
			const tmpRows = await runCloneStream(
				{ GUIDTemplate: 'PC_{~D:Record.IDPlanRow~}', Projection: { _GUIDMaterial: 'LADOTD-Material-{~D:Record.MaterialCode~}' } });
			libAssert.strictEqual(tmpRows[0]._GUIDMaterial, 'LADOTD-Material-0204M00010');
			libAssert.strictEqual(tmpRows[1]._GUIDMaterial, 'LADOTD-Material-0301M00020');
		});

		test('a composite mixing two fields and literal text resolves', async function ()
		{
			const tmpRows = await runCloneStream(
				{ GUIDTemplate: 'PC_{~D:Record.IDPlanRow~}', Projection: { RowKey: '{~D:Record.ItemCode~}--{~D:Record.MaterialCode~}' } });
			libAssert.strictEqual(tmpRows[0].RowKey, '201-01-00100--0204M00010');
		});

		test('{~DataJson:Record~} serializes the whole source record', async function ()
		{
			const tmpRows = await runCloneStream(
				{ GUIDTemplate: 'PC_{~D:Record.IDPlanRow~}', Projection: { RecordJSON: '{~DataJson:Record~}' } });
			const tmpParsed = JSON.parse(tmpRows[0].RecordJSON);
			libAssert.strictEqual(tmpParsed.ItemCode, '201-01-00100');
			libAssert.strictEqual(tmpParsed.MaterialCode, '0204M00010');
		});
	});
});
