# BW-ADT-API

Interface to SAP BW/4HANA ADT (ABAP Developer Tools) webservice.

This library simplifies access to the BW/4HANA ADT REST interface for working with BW-specific objects, based on actual Communication Log tracing.

## Installation

```bash
npm install bw-adt-api
```

## Features

- ✅ ADSO operations (get/lock/unlock/activate/check)
- ✅ InfoProvider structure navigation
- ✅ System information and capabilities
- ✅ BW object search
- ✅ Transformation operations (lock/unlock/activate)
- ✅ Data Transfer Process (DTP) operations (lock/unlock/activate/execute)
- ✅ Process Chain operations (lock/unlock/activate/check/execute/logs/status)
- ✅ DDIC table operations (metadata/fields/data queries)
- 🚧 More modules coming soon...

## Verified ADT Behavior (Important)

Based on latest Communication Log verification in this repository:

- `lock` / `unlock` should run with `stateful` session (`enqueue` context)
- read/create/update/delete requests remain `stateless` by default
- `InfoArea` update uses:
  - `PUT /sap/bw/modeling/area/{name}/a?lockHandle=...`
  - `Content-Type: application/xml, application/vnd.sap.bw.modeling.area-v1_1_0+xml`
- `ADSO` update uses:
  - `PUT /sap/bw/modeling/adso/{name}/m?lockHandle=...`
  - `Content-Type: application/xml, application/vnd.sap.bw.modeling.adso-v1_5_0+xml`
- `ADSO` delete supports lock-handle mode:
  - `DELETE /sap/bw/modeling/adso/{name}/m?lockHandle=...`

## Script Examples (project local)

These scripts are available under `src/scripts/`:

- `createArea.ts`: create InfoArea
- `areaCrud.ts`: InfoArea create/update/delete flow
- `adsoCrud.ts`: ADSO create/update/delete flow
- `createAdsoFromInfoprovider.ts`: create ADSO from template InfoProvider
- `convertAdsoToStandard.ts`: convert ADSO to standard type (set key fields) and activate

Run after build:

```bash
npm run build
node build/scripts/createAdsoFromInfoprovider.js
node build/scripts/convertAdsoToStandard.js
```

## Sample usage

```typescript
import { BWAdtClient } from "bw-adt-api"

// Create a client
const client = new BWAdtClient(
  "http://vhcalnplci.bti.local:8000",
  "developer",
  "mypassword"
)

// Login
await client.login()

// ADSO operations
const adsoDetails = await client.getADSODetails("ZL_FID01")
const adsoConfig = await client.getADSOConfiguration("ZL_FID01")
const adsoVersions = await client.getADSOVersions("ZL_FID01")
const adsoLock = await client.lockADSO("ZL_FID01")
await client.activateADSO("ZL_FID01", adsoLock.lockHandle)
await client.unlockADSO("ZL_FID01")

// Query InfoArea list
const areas = await client.infoProviderStructure()

// Query ADSOs in an InfoArea
const adsos = await client.infoAreaADSOs("ZBW_LDL_FI")

// Query Transformations for an ADSO
const transformations = await client.adsoTransformations("ZL_FID01")

// Search BW objects
const results = await client.quickSearch("ZL_FID01")

// Get system information
const sysInfo = await client.systemInfo()

// Lock and activate a transformation
const lock = await client.lockTransformation("0F30KPOAZK07TIY86JBGVAO9XHWIVIBT")
await client.activateObject("/sap/bw/modeling/trfn/0f30kpoazk07tiy86jbgvao9xhwivibt/m", lock.lockHandle)
await client.unlockTransformation("0F30KPOAZK07TIY86JBGVAO9XHWIVIBT")

// Work with Data Transfer Processes (DTP)
const dtpDetails = await client.getDTPDetails("DTP_XXX")
const dtpVersions = await client.getDTPVersions("DTP_XXX")
const dtpLock = await client.lockDTP("DTP_XXX")
await client.activateDTP("DTP_XXX", dtpLock.lockHandle)
const executeResult = await client.executeDTP("DTP_XXX")
await client.unlockDTP("DTP_XXX")

// Work with Process Chains
const chainDetails = await client.getProcessChainDetails("PC_DAILY_LOAD")
const chainVersions = await client.getProcessChainVersions("PC_DAILY_LOAD")
const chainLock = await client.lockProcessChain("PC_DAILY_LOAD")
await client.activateProcessChain("PC_DAILY_LOAD", chainLock.lockHandle)
const chainStatus = await client.getProcessChainStatus("PC_DAILY_LOAD")
const chainLogs = await client.getProcessChainLogs("PC_DAILY_LOAD")
await client.unlockProcessChain("PC_DAILY_LOAD")
```

## API Documentation

See [API_MAPPING.md](./API_MAPPING.md) for complete API endpoint mapping based on actual Communication Log traces.

## Communication Log Based Development

This library is developed by tracing actual SAP BW ADT communication logs. All endpoints and response formats are verified against real system interactions.

## License

MIT
