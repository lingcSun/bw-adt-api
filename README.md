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
- 🚧 More modules coming soon...

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
```

## API Documentation

See [API_MAPPING.md](./API_MAPPING.md) for complete API endpoint mapping based on actual Communication Log traces.

## Communication Log Based Development

This library is developed by tracing actual SAP BW ADT communication logs. All endpoints and response formats are verified against real system interactions.

## License

MIT
