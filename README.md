# BW-ADT-API

Interface to SAP BW/4HANA ADT (ABAP Developer Tools) webservice.

A TypeScript library that simplifies access to the BW/4HANA ADT REST interface for working with BW-specific objects. **All endpoints are implemented based on actual Eclipse ADT Communication Log tracing** and verified against real system interactions.

## Installation

```bash
npm install bw-adt-api
```

## Quick Start

```typescript
import { BWAdtClient } from "bw-adt-api"

// Create and login
const client = new BWAdtClient(
  "http://your-bw-server:8000",
  "developer",
  "mypassword",
  "100",      // SAP client
  "EN"        // language
)
await client.login()

// Search for objects
const results = await client.quickSearch("0ASSET*", "RSDS")

// Read DataSource details + fields
const ds = await client.getDataSourceDetails("0ASSET_ATTR_TEXT", "S4DCLNT300")
const fields = await client.getDataSourceFields("0ASSET_ATTR_TEXT", "S4DCLNT300")

await client.logout()
```

## Implemented API Reference

The `BWAdtClient` class exposes ~110 public methods, organized by domain module. All write operations follow the **lock → modify → activate → unlock** pattern with verified session management.

### Session & Lifecycle

| Method | Description |
|--------|-------------|
| `login()` | Log on to the ADT server |
| `logout()` | Log out and clear cookies |
| `dropSession()` | Drop the current ADT session |
| `reentranceTicket()` | Fetch a SAP reentrance ticket |

### System Information

| Method | Description |
|--------|-------------|
| `systemInfo()` | Query BW system info and capabilities |
| `getSystemProperty(name)` | Get a specific system property |
| `hasCapability(name)` | Check whether the system supports a capability |

### Search

| Method | Description |
|--------|-------------|
| `searchBWObjects(options)` | Advanced BW object search with filters (type, dates, name/desc) |
| `quickSearch(term, type?)` | Quick name search |
| `getADSOTransformations(adsoName)` | Get Transformations related to an ADSO |
| `getADSODataTransferProcesses(adsoName)` | Get DTPs related to an ADSO |

### Data Flow / Lineage

| Method | Description |
|--------|-------------|
| `getDataflow(name, type?, options?)` | Get the dataflow/lineage graph around an object |
| `getDataflowLineage(target, source, type?)` | Query transformations and DTPs linking source → target |

### Generic BW Object Operations

A unified base-class pattern that works across object types (ADSO, TRFN, DTPA, ProcessChain, InfoObject, InfoArea):

| Method | Description |
|--------|-------------|
| `bwObject(type, name)` | Get a generic `BWObject` instance (lock/unlock/activate/check/validate) |
| `createObject(type, name, xml, options?)` | Create any BW object |
| `updateObject(type, name, xml, options?)` | Update any BW object |
| `deleteObject(type, name, lockHandleOrTransport)` | Delete any BW object |
| `getObject(type, name)` | Get a `BWObject` instance for operations |
| `activateObject(uri, lockHandle, version?)` | Activate any object by URI |
| `validateObjectExists(type, name)` | Validate an object exists |
| `validateNewObjectName(type, name)` | Validate a new name is available |

### ADSO (Advanced DataStore Object)

| Method | Description |
|--------|-------------|
| `getADSO(id, forceCacheUpdate?)` | Get ADSO raw metadata |
| `getADSODetails(id, forceCacheUpdate?)` | Get parsed ADSO metadata |
| `getADSOVersions(id)` | Get version history |
| `getADSOXml(id, forceCacheUpdate?)` | Get raw XML for PUT |
| `getADSOConfiguration(id)` | Get configuration info |
| `getADSOTables(id)` | Get associated table names |
| `getADSONodePath(name, version?)` | Get the node path |
| `lockADSO(id)` / `unlockADSO(id)` | Lock / unlock |
| `activateADSO(id, lockHandle?, corrNr?)` | Activate |
| `checkADSO(id)` | Check consistency |
| `updateADSO(id, xml, lockHandle, options?)` | Update via PUT |
| `createADSO(options)` | Full create flow (validate → create → optional activate) |
| `saveAndActivateADSO(id, xml, options?)` | One-stop: lock → PUT → activate → unlock |
| `addADSOField(id, field, options?)` | Add a local field and save+activate |
| `validateInfoArea(name)` / `validateTemplateADSO(name)` / `validateNewADSOName(name)` | Pre-create validations |
| `validateADSOExists(id)` / `validateADSONewName(id)` | Existence/name validations |

### Transformation (TRFN)

> ⚠️ **TRFN creation is unsupported** (server-side JCo dependency — must be created via Eclipse ADT or SAP GUI). Read/update/activate/delete all work normally.

| Method | Description |
|--------|-------------|
| `getTransformation(id, version?, options?)` | Get raw metadata |
| `getTransformationDetails(id, version?, options?)` | Get parsed details |
| `getTransformationVersions(id)` | Get version history |
| `getTransformationXml(id, version?, options?)` | Get raw XML for PUT |
| `lockTransformation(id)` / `unlockTransformation(id)` | Lock / unlock |
| `activateTransformation(id, lockHandle?)` | Activate |
| `checkTransformation(id)` | Check consistency |
| `updateTransformation(id, xml, options, version?)` | Update via PUT |
| `saveAndActivateTransformation(id, xml, options?)` | One-stop save+activate |
| `setEndRoutineFields(id, fields, options?)` | Check fields into end routine and save+activate |
| `addTransformationRule(xml, src, tgt?)` | *(pure helper)* Insert a DIRECT mapping rule into XML |
| `autoMapTransformationFields(xml)` | *(pure helper)* Auto-map same-named fields |
| `addTransformationRulesAndSave(id, rules, options?)` | One-stop: add rules + save+activate |
| `autoMapTransformationFieldsAndSave(id, options?)` | One-stop: auto-map + save+activate |
| `switchTransformationRuntime(id, useHana, lockHandle, options?)` | Switch HANA/ABAP runtime |
| `validateTransformationExists(id)` / `validateTransformationNewName(id)` | Validations |

#### Transformation ABAP Class (Routines)

| Method | Description |
|--------|-------------|
| `getTransformationClass(id, options?)` | Get the routine's ABAP class metadata |
| `getTransformationClassSource(id, options?)` | Get routine source (start/end/expert) |
| `saveAndActivateTransformationClassSource(id, source, options?)` | Save+activate class source |
| `updateTransformationClassSource(id, source, lockHandle, options?)` | Update class source |
| `lockTransformationClass(id, options?)` / `unlockTransformationClass(id, lockHandle, options?)` | Lock / unlock the class |

### Data Transfer Process (DTP)

| Method | Description |
|--------|-------------|
| `getDTP(id, forceCacheUpdate?)` | Get raw metadata |
| `getDTPDetails(id, forceCacheUpdate?)` | Get parsed details |
| `getDTPVersions(id)` | Get version history |
| `lockDTP(id)` / `unlockDTP(id)` | Lock / unlock |
| `activateDTP(id, lockHandle?, corrNr?)` | Activate |
| `checkDTP(id)` | Check consistency |
| `executeDTP(id)` | Execute the DTP |
| `updateDTP(id, xml, lockHandle, transport?)` | Update via PUT |
| `saveAndActivateDTP(id, xml, options?)` | One-stop save+activate |
| `validateDTPExists(id)` / `validateDTPNewName(id)` | Validations |

### DataSource (RSDS)

| Method | Description |
|--------|-------------|
| `getDataSource(ds, src, forceCacheUpdate?)` | Get raw metadata |
| `getDataSourceXml(ds, src, forceCacheUpdate?)` | Get raw XML for PUT |
| `getDataSourceDetails(ds, src, forceCacheUpdate?)` | Get parsed details |
| `getDataSourceFields(ds, src, forceCacheUpdate?)` | Parse field list |
| `getDataSourceVersions(ds, src)` | Get version history |
| `lockDataSource(ds, src)` / `unlockDataSource(ds, src)` | Lock / unlock (stateful) |
| `updateDataSource(ds, src, xml, options)` | Save modified XML via PUT |
| `activateDataSource(ds, src, lockHandle?, corrNr?)` | Activate |
| `mergeDataSourceProposal(ds, src, xml)` | Merge ODP proposal (field sync after adapter change) |
| `saveAndActivateDataSource(ds, src, xml, options?)` | One-stop save+activate |

### DataSource Replication

| Method | Description |
|--------|-------------|
| `getReplicationInfo(src, ds)` | Replication pre-check |
| `replicateDataSource(src, ds, tasks, options?)` | Trigger replication with pre-check tasks |
| `replicateDataSourceFull(src, ds, options?)` | One-stop: pre-check → trigger |

### Process Chain

| Method | Description |
|--------|-------------|
| `getProcessChain(id)` / `getProcessChainDetails(id)` | Get metadata / parsed details |
| `getProcessChainVersions(id)` | Get version history |
| `lockProcessChain(id)` / `unlockProcessChain(id)` | Lock / unlock |
| `activateProcessChain(id, lockHandle?, corrNr?)` | Activate |
| `checkProcessChain(id)` | Check consistency |
| `executeProcessChain(id)` / `stopProcessChain(id)` | Execute / stop |
| `getProcessChainLogs(id)` | Get execution logs |
| `getProcessChainStatus(id)` | Get run status |
| `validateProcessChainExists(id)` / `validateProcessChainNewName(id)` | Validations |

### InfoObject

| Method | Description |
|--------|-------------|
| `getInfoObject(name, options?)` | Get InfoObject details |
| `getInfoObjectMetadata(name)` | Get InfoObject metadata |
| `validateInfoObjectExists(name)` / `validateInfoObjectNewName(name)` | Validations |

### DDIC Table Operations

| Method | Description |
|--------|-------------|
| `getDDICTableMetadata(table)` | Get table metadata (blueSource format) |
| `getDDICTableInfo(table)` | Get table info |
| `getDDICTableFields(table)` | Get field list |
| `getDDICTableDataMetadata(table)` | Get data-preview metadata |
| `getDDICTableData(table, options?)` | Query table data (maxRows/columns/where/orderBy) |
| `getTableDataViaSQL(table, sql)` | Query via SQL view |
| `getADSODDICLinks(id)` / `getADSODDICTableName(id)` | DDIC links / table name for an ADSO |
| `getADSODataPreview(name, maxRows?)` | ADSO data preview |

### Transport / CTS

| Method | Description |
|--------|-------------|
| `transportCheck(uri, devclass?, operation?)` | Check if saving requires a transport request |
| `createTransport(refUri, description, devclass?)` | Create a new transport request |

## Key Design Notes

### Write Operation Session Model (verified 2026-07-15)

Write operations follow the session model traced from real Eclipse ADT communication:

- **lock / unlock** → `stateful` session (`enqueue` context). The server returns a `sap-contextid` establishing the lock-holding session.
- **PUT update / activation** → `stateless`, no `sap-contextid` carried. The server validates the `lockHandle` in the URL via the enqueue lock table.
- ❌ **Never send `stateful;enqueue` header** — it causes the server to destroy the session (`sap-contextid=0`) and the lock is lost immediately. `AdtHTTP` handles this automatically.

### Version Identifiers

BW object versions use single-letter suffixes in URIs: `m` = active, `a` = modified, `d` = revised. (RSDS is a special case — its version character lives in `<atom:id>`, not the URI suffix.)

## Testing

Tests require a real SAP BW system connection. Copy `.env.example` to `.env` and configure:

```bash
BW_BASE_URL=http://your-bw-server:8000
BW_USERNAME=your-username
BW_PASSWORD=your-password
BW_CLIENT=100
BW_LANGUAGE=EN
```

```bash
npm test                                    # run all tests
npm test -- --testPathPattern=datasource    # run a specific suite
```

Test suites live in `src/__tests__/` and are verified against real Communication Logs.

## Documentation

Detailed design documents are in `docs/`:

- [API_MAPPING.md](./docs/API_MAPPING.md) — Complete ADT endpoint mapping
- [VERIFIED_APIS.md](./docs/VERIFIED_APIS.md) — Verified behaviors and session models
- [ROADMAP.md](./docs/ROADMAP.md) — Development roadmap

## Architecture

Three-layer design:

1. **HTTP layer** (`AdtHTTP.ts`, `AxiosHttpClient.ts`) — authentication, CSRF tokens, cookies, stateful/stateless session management, auto-login retry.
2. **API layer** (`src/api/*.ts`) — per-domain modules with `io-ts` runtime types and XML parsing helpers.
3. **Client layer** (`BWAdtClient.ts`) — main entry class using lazy `import()` to load domain modules on demand.

## License

MIT
