/**
 * Retold Data Mapper — WriteRecords bulk-chunk retry Suite
 *
 * A database container restarting under a long write (image auto-update,
 * failover) leaves the target beacon's pool holding dead sockets, which
 * surface as scattered ECONNRESETs minutes afterwards. Before retry, each
 * one silently dropped a whole chunk and the run still reported success.
 * These tests pin the retry conversation at the MeadowProxy dispatch seam:
 * what gets replayed, what must never be replayed, and what is reported.
 */
const libAssert = require('assert');
const libPict = require('pict');
const libBeaconProvider = require('../source/services/DataMapper-BeaconProvider.js');

const ENTITY = 'LakeRow';
const UPSERT_KEY = 'GUID' + ENTITY;

/**
 * Build a WriteRecords harness whose PUT behavior is programmable per attempt.
 *
 * @param {function} pPutBehavior - function(pAttemptNumber, pPutIndex) returning
 *        { Error: '<message>' } | { Status: <number> } | null for success
 * @return {object} { handlers, ledger }
 */
function buildRetryHarness(pPutBehavior)
{
	let tmpHandlers = {};
	let tmpFable = new libPict({ Product: 'WriteRetryTest', LogStreams: [ { streamtype: 'console', level: 'fatal' } ] });
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
	const tmpLedger = { puts: 0, bodies: [] };
	tmpProvider._dispatch = (pWorkItem, fCallback) =>
	{
		const tmpSettings = pWorkItem.Settings || {};
		if (tmpSettings.Method === 'PUT' && /\/Upserts$/.test(tmpSettings.Path))
		{
			tmpLedger.puts++;
			tmpLedger.bodies.push(tmpSettings.Body);
			const tmpVerdict = pPutBehavior(tmpLedger.puts);
			if (tmpVerdict && tmpVerdict.Error)
			{
				return setImmediate(() => fCallback(new Error(tmpVerdict.Error)));
			}
			if (tmpVerdict && tmpVerdict.Status)
			{
				return setImmediate(() => fCallback(null, { Outputs: { Status: tmpVerdict.Status, Body: '{"Error":"nope"}' } }));
			}
			return setImmediate(() => fCallback(null, { Outputs: { Status: 200, Body: '{}' } }));
		}
		return fCallback(new Error(`unexpected dispatch: ${tmpSettings.Method} ${tmpSettings.Path}`));
	};
	return { handlers: tmpHandlers, ledger: tmpLedger };
}

function makeRecords(pCount, pIncludeUpsertKey)
{
	let tmpRecords = [];
	for (let i = 0; i < pCount; i++)
	{
		let tmpRow = { RecordGUID: 'LAKE-' + i, Payload: 'x' };
		if (pIncludeUpsertKey)
		{
			tmpRow[UPSERT_KEY] = 'LAKE-' + i;
		}
		tmpRecords.push(tmpRow);
	}
	return tmpRecords;
}

function write(pHarness, pRecords)
{
	return new Promise((fResolve) =>
		pHarness.handlers['DataMapperRecords:WriteRecords'].Handler(
			{
				Settings:
				{
					TargetBeaconName: 'lake-beacon', ConnectionHash: 'private-data-lake', Entity: ENTITY,
					GUIDName: 'RecordGUID', Records: pRecords, BulkChunkSize: 500, ResetMode: 'Append'
				}
			}, {},
			(pError, pResult) => fResolve({ Error: pError, Result: pResult })));
}

suite('WriteRecords bulk-chunk retry', function ()
{
	suiteSetup(function ()
	{
		process.env.DATA_MAPPER_WRITE_RETRY_BACKOFF_MS = '1';
	});
	suiteTeardown(function ()
	{
		delete process.env.DATA_MAPPER_WRITE_RETRY_BACKOFF_MS;
		delete process.env.DATA_MAPPER_WRITE_RETRY_ATTEMPTS;
	});

	suite('_isRetryableWriteFailure', function ()
	{
		const _isRetryableWriteFailure = libBeaconProvider._isRetryableWriteFailure;

		test('transport resets and timeouts are retryable', function ()
		{
			libAssert.strictEqual(_isRetryableWriteFailure('read ECONNRESET', 0), true);
			libAssert.strictEqual(_isRetryableWriteFailure('connect ETIMEDOUT 10.0.0.4:5432', 0), true);
			libAssert.strictEqual(_isRetryableWriteFailure('write EPIPE', 0), true);
			libAssert.strictEqual(_isRetryableWriteFailure('connect ECONNREFUSED', 0), true);
		});

		test('gateway statuses are retryable, other HTTP failures are not', function ()
		{
			libAssert.strictEqual(_isRetryableWriteFailure('HTTP 503: unavailable', 503), true);
			libAssert.strictEqual(_isRetryableWriteFailure('HTTP 504: gateway timeout', 504), true);
			libAssert.strictEqual(_isRetryableWriteFailure('HTTP 400: bad column', 400), false);
			libAssert.strictEqual(_isRetryableWriteFailure('HTTP 409: duplicate key', 409), false);
		});

		test('data failures and empty messages are never retryable', function ()
		{
			libAssert.strictEqual(_isRetryableWriteFailure('null value in column violates not-null constraint', 0), false);
			libAssert.strictEqual(_isRetryableWriteFailure('', 0), false);
			libAssert.strictEqual(_isRetryableWriteFailure(undefined, 0), false);
		});
	});

	suite('_isChunkReplaySafe', function ()
	{
		const _isChunkReplaySafe = libBeaconProvider._isChunkReplaySafe;

		test('a chunk whose rows all carry GUID<Entity> can be replayed', function ()
		{
			libAssert.strictEqual(_isChunkReplaySafe(makeRecords(3, true), ENTITY), true);
		});

		test('a chunk missing GUID<Entity> on any row cannot', function ()
		{
			let tmpChunk = makeRecords(3, true);
			delete tmpChunk[1][UPSERT_KEY];
			libAssert.strictEqual(_isChunkReplaySafe(tmpChunk, ENTITY), false);
			libAssert.strictEqual(_isChunkReplaySafe(makeRecords(3, false), ENTITY), false);
		});

		// meadow's Upsert takes the UPDATE path on EITHER key, so a chunk
		// keyed only by ID<Entity> replays as an update just as safely.
		test('ID<Entity> alone is replay safe — meadow matches on it too', function ()
		{
			libAssert.strictEqual(_isChunkReplaySafe([ { ['ID' + ENTITY]: 1 }, { ['ID' + ENTITY]: 27 } ], ENTITY), true);
		});

		test('a mix of GUID-keyed and ID-keyed rows is replay safe', function ()
		{
			libAssert.strictEqual(_isChunkReplaySafe([ { [UPSERT_KEY]: 'LAKE-1' }, { ['ID' + ENTITY]: 9 } ], ENTITY), true);
		});

		// These mirror meadow's own predicates: `.length > 0` on the GUID and
		// `> 0` on the ID. A value that fails those is create-only, and a
		// replay of a create-only row duplicates it.
		test('an ID that meadow will not match on does not count', function ()
		{
			libAssert.strictEqual(_isChunkReplaySafe([ { ['ID' + ENTITY]: 0 } ], ENTITY), false, 'zero is never a valid ID');
			libAssert.strictEqual(_isChunkReplaySafe([ { ['ID' + ENTITY]: -1 } ], ENTITY), false);
			libAssert.strictEqual(_isChunkReplaySafe([ { ['ID' + ENTITY]: null } ], ENTITY), false);
			libAssert.strictEqual(_isChunkReplaySafe([ { ['ID' + ENTITY]: 'not-a-number' } ], ENTITY), false);
		});

		test('an empty or non-string GUID does not count', function ()
		{
			libAssert.strictEqual(_isChunkReplaySafe([ { [UPSERT_KEY]: '' } ], ENTITY), false);
			libAssert.strictEqual(_isChunkReplaySafe([ { [UPSERT_KEY]: null } ], ENTITY), false);
			libAssert.strictEqual(_isChunkReplaySafe([ { [UPSERT_KEY]: 12345 } ], ENTITY), false, 'meadow reads .length — a number never matches');
		});
	});

	test('a chunk keyed only by ID<Entity> IS replayed after a reset', async function ()
	{
		const tmpHarness = buildRetryHarness((pAttempt) => (pAttempt === 1) ? { Error: 'read ECONNRESET' } : null);
		let tmpRecords = [];
		for (let i = 1; i <= 10; i++)
		{
			tmpRecords.push({ ['ID' + ENTITY]: i, Payload: 'x' });
		}
		const tmpOutcome = await write(tmpHarness, tmpRecords);
		libAssert.strictEqual(tmpHarness.ledger.puts, 2, 'meadow matches on ID, so the replay updates rather than duplicating');
		libAssert.strictEqual(tmpOutcome.Result.Outputs.Written, 10);
		libAssert.strictEqual(tmpOutcome.Result.Outputs.Errors, 0);
		libAssert.strictEqual(tmpOutcome.Result.Outputs.ChunksRecovered, 1);
	});

	test('a chunk lost to ECONNRESET is replayed and the run loses nothing', async function ()
	{
		const tmpHarness = buildRetryHarness((pAttempt) => (pAttempt === 1) ? { Error: 'read ECONNRESET' } : null);
		const tmpOutcome = await write(tmpHarness, makeRecords(500, true));
		libAssert.strictEqual(tmpOutcome.Error, null);
		libAssert.strictEqual(tmpHarness.ledger.puts, 2, 'the chunk was sent again');
		libAssert.strictEqual(tmpOutcome.Result.Outputs.Written, 500, 'no records lost');
		libAssert.strictEqual(tmpOutcome.Result.Outputs.Errors, 0);
		libAssert.strictEqual(tmpOutcome.Result.Outputs.ChunksRecovered, 1);
		libAssert.match(tmpOutcome.Result.Log.join(' '), /1 chunk\(s\) recovered on retry/);
	});

	test('the replayed body is byte-identical to the one that failed', async function ()
	{
		const tmpHarness = buildRetryHarness((pAttempt) => (pAttempt === 1) ? { Error: 'read ECONNRESET' } : null);
		await write(tmpHarness, makeRecords(10, true));
		libAssert.strictEqual(tmpHarness.ledger.bodies.length, 2);
		libAssert.strictEqual(tmpHarness.ledger.bodies[0], tmpHarness.ledger.bodies[1]);
	});

	test('a chunk whose rows lack GUID<Entity> is NOT replayed — a replay would duplicate', async function ()
	{
		const tmpHarness = buildRetryHarness(() => ({ Error: 'read ECONNRESET' }));
		const tmpOutcome = await write(tmpHarness, makeRecords(500, false));
		libAssert.strictEqual(tmpOutcome.Error, null);
		libAssert.strictEqual(tmpHarness.ledger.puts, 1, 'exactly one attempt — no duplicate INSERTs');
		libAssert.strictEqual(tmpOutcome.Result.Outputs.Errors, 500, 'the loss is still reported');
		libAssert.strictEqual(tmpOutcome.Result.Outputs.ChunksRecovered, undefined);
	});

	test('a data failure is never replayed', async function ()
	{
		const tmpHarness = buildRetryHarness(() => ({ Status: 400 }));
		const tmpOutcome = await write(tmpHarness, makeRecords(500, true));
		libAssert.strictEqual(tmpHarness.ledger.puts, 1, 'a 400 means the data is wrong — sending it again cannot help');
		libAssert.strictEqual(tmpOutcome.Result.Outputs.Errors, 500);
	});

	test('a persistent outage exhausts the attempt budget and reports the loss', async function ()
	{
		const tmpHarness = buildRetryHarness(() => ({ Error: 'read ECONNRESET' }));
		const tmpOutcome = await write(tmpHarness, makeRecords(500, true));
		libAssert.strictEqual(tmpHarness.ledger.puts, 3, 'three attempts, then give up');
		libAssert.strictEqual(tmpOutcome.Result.Outputs.Errors, 500);
		libAssert.strictEqual(tmpOutcome.Result.Outputs.ChunksRecovered, 0);
		libAssert.strictEqual(tmpOutcome.Result.Outputs.ChunksRetried, 1);
		libAssert.strictEqual(tmpOutcome.Result.Outputs.ErrorLog[0].Attempts, 3);
		libAssert.match(tmpOutcome.Result.Log.join(' '), /1 still failing after 3 attempts/);
	});

	test('the attempt budget is configurable', async function ()
	{
		process.env.DATA_MAPPER_WRITE_RETRY_ATTEMPTS = '5';
		const tmpHarness = buildRetryHarness(() => ({ Error: 'read ECONNRESET' }));
		await write(tmpHarness, makeRecords(10, true));
		libAssert.strictEqual(tmpHarness.ledger.puts, 5);
		delete process.env.DATA_MAPPER_WRITE_RETRY_ATTEMPTS;
	});

	test('a clean write never retries and reports no retry stats', async function ()
	{
		const tmpHarness = buildRetryHarness(() => null);
		const tmpOutcome = await write(tmpHarness, makeRecords(1200, true));
		libAssert.strictEqual(tmpHarness.ledger.puts, 3, 'three chunks, one attempt each');
		libAssert.strictEqual(tmpOutcome.Result.Outputs.Written, 1200);
		libAssert.strictEqual(tmpOutcome.Result.Outputs.ChunksRetried, undefined);
	});
});
