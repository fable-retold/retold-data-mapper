/**
 * Retold Data Mapper — Transform Input Resolution Suite
 *
 * A transform action receives its records as a UV template addressing an upstream node's
 * output, so the value crosses the State edge as a JSON string. When that handoff did not
 * happen the setting arrives absent, blank or still wearing its template delimiters — and
 * the handlers used to substitute [] for all of it. The action then produced zero records
 * and reported `succeeded`, which is indistinguishable from a real empty result: nothing in
 * the outputs, the run status, or PDO says otherwise. A 92,104-row load wrote nothing three
 * times under exactly this shape.
 *
 * The rule these pin: an action that emits records emits '[]' when it has none, so '[]' is
 * the ONLY thing that means empty. Anything else that cannot become an array is a failure,
 * and it must reach the caller as one. A workflow for which an unavailable input is
 * acceptable wires the node's Error port — the tolerance belongs in the operation graph
 * where it is visible, not in a catch block where it is not.
 */
const libAssert = require('assert');
const libPict = require('pict');
const libBeaconProvider = require('../source/services/DataMapper-BeaconProvider.js');

const _resolveRecordsSetting = libBeaconProvider._resolveRecordsSetting;
const _resolveConfigSetting = libBeaconProvider._resolveConfigSetting;

function buildHandlers()
{
	let tmpHandlers = {};
	let tmpFable = new libPict({ Product: 'SettingResolutionTest', LogStreams: [ { streamtype: 'console', level: 'fatal' } ] });
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

function runAction(pActionKey, pSettings)
{
	return new Promise((fResolve) =>
		_Handlers[pActionKey].Handler(
			{ Settings: pSettings }, {},
			(pError, pResult) => fResolve({ Error: pError, Outputs: (pResult || {}).Outputs, Log: (pResult || {}).Log })));
}

const INTERSECT_CONFIG =
	{
		Entity: 'Thing',
		GUIDTemplate: 'T_{~D:Source.ID~}',
		JoinOn: { SourceField: 'ID', RelatedField: 'ID' },
		Projection: { ID: '{~D:Source.ID~}' }
	};

suite
(
	'Data Mapper - Transform Input Resolution',
	() =>
	{
		suite
		(
			'the values that mean EMPTY',
			() =>
			{
				test
				(
					'a real empty array resolves to an empty array',
					() =>
					{
						libAssert.deepStrictEqual(_resolveRecordsSetting('X', 'Records', []), []);
					}
				);
				test
				(
					"the string '[]' — what every upstream action emits when it has no rows",
					() =>
					{
						libAssert.deepStrictEqual(_resolveRecordsSetting('X', 'Records', '[]'), []);
					}
				);
				test
				(
					'a populated array and its serialized form resolve identically',
					() =>
					{
						const tmpRows = [ { ID: 1 }, { ID: 2 } ];
						libAssert.deepStrictEqual(_resolveRecordsSetting('X', 'Records', tmpRows), tmpRows);
						libAssert.deepStrictEqual(_resolveRecordsSetting('X', 'Records', JSON.stringify(tmpRows)), tmpRows);
					}
				);
			}
		);

		suite
		(
			'the values that mean the handoff DID NOT HAPPEN',
			() =>
			{
				test
				(
					'an absent setting throws rather than resolving to empty',
					() =>
					{
						libAssert.throws(() => _resolveRecordsSetting('X', 'Records', undefined), /did not resolve/);
						libAssert.throws(() => _resolveRecordsSetting('X', 'Records', null), /did not resolve/);
					}
				);
				test
				(
					'an empty string throws — it is not the same as the string "[]"',
					() =>
					{
						libAssert.throws(() => _resolveRecordsSetting('X', 'Records', ''), /did not resolve/);
					}
				);
				test
				(
					'an unresolved template says so, because that is the likeliest cause',
					() =>
					{
						libAssert.throws(
							() => _resolveRecordsSetting('IntersectRecords', 'SourceRecords', '{~D:Record.TaskOutput.pull-plan.Result~}'),
							/template delimiters/);
					}
				);
				test
				(
					'a truncated payload throws instead of silently becoming zero rows',
					() =>
					{
						libAssert.throws(() => _resolveRecordsSetting('X', 'Records', '[{"ID":1},{"ID":'), /not parseable JSON/);
					}
				);
				test
				(
					'valid JSON that is not an array throws',
					() =>
					{
						libAssert.throws(() => _resolveRecordsSetting('X', 'Records', '{"Count":0}'), /rather than an array/);
						libAssert.throws(() => _resolveRecordsSetting('X', 'Records', '"[]"'), /rather than an array/);
					}
				);
				test
				(
					'a scalar throws',
					() =>
					{
						libAssert.throws(() => _resolveRecordsSetting('X', 'Records', 0), /must be an array/);
						libAssert.throws(() => _resolveRecordsSetting('X', 'Records', false), /must be an array/);
					}
				);
			}
		);

		suite
		(
			'configuration settings follow the same rule',
			() =>
			{
				test
				(
					'an object, and its serialized form, resolve',
					() =>
					{
						libAssert.deepStrictEqual(_resolveConfigSetting('X', 'Cfg', { Entity: 'A' }), { Entity: 'A' });
						libAssert.deepStrictEqual(_resolveConfigSetting('X', 'Cfg', '{"Entity":"A"}'), { Entity: 'A' });
					}
				);
				test
				(
					'an absent config throws rather than defaulting to an empty projection',
					() =>
					{
						// A {} config is not harmless: the projection is empty, so every record is
						// written stripped of every field, and the task still reports success.
						libAssert.throws(() => _resolveConfigSetting('X', 'Cfg', undefined), /did not resolve/);
						libAssert.throws(() => _resolveConfigSetting('X', 'Cfg', ''), /did not resolve/);
					}
				);
				test
				(
					'an unparseable or non-object config throws',
					() =>
					{
						libAssert.throws(() => _resolveConfigSetting('X', 'Cfg', '{"Entity":'), /not parseable JSON/);
						libAssert.throws(() => _resolveConfigSetting('X', 'Cfg', '[]'), /must be an object/);
						libAssert.throws(() => _resolveConfigSetting('X', 'Cfg', 7), /must be an object/);
					}
				);
			}
		);

		suite
		(
			'the handlers surface it as a task failure',
			() =>
			{
				test
				(
					'IntersectRecords fails the task when SourceRecords never resolved',
					async () =>
					{
						const tmpResult = await runAction('DataMapperTransform:IntersectRecords',
							{ SourceRecords: '{~D:Record.TaskOutput.pull-plan.Result~}', RelatedRecords: '[]', OperationConfiguration: INTERSECT_CONFIG });
						libAssert.ok(tmpResult.Error, 'an unresolved SourceRecords template must fail the task');
						libAssert.match(tmpResult.Error.message, /SourceRecords/);
					}
				);
				test
				(
					'IntersectRecords still SUCCEEDS on a genuinely empty source',
					async () =>
					{
						// The whole point of the distinction: a filtered pass that legitimately
						// matched no rows must keep working exactly as it did.
						const tmpResult = await runAction('DataMapperTransform:IntersectRecords',
							{ SourceRecords: '[]', RelatedRecords: '[]', OperationConfiguration: INTERSECT_CONFIG });
						libAssert.ok(!tmpResult.Error, 'an empty source is a valid result, not a failure');
						libAssert.strictEqual(tmpResult.Outputs.RecordCount, 0);
					}
				);
				test
				(
					'IntersectRecords joins normally when both sides resolve',
					async () =>
					{
						const tmpResult = await runAction('DataMapperTransform:IntersectRecords',
							{
								SourceRecords: JSON.stringify([ { ID: 1 }, { ID: 2 } ]),
								RelatedRecords: JSON.stringify([ { ID: 1 } ]),
								OperationConfiguration: INTERSECT_CONFIG
							});
						libAssert.ok(!tmpResult.Error);
						libAssert.strictEqual(tmpResult.Outputs.RecordCount, 1);
						libAssert.strictEqual(tmpResult.Outputs.MatchedSourceCount, 1);
					}
				);
				test
				(
					'ExtractRecords, AggregateRecords and BuildComprehension fail the same way',
					async () =>
					{
						for (const tmpCase of
							[
								{ Action: 'DataMapperTransform:ExtractRecords', Settings: { OperationConfiguration: { Entity: 'A' } } },
								{ Action: 'DataMapperTransform:AggregateRecords', Settings: { OperationConfiguration: { Entity: 'A' } } },
								{ Action: 'DataMapperTransform:BuildComprehension', Settings: { Entity: 'A', GUIDField: 'GUIDA' } }
							])
						{
							const tmpResult = await runAction(tmpCase.Action, tmpCase.Settings);
							libAssert.ok(tmpResult.Error, `${tmpCase.Action} must fail when Records never resolved`);
							libAssert.match(tmpResult.Error.message, /Records/);
						}
					}
				);
				test
				(
					'a transform with a resolved input but an absent config fails rather than projecting nothing',
					async () =>
					{
						const tmpResult = await runAction('DataMapperTransform:ExtractRecords', { Records: '[{"ID":1}]' });
						libAssert.ok(tmpResult.Error, 'an absent OperationConfiguration must fail the task');
						libAssert.match(tmpResult.Error.message, /OperationConfiguration/);
					}
				);
			}
		);
	}
);
