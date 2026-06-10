/**
 * Retold Data Mapper — Dispatcher Session Resilience Suite
 *
 * The dispatcher client (configureClient + _dispatch) previously had two
 * production-grade fragilities, both caught live:
 *   1. A single transient auth rejection at startup (UV mid-boot, auth-beacon
 *      inside its reconnect backoff during a stack restart) left the client
 *      permanently sessionless — every later self-dispatch failed with
 *      "Authentication required." until a manual restart.
 *   2. A session going stale under us (UV restart) made every streaming op
 *      silently report Pulled:0 for the same reason.
 *
 * These tests pin the fixes: startup auth retries with backoff, and
 * reauth-once-and-retry when a dispatch is rejected with
 * "Authentication required."  A stub UV server provides controllable
 * auth/dispatch behavior.
 */
const libAssert = require('assert');
const libHttp = require('http');
const libFable = require('fable');
const libBeaconProvider = require('../source/services/DataMapper-BeaconProvider.js');

const STATE =
{
	authFailuresRemaining: 0,
	authAttempts: 0,
	dispatchAttempts: 0,
	validCookies: new Set(),
	cookieCounter: 0,
	dispatchAlways401: false
};

function resetState()
{
	STATE.authFailuresRemaining = 0;
	STATE.authAttempts = 0;
	STATE.dispatchAttempts = 0;
	STATE.validCookies = new Set();
	STATE.cookieCounter = 0;
	STATE.dispatchAlways401 = false;
}

let _Server = null;
let _BaseURL = '';

function startStubUV()
{
	return new Promise((fResolve) =>
	{
		_Server = libHttp.createServer((pRequest, pResponse) =>
		{
			let tmpBuffer = '';
			pRequest.on('data', (pChunk) => { tmpBuffer += pChunk; });
			pRequest.on('end', () =>
			{
				const fSend = (pCode, pBody, pHeaders) =>
				{
					pResponse.writeHead(pCode, Object.assign({ 'Content-Type': 'application/json' }, pHeaders || {}));
					pResponse.end(JSON.stringify(pBody));
				};
				if (pRequest.method === 'POST' && pRequest.url === '/1.0/Authenticate')
				{
					STATE.authAttempts++;
					if (STATE.authFailuresRemaining > 0)
					{
						STATE.authFailuresRemaining--;
						return fSend(200, { LoggedIn: false, Error: 'Authentication failed.' });
					}
					STATE.cookieCounter++;
					const tmpCookie = `UVSession=session-${STATE.cookieCounter}`;
					STATE.validCookies.add(tmpCookie);
					return fSend(200, { LoggedIn: true }, { 'Set-Cookie': `${tmpCookie}; Path=/` });
				}
				if (pRequest.method === 'POST' && pRequest.url === '/Beacon/Work/Dispatch')
				{
					STATE.dispatchAttempts++;
					const tmpCookie = (pRequest.headers.cookie || '').split(';')[0].trim();
					if (STATE.dispatchAlways401 || !STATE.validCookies.has(tmpCookie))
					{
						return fSend(401, { Error: 'Authentication required.' });
					}
					return fSend(200, { Success: true, Outputs: { Echo: true } });
				}
				return fSend(404, { Error: 'stub: unhandled' });
			});
		});
		_Server.listen(0, '127.0.0.1', () =>
		{
			_BaseURL = `http://127.0.0.1:${_Server.address().port}`;
			fResolve();
		});
	});
}

function buildProvider()
{
	let tmpFable = new libFable({ Product: 'DispatcherReauthTest', LogStreams: [ { streamtype: 'console', level: 'fatal' } ] });
	tmpFable.serviceManager.addServiceType('DataMapperBeaconProvider', libBeaconProvider);
	return tmpFable.serviceManager.instantiateServiceProvider('DataMapperBeaconProvider');
}

function configure(pProvider)
{
	return new Promise((fResolve) => pProvider.configureClient(_BaseURL, 'u', 'p', fResolve));
}

function dispatch(pProvider)
{
	return new Promise((fResolve) => pProvider._dispatch(
		{ Capability: 'Test', Action: 'Echo', Settings: {} },
		(pError, pResult) => fResolve({ Error: pError, Result: pResult })));
}

suite('Dispatcher session resilience', function ()
{
	suiteSetup(async function ()
	{
		process.env.DATA_MAPPER_CLIENT_AUTH_RETRIES = '4';
		process.env.DATA_MAPPER_CLIENT_AUTH_BACKOFF_MS = '5';
		await startStubUV();
	});
	suiteTeardown(function ()
	{
		delete process.env.DATA_MAPPER_CLIENT_AUTH_RETRIES;
		delete process.env.DATA_MAPPER_CLIENT_AUTH_BACKOFF_MS;
		if (_Server) { _Server.close(); }
	});
	setup(resetState);

	test('startup auth retries through transient rejections (the stack-restart race)', async function ()
	{
		STATE.authFailuresRemaining = 2;
		const tmpProvider = buildProvider();
		const tmpError = await configure(tmpProvider);
		libAssert.strictEqual(tmpError, null);
		libAssert.strictEqual(STATE.authAttempts, 3, 'two failures + one success');
		const tmpOutcome = await dispatch(tmpProvider);
		libAssert.strictEqual(tmpOutcome.Error, null, 'dispatch works on the retried session');
	});

	test('startup auth gives up after the configured attempts with the real error', async function ()
	{
		STATE.authFailuresRemaining = 99;
		const tmpError = await configure(buildProvider());
		libAssert.ok(tmpError instanceof Error);
		libAssert.strictEqual(STATE.authAttempts, 4, 'exactly DATA_MAPPER_CLIENT_AUTH_RETRIES attempts');
	});

	test('a stale session reauths once and the dispatch succeeds (self-heal)', async function ()
	{
		const tmpProvider = buildProvider();
		await configure(tmpProvider);
		// Simulate a UV restart: every existing session is invalid.
		STATE.validCookies.clear();
		const tmpOutcome = await dispatch(tmpProvider);
		libAssert.strictEqual(tmpOutcome.Error, null, 'the retried dispatch must succeed');
		libAssert.strictEqual(tmpOutcome.Result.Outputs.Echo, true);
		libAssert.strictEqual(STATE.dispatchAttempts, 2, '401 then the post-reauth retry');
	});

	test('reauth-and-retry happens once, not in a loop', async function ()
	{
		const tmpProvider = buildProvider();
		await configure(tmpProvider);
		STATE.dispatchAlways401 = true;
		const tmpOutcome = await dispatch(tmpProvider);
		libAssert.ok(tmpOutcome.Error instanceof Error);
		libAssert.match(tmpOutcome.Error.message, /Authentication required/i);
		libAssert.strictEqual(STATE.dispatchAttempts, 2, 'original + exactly one retry');
	});

	test('a healthy session dispatches with no extra auth round-trips', async function ()
	{
		const tmpProvider = buildProvider();
		await configure(tmpProvider);
		const tmpAuthsBefore = STATE.authAttempts;
		const tmpOutcome = await dispatch(tmpProvider);
		libAssert.strictEqual(tmpOutcome.Error, null);
		libAssert.strictEqual(STATE.authAttempts, tmpAuthsBefore, 'no reauth on the happy path');
		libAssert.strictEqual(STATE.dispatchAttempts, 1);
	});
});

suite('ConnectionBridge mesh-call resilience', function ()
{
	const libConnectionBridge = require('../source/services/DataMapper-ConnectionBridge.js');

	function buildBridge(pClientStub)
	{
		let tmpFable = new libFable({ Product: 'BridgeReauthTest', LogStreams: [ { streamtype: 'console', level: 'fatal' } ] });
		tmpFable.serviceManager.addServiceType('DataMapperConnectionBridge', libConnectionBridge);
		let tmpBridge = tmpFable.serviceManager.instantiateServiceProvider('DataMapperConnectionBridge');
		tmpBridge.setOwner({ getUltravisorClient: () => pClientStub });
		return tmpBridge;
	}

	function staleThenHealthyClient(pLedger)
	{
		let tmpSessionFresh = false;
		return {
			dispatch: (pWorkItem, fCb) =>
			{
				pLedger.dispatches++;
				if (!tmpSessionFresh) { return fCb(new Error('Authentication required.')); }
				return fCb(null, { Outputs: { Echo: true } });
			},
			request: (pMethod, pPath, pBody, fCb) =>
			{
				pLedger.requests++;
				if (!tmpSessionFresh) { return fCb(new Error('Authentication required.')); }
				return fCb(null, { OK: true });
			},
			authenticate: (fCb) => { pLedger.auths++; tmpSessionFresh = true; return fCb(null); }
		};
	}

	test('_dispatch reauths once on a stale session and the retry succeeds', function (fDone)
	{
		const tmpLedger = { dispatches: 0, requests: 0, auths: 0 };
		const tmpBridge = buildBridge(staleThenHealthyClient(tmpLedger));
		tmpBridge._dispatch({ Capability: 'X', Action: 'Y', Settings: {} }, (pError, pResult) =>
		{
			libAssert.strictEqual(pError, null);
			libAssert.strictEqual(pResult.Outputs.Echo, true);
			libAssert.deepStrictEqual(tmpLedger, { dispatches: 2, requests: 0, auths: 1 });
			fDone();
		});
	});

	test('_request reauths once on a stale session and the retry succeeds', function (fDone)
	{
		const tmpLedger = { dispatches: 0, requests: 0, auths: 0 };
		const tmpBridge = buildBridge(staleThenHealthyClient(tmpLedger));
		tmpBridge._request('POST', '/Operation', {}, (pError, pResult) =>
		{
			libAssert.strictEqual(pError, null);
			libAssert.strictEqual(pResult.OK, true);
			libAssert.deepStrictEqual(tmpLedger, { dispatches: 0, requests: 2, auths: 1 });
			fDone();
		});
	});

	test('a persistent rejection surfaces after exactly one retry', function (fDone)
	{
		const tmpLedger = { dispatches: 0, auths: 0 };
		const tmpClient = {
			dispatch: (pWorkItem, fCb) => { tmpLedger.dispatches++; return fCb(new Error('Authentication required.')); },
			authenticate: (fCb) => { tmpLedger.auths++; return fCb(null); }
		};
		buildBridge(tmpClient)._dispatch({ Capability: 'X', Action: 'Y' }, (pError) =>
		{
			libAssert.ok(pError instanceof Error);
			libAssert.strictEqual(tmpLedger.dispatches, 2, 'original + one retry only');
			fDone();
		});
	});

	test('non-auth errors pass through without reauth', function (fDone)
	{
		const tmpLedger = { dispatches: 0, auths: 0 };
		const tmpClient = {
			dispatch: (pWorkItem, fCb) => { tmpLedger.dispatches++; return fCb(new Error('socket hang up')); },
			authenticate: (fCb) => { tmpLedger.auths++; return fCb(null); }
		};
		buildBridge(tmpClient)._dispatch({ Capability: 'X', Action: 'Y' }, (pError) =>
		{
			libAssert.match(pError.message, /socket hang up/);
			libAssert.deepStrictEqual(tmpLedger, { dispatches: 1, auths: 0 });
			fDone();
		});
	});
});
