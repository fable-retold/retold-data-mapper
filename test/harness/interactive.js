#!/usr/bin/env node
/**
 * Retold Data Mapper — Interactive Harness
 *
 * Boots the full real-database stack with pre-seeded connections and the
 * mapper service running standalone. Stays up so you can drive the web UIs.
 *
 * Web UIs:
 *   Mapping Editor          http://localhost:18400/
 *   MySQL DataBeacon         http://localhost:18390/
 *   PostgreSQL DataBeacon    http://localhost:18391/
 *   Ultravisor Flow Editor  http://localhost:18422/
 *
 * Pre-configured:
 *   MySQL beacon:
 *     conn #1 → weather_stations (endpoints: WeatherStation, WeatherReading)
 *     conn #2 → city_dashboard   (endpoints: City, WeatherSummary, TransitSummary, CityMetadata)
 *   PostgreSQL beacon:
 *     conn #1 → demographics     (endpoint: CityProfile)
 *     conn #2 → transit_systems  (endpoint: TransitSystem)
 *   Mapper beacon: registered on Ultravisor, routing pinned
 *
 * Prerequisites: npm run seed
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
const libRetoldDataMapper = require('../../source/Retold-DataMapper.js');
const libUltravisor = require('ultravisor');
const libUltravisorAPIServer = require('ultravisor/source/web_server/Ultravisor-API-Server.cjs');

const UV_PORT = 18422;
const MYSQL_BEACON_PORT = 18390;
const PG_BEACON_PORT = 18391;
const MAPPER_PORT = 18400;

const MYSQL_WEATHER = { host: '127.0.0.1', port: 3306, user: 'root', password: '1234567890', database: 'weather_stations' };
const MYSQL_DASHBOARD = { host: '127.0.0.1', port: 3306, user: 'root', password: '1234567890', database: 'city_dashboard' };
const PG_DEMOGRAPHICS = { host: '127.0.0.1', port: 5432, user: 'postgres', password: 'retold1234567890', database: 'demographics' };
const PG_TRANSIT = { host: '127.0.0.1', port: 5432, user: 'postgres', password: 'retold1234567890', database: 'transit_systems' };

let _UVFable = null;
let _MySQLFable = null;
let _PGFable = null;
let _MapperFable = null;
let _MapperService = null;

function httpReq(pPort, pMethod, pPath, pBody)
{
	return new Promise((fR, fJ) =>
	{
		let tmpBody = pBody ? JSON.stringify(pBody) : '';
		let tmpHeaders = { 'Content-Type': 'application/json' };
		if (tmpBody) { tmpHeaders['Content-Length'] = Buffer.byteLength(tmpBody); }
		let tmpReq = libHTTP.request({ hostname: '127.0.0.1', port: pPort, path: pPath, method: pMethod, headers: tmpHeaders }, (pRes) =>
		{
			let tmpChunks = [];
			pRes.on('data', (pC) => tmpChunks.push(pC));
			pRes.on('end', () =>
			{
				let tmpRaw = Buffer.concat(tmpChunks).toString();
				try { fR(JSON.parse(tmpRaw)); } catch (e) { fR(tmpRaw); }
			});
		});
		tmpReq.on('error', fJ);
		if (tmpBody && (pMethod === 'POST' || pMethod === 'PUT')) { tmpReq.write(tmpBody); }
		tmpReq.end();
	});
}

function mysql(pM, pP, pB) { return httpReq(MYSQL_BEACON_PORT, pM, pP, pB); }
function pg(pM, pP, pB) { return httpReq(PG_BEACON_PORT, pM, pP, pB); }
function sleep(pMs) { return new Promise((fR) => setTimeout(fR, pMs)); }

function bootUltravisor(fCB)
{
	_UVFable = new libPict({ Product: 'Interactive-UV', LogNoisiness: 0, APIServerPort: UV_PORT, LogStreams: [{ streamtype: 'console', level: 'warn' }] });
	let tmpRoot = libPath.resolve(__dirname, '..', '..', 'node_modules', 'ultravisor');
	let tmpConfig = {};
	try { tmpConfig = JSON.parse(libFs.readFileSync(libPath.join(tmpRoot, '.ultravisor.json'), 'utf8')); } catch (e) { /* ok */ }
	tmpConfig.UltravisorAPIServerPort = UV_PORT;
	tmpConfig.UltravisorWebInterfacePath = libPath.join(tmpRoot, 'webinterface', 'dist');
	_UVFable.ProgramConfiguration = tmpConfig;
	_UVFable.gatherProgramConfiguration = () => ({ GatherPhases: [], Settings: tmpConfig });
	['TaskTypeRegistry', 'StateManager', 'ExecutionEngine', 'ExecutionManifest', 'HypervisorState', 'Hypervisor', 'BeaconCoordinator'].forEach((pS) =>
	{
		_UVFable.serviceManager.addServiceType('Ultravisor' + pS, libUltravisor[pS]);
		_UVFable.serviceManager.instantiateServiceProvider('Ultravisor' + pS);
	});
	_UVFable.UltravisorTaskTypeRegistry.registerBuiltInTaskTypes();

	let libDataMapperTaskConfigs = require('../../source/services/DataMapper-TaskConfigs.js');
	_UVFable.UltravisorTaskTypeRegistry.registerTaskTypesFromConfigArray(libDataMapperTaskConfigs);

	_UVFable.serviceManager.addServiceType('UltravisorAPIServer', libUltravisorAPIServer);
	_UVFable.serviceManager.instantiateServiceProvider('UltravisorAPIServer').start(fCB);
}

function bootBeacon(pLabel, pPort, pDBPath, fCB)
{
	let tmpFable = new libPict({ Product: `Interactive-${pLabel}`, ProductVersion: '0.0.1', APIServerPort: pPort, LogStreams: [{ streamtype: 'console', level: 'warn' }], SQLite: { SQLiteFilePath: pDBPath } });
	tmpFable.serviceManager.addServiceType('MeadowConnectionManager', libMeadowConnectionManager);
	tmpFable.serviceManager.instantiateServiceProvider('MeadowConnectionManager');
	tmpFable.MeadowConnectionManager.connect('databeacon', { Type: 'SQLite', SQLiteFilePath: pDBPath }, (pE, pC) =>
	{
		if (pE) { return fCB(pE); }
		tmpFable.MeadowSQLiteProvider = pC.instance;
		tmpFable.settings.MeadowProvider = 'SQLite';
		tmpFable.serviceManager.addServiceType('RetoldDataBeacon', libRetoldDataBeacon);
		tmpFable.serviceManager.instantiateServiceProvider('RetoldDataBeacon',
			{
				AutoCreateSchema: true, AutoStartOrator: true,
				FullMeadowSchemaPath: libPath.resolve(__dirname, '..', '..', 'node_modules', 'retold-databeacon', 'model') + '/',
				FullMeadowSchemaFilename: 'MeadowModel-DataBeacon.json',
				Endpoints: { MeadowEndpoints: true, ConnectionBridge: true, SchemaIntrospector: true, DynamicEndpointManager: true, BeaconProvider: true, WebUI: true }
			}).initializeService((pIE) =>
			{
				if (pIE) { return fCB(pIE); }
				fCB(null, tmpFable);
			});
	});
}

function bootMapper(pDBPath, fCB)
{
	_MapperFable = new libPict(
		{
			Product: 'Interactive-Mapper',
			APIServerPort: MAPPER_PORT,
			LogStreams: [{ streamtype: 'console', level: 'warn' }],
			SQLite: { SQLiteFilePath: pDBPath }
		});

	_MapperFable.serviceManager.addServiceType('MeadowConnectionManager', libMeadowConnectionManager);
	_MapperFable.serviceManager.instantiateServiceProvider('MeadowConnectionManager');

	_MapperFable.MeadowConnectionManager.connect('datamapper', { Type: 'SQLite', SQLiteFilePath: pDBPath }, (pE, pC) =>
	{
		if (pE) { return fCB(pE); }
		_MapperFable.MeadowSQLiteProvider = pC.instance;
		_MapperFable.settings.MeadowProvider = 'SQLite';
		_MapperFable.serviceManager.addServiceType('RetoldDataMapper', libRetoldDataMapper);
		_MapperService = _MapperFable.serviceManager.instantiateServiceProvider('RetoldDataMapper',
			{
				AutoCreateSchema: true,
				FullMeadowSchemaPath: libPath.join(__dirname, '..', '..', 'model') + '/',
				FullMeadowSchemaFilename: 'MeadowModel-DataMapper.json',
				Endpoints: { MeadowEndpoints: true, ConnectionBridge: true, WebUI: true },
				Ultravisor: { URL: `http://localhost:${UV_PORT}`, BeaconName: 'data-mapper' }
			});
		_MapperService.initializeService((pIE) => { if (pIE) return fCB(pIE); fCB(null); });
	});
}

function pinRouting()
{
	let tmpCoord = _UVFable.UltravisorBeaconCoordinator;
	let tmpExpiry = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
	Object.values(tmpCoord._Beacons).forEach((pB) =>
	{
		tmpCoord._AffinityBindings[pB.Name] = { AffinityKey: pB.Name, BeaconID: pB.BeaconID, RunHash: '', CreatedAt: new Date().toISOString(), ExpiresAt: tmpExpiry };
	});
}

function shutdown()
{
	console.log('\n  Shutting down...');
	try { if (_MapperService) _MapperService.stopService(() => {}); } catch (e) { /* ok */ }
	[_MySQLFable, _PGFable, _UVFable].forEach((pFable) =>
	{
		try { if (pFable && pFable.OratorServiceServer && pFable.OratorServiceServer.server) pFable.OratorServiceServer.server.close(); } catch (e) { /* ok */ }
	});
	setTimeout(() => process.exit(0), 2000);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function main()
{
	console.log('');
	console.log('══════════════════════════════════════════════════════════');
	console.log('  Retold Data Mapper — Interactive Harness');
	console.log('══════════════════════════════════════════════════════════');
	console.log('');

	let tmpDataDir = libPath.join(__dirname, '..', '..', 'data');
	if (!libFs.existsSync(tmpDataDir)) { libFs.mkdirSync(tmpDataDir, { recursive: true }); }
	libFs.readdirSync(tmpDataDir).filter((f) => f.startsWith('interactive-')).forEach((f) =>
	{
		try { libFs.unlinkSync(libPath.join(tmpDataDir, f)); } catch (e) { /* ok */ }
	});

	try
	{
		console.log('  Booting stack...');
		await new Promise((fR, fJ) => bootUltravisor((e) => e ? fJ(e) : fR()));
		await new Promise((fR, fJ) => bootBeacon('MySQL', MYSQL_BEACON_PORT, libPath.join(tmpDataDir, 'interactive-mysql.sqlite'),
			(e, f) => { if (e) return fJ(e); _MySQLFable = f; fR(); }));
		await new Promise((fR, fJ) => bootBeacon('PG', PG_BEACON_PORT, libPath.join(tmpDataDir, 'interactive-pg.sqlite'),
			(e, f) => { if (e) return fJ(e); _PGFable = f; fR(); }));

		await mysql('POST', '/beacon/ultravisor/connect', { ServerURL: `http://localhost:${UV_PORT}`, Name: 'mysql-beacon', MaxConcurrent: 3 });
		await pg('POST', '/beacon/ultravisor/connect', { ServerURL: `http://localhost:${UV_PORT}`, Name: 'pg-beacon', MaxConcurrent: 3 });
		await sleep(500);

		await new Promise((fR, fJ) => bootMapper(libPath.join(tmpDataDir, 'interactive-mapper.sqlite'), (e) => e ? fJ(e) : fR()));
		await sleep(500);
		pinRouting();

		console.log('  Seeding connections...');

		let tmpW = await mysql('POST', '/beacon/connection', { Name: 'Weather-MySQL', Type: 'MySQL', Config: MYSQL_WEATHER, AutoConnect: true });
		await mysql('POST', `/beacon/connection/${tmpW.Connection.IDBeaconConnection}/connect`, {});
		await mysql('POST', `/beacon/connection/${tmpW.Connection.IDBeaconConnection}/introspect`, {});
		await mysql('POST', `/beacon/endpoint/${tmpW.Connection.IDBeaconConnection}/WeatherStation/enable`, {});
		await mysql('POST', `/beacon/endpoint/${tmpW.Connection.IDBeaconConnection}/WeatherReading/enable`, {});

		let tmpD = await mysql('POST', '/beacon/connection', { Name: 'Dashboard-MySQL', Type: 'MySQL', Config: MYSQL_DASHBOARD, AutoConnect: true });
		await mysql('POST', `/beacon/connection/${tmpD.Connection.IDBeaconConnection}/connect`, {});
		await mysql('POST', `/beacon/connection/${tmpD.Connection.IDBeaconConnection}/introspect`, {});
		await mysql('POST', `/beacon/endpoint/${tmpD.Connection.IDBeaconConnection}/City/enable`, {});
		await mysql('POST', `/beacon/endpoint/${tmpD.Connection.IDBeaconConnection}/WeatherSummary/enable`, {});
		await mysql('POST', `/beacon/endpoint/${tmpD.Connection.IDBeaconConnection}/TransitSummary/enable`, {});
		await mysql('POST', `/beacon/endpoint/${tmpD.Connection.IDBeaconConnection}/CityMetadata/enable`, {});

		let tmpDm = await pg('POST', '/beacon/connection', { Name: 'Demographics-PG', Type: 'PostgreSQL', Config: PG_DEMOGRAPHICS, AutoConnect: true });
		await pg('POST', `/beacon/connection/${tmpDm.Connection.IDBeaconConnection}/connect`, {});
		await pg('POST', `/beacon/connection/${tmpDm.Connection.IDBeaconConnection}/introspect`, {});
		await pg('POST', `/beacon/endpoint/${tmpDm.Connection.IDBeaconConnection}/CityProfile/enable`, {});

		let tmpT = await pg('POST', '/beacon/connection', { Name: 'Transit-PG', Type: 'PostgreSQL', Config: PG_TRANSIT, AutoConnect: true });
		await pg('POST', `/beacon/connection/${tmpT.Connection.IDBeaconConnection}/connect`, {});
		await pg('POST', `/beacon/connection/${tmpT.Connection.IDBeaconConnection}/introspect`, {});
		await pg('POST', `/beacon/endpoint/${tmpT.Connection.IDBeaconConnection}/TransitSystem/enable`, {});

		console.log('  Connections ready: Weather + Dashboard (MySQL), Demographics + Transit (PG)');
		console.log('');
		console.log('══════════════════════════════════════════════════════════');
		console.log('  Ready!');
		console.log('══════════════════════════════════════════════════════════');
		console.log('');
		console.log('  Open in your browser:');
		console.log(`    Mapping Editor    http://localhost:${MAPPER_PORT}/`);
		console.log(`    MySQL Beacon      http://localhost:${MYSQL_BEACON_PORT}/`);
		console.log(`    PG Beacon         http://localhost:${PG_BEACON_PORT}/`);
		console.log(`    Ultravisor        http://localhost:${UV_PORT}/`);
		console.log('');
		console.log('  Press Ctrl-C to stop.');
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
