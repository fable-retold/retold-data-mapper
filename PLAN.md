# retold-data-mapper: standalone service architecture

## The problem with the current implementation

The mapping editor is cobbled together as a test harness that hacks the Ultravisor — mounting static files on the UV's restify server, fighting CORS, and mixing concerns. retold-data-mapper should be its own standalone service, like retold-databeacon and retold-facto are. It runs on its own port, serves its own web UI, exposes its own REST API, and connects to any Ultravisor as a beacon.

## The pattern to follow

retold-databeacon is the reference implementation:
- `source/Retold-DataBeacon.js` — fable-serviceproviderbase service with Orator + static server + REST endpoints
- `bin/retold-databeacon.js` — CLI that creates a Pict instance, connects internal SQLite, starts the service
- `source/services/web-app/web/` — Pict application (HTML + bundled JS + CSS)
- `source/services/DataBeacon-BeaconProvider.js` — connects to Ultravisor, registers capabilities
- `source/services/DataBeacon-ConnectionBridge.js` — REST endpoints at `/beacon/*`

retold-data-mapper does the same thing:
- Own Orator server on its own port (default 8395 or similar)
- Own Pict web application for the visual mapping editor
- Own REST API at `/mapper/*` that dispatches through the mesh
- Beacon registration on connect

## Service architecture

```
retold-data-mapper process
├── Orator (Restify HTTP server on :8395)
│   ├── /mapper/beacons              GET — list beacons from mesh
│   ├── /mapper/beacon/:name/connections  GET — list connections on a beacon
│   ├── /mapper/beacon/:name/introspect   POST — introspect a connection
│   ├── /mapper/mappings             GET/POST — CRUD mapping configs (stored in internal SQLite)
│   ├── /mapper/mapping/:id          GET/PUT/DELETE
│   ├── /mapper/operations           GET/POST — CRUD Ultravisor operations
│   ├── /mapper/operation/:hash/run  POST — trigger an operation
│   ├── /mapper/operation/:hash/status GET — poll run status
│   ├── /mapper/ultravisor/connect   POST — connect to Ultravisor
│   ├── /mapper/ultravisor/status    GET — connection status
│   ├── /* (static)                  Pict web app (orator-static-server)
│   └── /pict.min.js                 Pict runtime (from pict package)
│
├── fable-ultravisor-client          HTTP client for Ultravisor dispatch
│   └── dispatches to: DataBeaconAccess, DataBeaconManagement, MeadowProxy
│
├── ultravisor-beacon                Beacon registration
│   └── capabilities: DataMapperSource, DataMapperRecords, DataMapperTransform
│
└── Internal SQLite (via meadow-connection-sqlite)
    ├── MappingConfig table — stored mapping configurations
    └── OperationTemplate table — saved operation graphs
```

## Pict web application

The web UI is a proper Pict application, following the patterns from `modules/pict/CLAUDE.md`.

### Application structure

```
source/services/web-app/
├── pict-app/
│   ├── Pict-Application-DataMapper.js     ← PictApplication subclass
│   ├── providers/
│   │   └── Pict-Provider-MapperAPI.js     ← provider that talks to /mapper/* REST API
│   └── views/
│       ├── PictView-Mapper-Layout.js      ← main layout shell
│       ├── PictView-Mapper-BeaconBrowser.js  ← beacon/connection/entity selector
│       ├── PictView-Mapper-FieldMapper.js    ← source fields ↔ target fields visual mapper
│       ├── PictView-Mapper-MappingList.js    ← saved mappings list
│       └── PictView-Mapper-JSONEditor.js     ← JSON config editor (dual mode)
├── web/
│   ├── index.html                         ← shell page, loads pict.min.js + bundle
│   ├── retold-data-mapper.js              ← Quackage browser bundle
│   └── css/
│       └── mapper.css                     ← base styles (CSS cascade handles view CSS)
└── build/
    └── (Quackage output)
```

### Application initialization

```javascript
class DataMapperApplication extends libPictApplication
{
    constructor(pFable, pOptions, pServiceHash)
    {
        super(pFable, pOptions, pServiceHash);
    }

    onAfterInitializeAsync(fCallback)
    {
        // Initialize AppData
        this.pict.AppData.Mapper = {
            UltravisorStatus: 'Disconnected',
            Beacons: [],
            SourceBeacon: null,
            SourceConnection: null,
            SourceEntity: null,
            SourceFields: [],
            TargetBeacon: null,
            TargetConnection: null,
            TargetEntity: null,
            TargetFields: [],
            Mappings: [],
            SavedMappings: []
        };

        // Register provider
        this.pict.addProvider('MapperAPI', libMapperAPIProvider.default_configuration, libMapperAPIProvider);

        // Register views
        this.pict.addView('Mapper-Layout', libLayoutView.default_configuration, libLayoutView);
        this.pict.addView('Mapper-BeaconBrowser', libBeaconBrowserView.default_configuration, libBeaconBrowserView);
        this.pict.addView('Mapper-FieldMapper', libFieldMapperView.default_configuration, libFieldMapperView);
        this.pict.addView('Mapper-MappingList', libMappingListView.default_configuration, libMappingListView);
        this.pict.addView('Mapper-JSONEditor', libJSONEditorView.default_configuration, libJSONEditorView);

        return super.onAfterInitializeAsync(fCallback);
    }
}
```

### Provider: MapperAPI

Talks to the mapper's OWN REST API (same origin, no CORS). All mesh dispatch happens server-side.

```javascript
class MapperAPIProvider extends libPictProvider
{
    // Beacons
    loadBeacons() { return fetch('/mapper/beacons').then(r => r.json()); }

    // Connections
    loadConnections(pBeaconName) { return fetch(`/mapper/beacon/${pBeaconName}/connections`).then(r => r.json()); }

    // Introspect
    introspect(pBeaconName, pConnID) { return fetch(`/mapper/beacon/${pBeaconName}/introspect`, { method: 'POST', body: JSON.stringify({ IDBeaconConnection: pConnID }) }).then(r => r.json()); }

    // Mappings (CRUD against internal SQLite)
    loadMappings() { return fetch('/mapper/mappings').then(r => r.json()); }
    saveMapping(pData) { return fetch('/mapper/mappings', { method: 'POST', body: JSON.stringify(pData) }).then(r => r.json()); }

    // Operations
    triggerOperation(pHash) { return fetch(`/mapper/operation/${pHash}/run`, { method: 'POST' }).then(r => r.json()); }
    pollStatus(pRunHash) { return fetch(`/mapper/operation/${pRunHash}/status`).then(r => r.json()); }
}
```

### Views

Each view follows the pict-view checklist:

**PictView-Mapper-BeaconBrowser** — beacon/connection/entity selector
- CSS in configuration, templates in Templates array
- Reads AppData.Mapper.Beacons, .SourceConnection, .SourceEntity
- Calls provider methods, writes results to AppData
- onclick handlers use `{~P~}.views['{~D:Record.ViewHash~}']`

**PictView-Mapper-FieldMapper** — the visual mapping canvas
- Source fields panel (from AppData.Mapper.SourceFields)
- Target fields panel (from AppData.Mapper.TargetFields)
- Mapping rows (from AppData.Mapper.Mappings)
- Click-to-map, drag-to-map interaction
- All DOM access via ContentAssignment

**PictView-Mapper-JSONEditor** — dual-mode config editor
- Visual mode: renders the FieldMapper view
- JSON mode: textarea with MappingConfiguration
- Import: file input + drag-drop for JSON files
- Export: generate + copy to clipboard

## REST API (server-side)

The mapper's REST endpoints dispatch to the Ultravisor mesh via the fable-ultravisor-client. The web UI never talks to the mesh directly.

```javascript
// In Retold-DataMapper.js, during initializeService():

// GET /mapper/beacons — list beacons from the Ultravisor
pOratorServiceServer.doGet('/mapper/beacons', (pReq, pRes, fNext) =>
{
    this._Client.request('GET', '/Beacon/Capabilities', null, (pError, pResult) =>
    {
        // Parse beacon list from capabilities
        pRes.send(tmpBeaconList);
        return fNext();
    });
});

// GET /mapper/beacon/:name/connections — dispatch ListConnections
pOratorServiceServer.doGet('/mapper/beacon/:name/connections', (pReq, pRes, fNext) =>
{
    this._Client.dispatch({
        Capability: 'DataBeaconAccess', Action: 'ListConnections',
        AffinityKey: pReq.params.name, TimeoutMs: 15000
    }, (pError, pResult) => { pRes.send(pResult.Outputs); fNext(); });
});
```

## CLI entry point

```
retold-data-mapper                          Start server on default port
retold-data-mapper --port 8395              Custom port
retold-data-mapper --ultravisor <url>       Auto-connect to Ultravisor on startup
retold-data-mapper --name my-mapper         Beacon name
```

The CLI:
1. Creates a Pict instance (not plain Fable — needed for parseTemplate)
2. Connects internal SQLite via MeadowConnectionManager
3. Instantiates Retold-DataMapper service
4. Starts Orator (serves web UI + REST API)
5. If --ultravisor provided, auto-connects as beacon

## Internal data model

Two tables in internal SQLite:

```sql
CREATE TABLE MappingConfig (
    IDMappingConfig INTEGER PRIMARY KEY AUTOINCREMENT,
    GUIDMappingConfig TEXT,
    CreateDate TEXT, CreatingIDUser INTEGER DEFAULT 0,
    UpdateDate TEXT, UpdatingIDUser INTEGER DEFAULT 0,
    Deleted INTEGER DEFAULT 0, DeleteDate TEXT, DeletingIDUser INTEGER DEFAULT 0,
    Name TEXT,
    Description TEXT,
    SourceBeaconName TEXT,
    SourceConnectionHash TEXT,
    SourceEntity TEXT,
    TargetBeaconName TEXT,
    TargetConnectionHash TEXT,
    TargetEntity TEXT,
    MappingConfiguration TEXT,
    FlowDiagramState TEXT
);
```

## Dependencies

```json
{
    "fable": "^3.1.70",
    "fable-serviceproviderbase": "^3.0.19",
    "fable-ultravisor-client": "^0.0.1",
    "meadow": "^2.0.37",
    "meadow-connection-sqlite": "^1.0.18",
    "meadow-endpoints": "^4.0.14",
    "meadow-integration": "^1.0.35",
    "orator": "^6.0.4",
    "orator-serviceserver-restify": "^2.0.10",
    "orator-static-server": "^2.0.4",
    "pict": "^1.0.364",
    "pict-application": "^1.0.33",
    "pict-view": "^1.0.68",
    "ultravisor-beacon": "^0.0.11"
}
```

## What exists and carries forward

- **Beacon capability handlers** (DataMapper-BeaconProvider.js) — these are correct; they dispatch through the mesh via fable-ultravisor-client
- **Mapping config JSON files** (test/harness/mappings/*.json) — valid MappingConfiguration format
- **Task type definitions** (source/services/definitions/*.json) — registered via beacon, show up in Ultravisor palette
- **Multi-connection provider isolation fix** (DataBeacon-DynamicEndpointManager.js) — upstream in retold-databeacon
- **Template preservation for Object settings** (Ultravisor-ExecutionEngine.cjs) — upstream in ultravisor
- **Introspector Meadow type mapping** (DataBeacon-SchemaIntrospector.js) — upstream in retold-databeacon
- **Seed data** (test/harness/seed-databases.js) — 50-city test dataset across 4 databases
- **Integration harness** (test/harness/run-harness.js) — automated E2E test
- **Unit tests** (test/DataMapper_tests.js) — 20 tests for validator, sync engine, reporter

## What gets rewritten

- **bin/retold-data-mapper.js** — proper CLI with Orator bootstrap (not the current mode-switching hack)
- **source/Retold-DataMapper.js** — proper fable service with Orator, static server, REST endpoints (not the current v0 plumbing orchestrator)
- **Web app** — proper Pict application with views/providers/templates (not the current raw HTML/JS)
- **test/dev-server.js** and **test/harness/interactive.js** — simplified to just "start the mapper service + optionally boot test beacons"

## Implementation order

1. Retold-DataMapper.js service skeleton — Orator, static server, beacon connect/disconnect endpoints
2. REST API endpoints — /mapper/beacons, /mapper/beacon/:name/connections, /mapper/beacon/:name/introspect
3. Pict application + provider — MapperAPI provider, Layout view
4. BeaconBrowser view — beacon/connection/entity selector using mesh dispatch
5. FieldMapper view — source ↔ target visual mapping
6. JSONEditor view — dual mode, import/export, drag-drop
7. Internal SQLite model + mapping CRUD endpoints
8. CLI polish — --port, --ultravisor, --name flags
9. Quackage build — browser bundle
10. Updated test harness that boots the mapper as a standalone service
