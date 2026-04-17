# retold-data-mapper

Cross-beacon schema mapping and data sync via the Ultravisor mesh.

## What this module is

A standalone service (like retold-databeacon and retold-facto) that:
- Runs its own Orator server on its own port
- Serves its own Pict web application for visual field mapping
- Connects to any Ultravisor as a beacon
- Dispatches all mesh operations via fable-ultravisor-client (never talks to other beacons directly)

## Current state

The beacon capabilities, task types, mapping configs, and test harness all work. The web UI needs rewriting as a proper Pict application (currently raw HTML/JS). Read `PLAN.md` for the full architectural plan.

**What works and should NOT be rewritten:**
- `source/services/DataMapper-BeaconProvider.js` — beacon capability handlers (5 actions)
- `source/services/DataMapper-TaskConfigs.js` — task type definitions + executors
- `source/services/definitions/*.json` — task type JSON definitions
- `source/services/executors/*.js` — execute implementations
- `test/harness/seed-databases.js` — 50-city test dataset seeder
- `test/harness/run-harness.js` — automated 4-entity E2E test
- `test/harness/mappings/*.json` — MappingConfiguration files
- `test/DataMapper_tests.js` — 20 unit tests

**What needs rewriting (see PLAN.md):**
- `source/Retold-DataMapper.js` — rewrite as proper fable service with Orator + static server + REST endpoints
- `bin/retold-data-mapper.js` — rewrite as proper CLI with Pict bootstrap (follow retold-databeacon/bin/ pattern)
- `source/services/web-app/` — rewrite as proper Pict application (follow modules/pict/CLAUDE.md patterns)

## Architecture rules

1. **This is a beacon, not an Ultravisor extension.** Never mount routes on the Ultravisor's server. Never import ultravisor internals except ultravisor-beacon.
2. **The web UI talks to its OWN REST API at `/mapper/*`.** The server dispatches through the mesh. No CORS because same origin.
3. **Follow retold-databeacon's service pattern.** Orator + orator-static-server for the web UI. fable-serviceproviderbase for the service class. Pict (not plain Fable) for parseTemplate support.
4. **Follow the Pict view checklist** from `modules/pict/CLAUDE.md`. CSS in config, templates in Templates array, ContentAssignment for DOM, AppData for state.
5. **MappingConfiguration uses the meadow-integration format.** `{ Entity, GUIDTemplate, GUIDName, Mappings, Solvers }`. Template expressions like `{~D:Record.FieldName~}` are resolved by TabularTransform at mapping time, NOT by the Ultravisor settings resolver.

## Key upstream fixes (already applied to source repos, need patching in node_modules after npm install)

1. **retold-databeacon/DataBeacon-DynamicEndpointManager.js** — Object.create() scoped fable for multi-connection provider isolation
2. **retold-databeacon/DataBeacon-SchemaIntrospector.js** — Recognizes Meadow audit column names (CreateDate, GUIDx, etc.) and emits semantic types
3. **retold-databeacon/DataBeacon-BeaconProvider.js** — Phase 0: Columns in Introspect output
4. **ultravisor/Ultravisor-ExecutionEngine.cjs** — Skips template resolution for Object/Array typed SettingsInputs
5. **meadow-endpoints/Meadow-Operation-Create.js** — Null-guard for jsonSchema on dynamic endpoints

After `npm install`, run: `node test/patch-node-modules.js` (TODO: create this script)

## Test databases (retold-harness containers)

```
MySQL    :3306  root/1234567890         weather_stations + city_dashboard
PostgreSQL :5432  postgres/retold1234567890  demographics + transit_systems
```

Seed: `npm run seed`
Automated test: `npm run harness`

## Code style

Tabs, Allman braces, `pParam`/`tmpLocal`/`libSomething` naming. Plain JavaScript, no TypeScript. Follow existing patterns in this module and in retold-databeacon.
