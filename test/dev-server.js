#!/usr/bin/env node
/**
 * Retold Data Mapper — Dev Server
 *
 * Boots a mini mesh for manual testing of the mapping editor:
 *
 *   Mapper (web + API) :18400    http://localhost:18400/
 *   Ultravisor         :18422    http://localhost:18422/
 *   Source DataBeacon  :18390    http://localhost:18390/
 *   Target DataBeacon  :18391    http://localhost:18391/
 *
 * The mapper service runs as a standalone beacon — serving its own web UI
 * on 18400 and dispatching via the Ultravisor on 18422. Both DataBeacons
 * auto-register with the Ultravisor.
 *
 * Workflow:
 *   1. Open http://localhost:18400/       (mapping editor)
 *   2. Click Connect (URL is pre-filled with the Ultravisor)
 *   3. Pick source + target beacons, connections, entities
 *   4. Map fields, save, export JSON
 *
 * Press Ctrl-C to stop.
 *
 * @author Steven Velozo <steven@velozo.com>
 */
'use strict';

const libPath = require('path');
const libFs = require('fs');
const libHTTP = require('http');

const libPict = require('pict');
const libMeadowConnectionManager = require('meadow-connection-manager');
const libRetoldDataBeacon = require('retold-databeacon');
const libRetoldDataMapper = require('../source/Retold-DataMapper.js');
const libUltravisor = require('ultravisor');
const libUltravisorAPIServer = require('ultravisor/source/web_server/Ultravisor-API-Server.cjs');

const ULTRAVISOR_PORT = 18422;
const SOURCE_BEACON_PORT = 18390;
const TARGET_BEACON_PORT = 18391;
const MAPPER_PORT = 18400;

const SOURCE_BEACON_NAME = 'source-beacon';
const TARGET_BEACON_NAME = 'target-beacon';
const MAPPER_BEACON_NAME = 'data-mapper';

let _DataDir = libPath.join(__dirname, '..', 'data');
if (!libFs.existsSync(_DataDir)) { libFs.mkdirSync(_DataDir, { recursive: true }); }

libFs.readdirSync(_DataDir).forEach((pFile) =>
{
	if (pFile.startsWith('dev-')) { try { libFs.unlinkSync(libPath.join(_DataDir, pFile)); } catch (e) { /* ok */ } }
});

let _SourceDBPath = libPath.join(_DataDir, 'dev-source-beacon.sqlite');
let _TargetDBPath = libPath.join(_DataDir, 'dev-target-beacon.sqlite');
let _MapperDBPath = libPath.join(_DataDir, 'dev-data-mapper.sqlite');

let _UltravisorFable = null;
let _SourceFable = null;
let _TargetFable = null;
let _MapperFable = null;
let _MapperService = null;

// ── Small HTTP helper ───────────────────────────────────────────

function httpPost(pPort, pPath, pBody)
{
	return new Promise((fResolve, fReject) =>
	{
		let tmpBody = JSON.stringify(pBody || {});
		let tmpReq = libHTTP.request(
			{
				hostname: '127.0.0.1', port: pPort, path: pPath, method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(tmpBody) }
			},
			(pRes) =>
			{
				let tmpChunks = [];
				pRes.on('data', (pC) => tmpChunks.push(pC));
				pRes.on('end', () =>
				{
					let tmpRaw = Buffer.concat(tmpChunks).toString();
					try { fResolve(JSON.parse(tmpRaw)); }
					catch (e) { fResolve(tmpRaw); }
				});
			});
		tmpReq.on('error', fReject);
		tmpReq.write(tmpBody);
		tmpReq.end();
	});
}

// ── Boot Ultravisor ─────────────────────────────────────────────

function startUltravisor(fCallback)
{
	console.log(`  [1/4] Starting Ultravisor on port ${ULTRAVISOR_PORT}...`);

	_UltravisorFable = new libPict(
		{
			Product: 'DevMapperUltravisor',
			LogNoisiness: 0,
			APIServerPort: ULTRAVISOR_PORT,
			LogStreams: [{ streamtype: 'console', level: 'warn' }]
		});

	let tmpUltravisorRoot = libPath.resolve(__dirname, '..', 'node_modules', 'ultravisor');
	let tmpConfigPath = libPath.join(tmpUltravisorRoot, '.ultravisor.json');
	let tmpConfig = {};
	try { tmpConfig = JSON.parse(libFs.readFileSync(tmpConfigPath, 'utf8')); } catch (e) { /* ok */ }
	tmpConfig.UltravisorAPIServerPort = ULTRAVISOR_PORT;
	tmpConfig.UltravisorWebInterfacePath = libPath.join(tmpUltravisorRoot, 'webinterface', 'dist');
	_UltravisorFable.ProgramConfiguration = tmpConfig;
	_UltravisorFable.gatherProgramConfiguration = function () { return { GatherPhases: [], Settings: tmpConfig }; };

	['TaskTypeRegistry', 'StateManager', 'ExecutionEngine', 'ExecutionManifest', 'HypervisorState', 'Hypervisor', 'BeaconCoordinator'].forEach((pS) =>
	{
		_UltravisorFable.serviceManager.addServiceType('Ultravisor' + pS, libUltravisor[pS]);
		_UltravisorFable.serviceManager.instantiateServiceProvider('Ultravisor' + pS);
	});
	_UltravisorFable.UltravisorTaskTypeRegistry.registerBuiltInTaskTypes();

	// Register the data-mapper task types so operation graphs can reference them.
	let libDataMapperTaskConfigs = require('../source/services/DataMapper-TaskConfigs.js');
	_UltravisorFable.UltravisorTaskTypeRegistry.registerTaskTypesFromConfigArray(libDataMapperTaskConfigs);

	_UltravisorFable.serviceManager.addServiceType('UltravisorAPIServer', libUltravisorAPIServer);
	let tmpAPIServer = _UltravisorFable.serviceManager.instantiateServiceProvider('UltravisorAPIServer');

	tmpAPIServer.start((pError) =>
	{
		if (pError) { return fCallback(pError); }
		console.log(`        Ultravisor ready:  http://localhost:${ULTRAVISOR_PORT}`);
		return fCallback(null);
	});
}

// ── Boot one DataBeacon ─────────────────────────────────────────

function startBeacon(pLabel, pPort, pDBPath, fCallback)
{
	let tmpFable = new libPict(
		{
			Product: `DevMapper-${pLabel}`,
			ProductVersion: '0.0.1',
			APIServerPort: pPort,
			LogStreams: [{ streamtype: 'console', level: 'warn' }],
			SQLite: { SQLiteFilePath: pDBPath }
		});

	tmpFable.serviceManager.addServiceType('MeadowConnectionManager', libMeadowConnectionManager);
	tmpFable.serviceManager.instantiateServiceProvider('MeadowConnectionManager');

	tmpFable.MeadowConnectionManager.connect('databeacon',
		{ Type: 'SQLite', SQLiteFilePath: pDBPath },
		(pError, pConnection) =>
		{
			if (pError) { return fCallback(pError); }

			tmpFable.MeadowSQLiteProvider = pConnection.instance;
			tmpFable.settings.MeadowProvider = 'SQLite';

			tmpFable.serviceManager.addServiceType('RetoldDataBeacon', libRetoldDataBeacon);
			let tmpBeacon = tmpFable.serviceManager.instantiateServiceProvider('RetoldDataBeacon',
				{
					AutoCreateSchema: true,
					AutoStartOrator: true,
					FullMeadowSchemaPath: libPath.resolve(__dirname, '..', 'node_modules', 'retold-databeacon', 'model') + '/',
					FullMeadowSchemaFilename: 'MeadowModel-DataBeacon.json',
					Endpoints:
					{
						MeadowEndpoints: true,
						ConnectionBridge: true,
						SchemaIntrospector: true,
						DynamicEndpointManager: true,
						BeaconProvider: true,
						WebUI: true
					}
				});

			tmpBeacon.initializeService((pInitError) =>
			{
				if (pInitError) { return fCallback(pInitError); }
				console.log(`        ${pLabel} ready:  http://localhost:${pPort}`);
				return fCallback(null, tmpFable);
			});
		});
}

// ── Boot the mapper service (standalone) ────────────────────────

function startMapper(fCallback)
{
	console.log(`  [3/4] Starting Data Mapper on port ${MAPPER_PORT}...`);

	_MapperFable = new libPict(
		{
			Product: 'DevMapper-Service',
			ProductVersion: '0.0.1',
			APIServerPort: MAPPER_PORT,
			LogStreams: [{ streamtype: 'console', level: 'warn' }],
			SQLite: { SQLiteFilePath: _MapperDBPath }
		});

	_MapperFable.serviceManager.addServiceType('MeadowConnectionManager', libMeadowConnectionManager);
	_MapperFable.serviceManager.instantiateServiceProvider('MeadowConnectionManager');

	_MapperFable.MeadowConnectionManager.connect('datamapper',
		{ Type: 'SQLite', SQLiteFilePath: _MapperDBPath },
		(pConnError, pConnection) =>
		{
			if (pConnError) { return fCallback(pConnError); }

			_MapperFable.MeadowSQLiteProvider = pConnection.instance;
			_MapperFable.settings.MeadowProvider = 'SQLite';

			_MapperFable.serviceManager.addServiceType('RetoldDataMapper', libRetoldDataMapper);
			_MapperService = _MapperFable.serviceManager.instantiateServiceProvider('RetoldDataMapper',
				{
					AutoCreateSchema: true,
					FullMeadowSchemaPath: libPath.join(__dirname, '..', 'model') + '/',
					FullMeadowSchemaFilename: 'MeadowModel-DataMapper.json',
					Endpoints:
					{
						MeadowEndpoints: true,
						ConnectionBridge: true,
						WebUI: true
					},
					Ultravisor:
					{
						URL: `http://localhost:${ULTRAVISOR_PORT}`,
						BeaconName: MAPPER_BEACON_NAME
					}
				});

			_MapperService.initializeService((pInitError) =>
			{
				if (pInitError) { return fCallback(pInitError); }
				console.log(`        Mapper ready:      http://localhost:${MAPPER_PORT}`);
				return fCallback(null);
			});
		});
}

// ── Register beacons + pin routing ──────────────────────────────

async function registerAndPinBeacons()
{
	console.log(`\n  [4/4] Registering beacons with Ultravisor...`);

	let tmpSource = await httpPost(SOURCE_BEACON_PORT, '/beacon/ultravisor/connect',
		{ ServerURL: `http://localhost:${ULTRAVISOR_PORT}`, Name: SOURCE_BEACON_NAME, MaxConcurrent: 3 });
	console.log(`        ${SOURCE_BEACON_NAME}: ${tmpSource.Status || tmpSource.Error || 'ok'}`);

	let tmpTarget = await httpPost(TARGET_BEACON_PORT, '/beacon/ultravisor/connect',
		{ ServerURL: `http://localhost:${ULTRAVISOR_PORT}`, Name: TARGET_BEACON_NAME, MaxConcurrent: 3 });
	console.log(`        ${TARGET_BEACON_NAME}: ${tmpTarget.Status || tmpTarget.Error || 'ok'}`);

	await new Promise((fR) => setTimeout(fR, 500));

	let tmpCoordinator = _UltravisorFable.UltravisorBeaconCoordinator;
	let tmpExpiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
	Object.values(tmpCoordinator._Beacons).forEach((pB) =>
	{
		tmpCoordinator._AffinityBindings[pB.Name] =
		{
			AffinityKey: pB.Name, BeaconID: pB.BeaconID, RunHash: '',
			CreatedAt: new Date().toISOString(), ExpiresAt: tmpExpiresAt
		};
		console.log(`        Routing pinned: ${pB.Name} → ${pB.BeaconID}`);
	});
}

// ── Shutdown ────────────────────────────────────────────────────

function shutdown()
{
	console.log('\n  Shutting down...');
	let tmpRemaining = 4;
	let fDone = () => { tmpRemaining--; if (tmpRemaining <= 0) process.exit(0); };

	if (_MapperService) { try { _MapperService.stopService(fDone); } catch (e) { fDone(); } }
	else fDone();

	[_SourceFable, _TargetFable, _UltravisorFable].forEach((pFable) =>
	{
		try
		{
			if (pFable && pFable.OratorServiceServer && pFable.OratorServiceServer.server)
			{
				pFable.OratorServiceServer.server.close(fDone);
				return;
			}
		}
		catch (e) { /* ignore */ }
		fDone();
	});

	setTimeout(() => process.exit(0), 5000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ── Main ────────────────────────────────────────────────────────

async function main()
{
	console.log('');
	console.log('════════════════════════════════════════════════════════════');
	console.log('  Retold Data Mapper — Dev Server');
	console.log('════════════════════════════════════════════════════════════');
	console.log('');

	try
	{
		await new Promise((fR, fJ) => startUltravisor((e) => e ? fJ(e) : fR()));

		console.log(`  [2/4] Starting DataBeacons...`);
		await new Promise((fR, fJ) => startBeacon('Source', SOURCE_BEACON_PORT, _SourceDBPath,
			(e, f) => { if (e) return fJ(e); _SourceFable = f; fR(); }));
		await new Promise((fR, fJ) => startBeacon('Target', TARGET_BEACON_PORT, _TargetDBPath,
			(e, f) => { if (e) return fJ(e); _TargetFable = f; fR(); }));

		await new Promise((fR, fJ) => startMapper((e) => e ? fJ(e) : fR()));

		await registerAndPinBeacons();

		console.log('');
		console.log('════════════════════════════════════════════════════════════');
		console.log('  Ready!  Ctrl-C to stop.');
		console.log('════════════════════════════════════════════════════════════');
		console.log('');
		console.log('  Web UIs:');
		console.log(`    Mapping Editor     http://localhost:${MAPPER_PORT}/`);
		console.log(`    Source DataBeacon   http://localhost:${SOURCE_BEACON_PORT}/`);
		console.log(`    Target DataBeacon   http://localhost:${TARGET_BEACON_PORT}/`);
		console.log(`    Ultravisor          http://localhost:${ULTRAVISOR_PORT}/`);
		console.log('');
	}
	catch (pError)
	{
		console.error(`\n  FATAL: ${pError.message}`);
		console.error(pError.stack);
		shutdown();
	}
}

main();
