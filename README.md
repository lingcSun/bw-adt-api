# BW-ADT-API

Interface to SAP BW/4HANA ADT (ABAP Developer Tools) webservice.

A TypeScript library that simplifies access to the BW/4HANA ADT REST interface for working with BW-specific objects. **All endpoints are implemented based on actual Eclipse ADT Communication Log tracing** and verified against real system interactions.

## Installation

```bash
npm install bw-adt-api
```

## Quick Start

Preferred entry: **domain facades** on `BWAdtClient` (`client.adso`, `client.trfn`, …). Flat methods remain available for compatibility.

```typescript
import { BWAdtClient, isTransportRequiredError } from "bw-adt-api"

const client = new BWAdtClient(
  "http://your-bw-server:8000",
  "developer",
  "mypassword",
  "100",      // SAP client
  "EN"        // language
)
await client.login()

// Search / lineage
const results = await client.repository.search({
  objectName: "0ASSET*",
  objectType: "RSDS"
})

// Read DataSource
const ds = await client.dataSource.details("0ASSET_ATTR_TEXT", "S4DCLNT300")
const fields = await client.dataSource.fields("0ASSET_ATTR_TEXT", "S4DCLNT300")

// Write: edit XML, then save+activate (caller chooses transport)
const xml = await client.adso.xml("ZL_FID37", true)
try {
  await client.adso.saveAndActivate("ZL_FID37", xml, {
    transport: "BPDK9xxxxx"           // existing TR, or:
    // createTransport: true,         // create a new one
    // transportDescription: "…"
  })
} catch (e) {
  if (isTransportRequiredError(e)) {
    // e.availableTransports — pick one and retry with { transport }
  }
  throw e
}

await client.logout()
```

## Domain Facades (recommended)

Aligned with BW Modeling Tools Project Explorer. Facades live under `src/domains/` and are attached to the client as `client.<domain>`. Domains come in three kinds — **modeling** (XML edit + activation, shares the `withWriteSession` write sequence), **ops** (lifecycle actions, no document editing), **structure** (containers / navigation / read-only checks):

| Kind | Domain | Facade | Role |
|------|--------|--------|------|
| modeling | infoProvider | `client.infoProvider` | Polymorphic: `.adso(name)` typed facade, `.exists`, `.details` (ADSO variant; more types as they get verified) |
| modeling | infoProvider·ADSO | `client.adso` | ADSO read / edit / addField / addKey / exists / delete |
| modeling | dataFlow | `client.trfn` / `client.dtp` | Transformation (+ ensure routines) / DTP, incl. `exists` / `delete` |
| modeling | dataSource | `client.dataSource` | RSDS + replication |
| modeling | infoObject | `client.infoObject` | InfoObject read / validate |
| ops | processChain | `client.processChain` | Execute / stop / logs |
| structure | infoArea | `client.infoArea` | Provider tree under an InfoArea / name validation |
| structure | repository | `client.repository` | Search, lineage, ADSO↔TRFN/DTP |
| structure | query | `client.query` | BICS / provider preview |
| structure | system | `client.system` | System info / capabilities |
| structure | ddic | `client.ddic` | Table describe / data / SQL |
| structure | transport | `client.transport` | CTS check / create |

**Not Public (out of scope):** Favorites, infoSource, openHub, sourceSystem, and any InfoProvider type not yet live-verified (HCPR / Open ODS / MultiProvider — see `docs/VERIFIED_APIS.md`).

### Public vs Advanced

| Tier | What | Typical use |
|------|------|-------------|
| **Public** | `details` / `xml` / `check` / `saveAndActivate` / domain helpers / execute & logs | Scripts, MCP, automation |
| **Advanced** | Atomic `lock` / `unlock` / bare `update` / `activate`, raw `get*` trees | Protocol debugging; library keeps them, MCP defaults them off |

Write orchestration (`saveAndActivate*`) lives in the **API layer** (`src/api/*`), not in the client facade.

---

## Public API by Domain

### `client.repository`

| Method | Description |
|--------|-------------|
| `search(options)` | BW object search (name/type/filters) |
| `transformationsOf(adsoName)` | TRFNs related to an ADSO |
| `dtpsOf(adsoName)` | DTPs related to an ADSO |
| `dataflow(name, type?, options?)` | Dataflow / lineage graph |
| `lineage(target, source, type?, options?)` | TRFN/DTP links source → target |

### `client.adso` (infoProvider)

| Method | Description |
|--------|-------------|
| `details(id)` | Parsed ADSO + configuration / tables / DDIC name when available |
| `xml(id)` | Raw XML for edit / PUT |
| `versions(id)` / `check(id)` | Version history / consistency |
| `saveAndActivate(id, xml, options?)` | lock → transport → PUT → activate → unlock |
| `addField(id, field, options?)` | Add local field then save+activate |
| `addKey(id, infoObject, options?)` | Register InfoObject as key (keyless → keyed ADSO), then save; key is a prerequisite for activating keyless ADSOs |
| `create(options)` | Full create (validate → create → optional activate) |
| `validateInfoArea` / `validateTemplate` / `validateNewName` | Pre-create checks |

### `client.trfn` / `client.dtp` (dataFlow)

| Facade | Method | Description |
|--------|--------|-------------|
| `trfn` | `details` / `xml` / `versions` / `check` | Read & check |
| `trfn` | `create(options)` via `client.createTransformation` | 8TRANSIENT create flow |
| `trfn` | `saveAndActivate(id, xml, options?)` | One-stop write |
| `trfn` | `setEndRoutineFields(id, fields, options?)` | Check fields into an **existing** END routine + save (ensure one first if missing) |
| `trfn` | `ensureEndRoutine(id, options?)` | Create END routine Eclipse-style: PUT rules → generate AMDP class → activate class → activate TRFN |
| `trfn` | `ensureStartRoutine(id, options?)` | Same flow for the START routine (source `fields`) |
| `trfn` | `switchRuntime(xml, useHana)` | Pure XML helper (HANA vs ABAP) |
| `dtp` | `details` / `xml` / `versions` / `check` | Read & check |
| `dtp` | `create(options)` via `client.createDTP` | Minimal-body POST create |
| `dtp` | `saveAndActivate(id, xml, options?)` | One-stop write |
| `dtp` | `execute(id)` | Run DTP |

```typescript
// Ensure an END routine (Eclipse-aligned flow, idempotent: created=false if already present)
const r = await client.trfn.ensureEndRoutine(trfnId, {
  fields: ["ZC_BSTKD"],        // target fields checked into the routine
  transport: "BPDK9xxxxx"      // or createTransport: true
})
// r.className, r.created, r.classActivated
// START routine: client.trfn.ensureStartRoutine(trfnId, { fields: ["0MATERIAL"] })
```

Flat client methods still expose the same helpers (`ensureEndRoutine` / `ensureStartRoutine`, `addTransformationRulesAndSave`, class source read/write, …) plus Advanced lock/update APIs. Pure XML transforms (`ensure*RoutineInXml`, `switchTransformationRuntime`, `addADSOKeyToXml`) are exported from the API layer for offline composition.

### `client.dataSource`

| Method | Description |
|--------|-------------|
| `details` / `fields` / `xml` / `versions` | Read |
| `saveAndActivate(ds, src, xml, options?)` | One-stop write |
| `mergeProposal(ds, src, xml)` | Merge ODP proposal after adapter change |
| `replicationInfo` / `replicate` / `replicateFull` | Replication |

### `client.processChain`

| Method | Description |
|--------|-------------|
| `details` / `check` | Read & check |
| `execute` / `stop` | Run / stop |
| `logs(id)` | Logs + status |

### `client.infoObject`

| Method | Description |
|--------|-------------|
| `get(name)` | Details (+ metadata when available) |
| `validateExists` / `validateNewName` | Validations |

### `client.query` (BICS / provider preview)

Multidimensional preview for **ADSO**, **characteristic**, and **Composite Provider** (`/sap/bw/modeling/comp/reporting`). Complements flat DDIC / ADSO table preview.

| Method | Description |
|--------|-------------|
| `initialView(compId, options?)` | Initial metadata + default result set |
| `updateView(compId, state, options?)` | Remap axes and refresh |
| `preview(name, { rows, columns?, … })` | Convenience → `flatRows` |

```typescript
const view = await client.query.preview("ZL_FID09", {
  rows: ["0PROFIT_CTR", "0COMP_CODE"],
  toRow: 1000
})
// view.flatRows: [{ "0PROFIT_CTR": "...", "0COMP_CODE": "1010", "1ROWCOUNT": 194, ... }, ...]
```

### `client.ddic`

| Method | Description |
|--------|-------------|
| `describe(table)` | Metadata + info + fields (+ data metadata) |
| `getData(table, options?)` | Table data preview |
| `querySql(table, sql, options?)` | Freestyle OpenSQL preview |
| `adsoDdicLinks` / `adsoDdicTableName` | ADSO ↔ DDIC helpers |

### `client.system` / `client.transport`

| Facade | Method | Description |
|--------|--------|-------------|
| `system` | `info` / `getProperty` / `hasCapability` | System capabilities |
| `transport` | `check(uri)` / `create(refUri, description)` | CTS |

### Session (on `BWAdtClient`)

`login()` · `logout()` · `dropSession()` · `reentranceTicket()`

### Flat / Advanced / generic APIs

`BWAdtClient` still exposes the previous flat methods (`getADSODetails`, `lockADSO`, `saveAndActivateADSO`, …) and generic `bwObject` / `createObject` helpers. Prefer facades for new code; write-path flat wrappers increasingly forward to the same API-layer orchestration.

---

## Key Design Notes

### Write session model (verified)

`saveAndActivate*` follows the Eclipse-traced dual-channel model:

- **lock / unlock** → `stateful` (server `sap-contextid` holds the lock)
- **PUT / activation / transport** → `stateless`, **no** `sap-contextid`
- ❌ Never send `stateful;enqueue` — destroys the session (`sap-contextid=0`). `AdtHTTP` handles this.

Unlock runs in `finally` so locks are released even when update/activate fails.

### Transport on save (caller chooses)

When recording is required and lock did not already supply `corrNr`:

| Option | Behavior |
|--------|----------|
| `transport: "…"` | Use an existing TR |
| `createTransport: true` | Create a new TR (`transportDescription` optional) |
| neither | Throws `TransportRequiredError` with `availableTransports` — **no** auto-pick of `TRANSPORTS[0]` |

Import `isTransportRequiredError` to branch on that case.

### Version identifiers

URI version suffixes: `m` = active, `a` = modified, `d` = revised. (RSDS keeps the version letter in `<atom:id>`, not the URI suffix.)

---

## Testing

Tests need a real SAP BW connection. Copy `.env.example` to `.env`:

```bash
BW_BASE_URL=http://your-bw-server:8000
BW_USERNAME=your-username
BW_PASSWORD=your-password
BW_CLIENT=100
BW_LANGUAGE=EN
```

```bash
npm test                                    # all tests
npm test -- --testPathPattern=datasource    # one suite
```

Suites live in `src/__tests__/` and are checked against real Communication Logs.

Some suites target specific objects and fall back to placeholder names when these are unset (they will fail against a real system until pinned via `.env`):

```bash
BW_TEST_ADSO=ZL_FID37          # ADSO read/write target
BW_TEST_DTP=DTP_…              # DTP read target
BW_TEST_TRFN=0MSIURA…          # TRFN read/routine target
BW_TEST_PROCESS_CHAIN=ZPC_…    # process chain read target
```

CI (`ci.yml`) runs build + `verify:agents` only — integration suites require a live system and do not auto-skip offline yet.

## Documentation

- [API_REFERENCE.md](./docs/API_REFERENCE.md) — 完整 API 参考（代码生成，读/写分类与验证状态）
- [VERIFIED_APIS.md](./docs/VERIFIED_APIS.md) — Verified behaviors & session models (required reading for writes)
- [ROADMAP.md](./docs/ROADMAP.md) — Development roadmap

## Architecture

```
Client (BWAdtClient)
  ├─ Domain facades   src/domains/*     ← preferred Public surface
  ├─ Flat methods     (compat / Advanced)
  └─ lazy import → API layer  src/api/*
                    └─ HTTP   AdtHTTP / AxiosHttpClient
```

1. **HTTP** — auth, CSRF, cookies, stateful/stateless sessions, auto-login retry  
2. **API** — per-domain modules, `io-ts` types, XML helpers, `saveAndActivate*` orchestration  
3. **Client / domains** — entry points; facades for Public tasks, flat methods for full surface  

## License

MIT
