# BW-ADT-API - 基于 Communication Log 的完整 API 封装

## 项目概述

根据 SAP BW/4HANA Communication Log 实际追踪结果，封装 BW ADT REST API。

## 已实现的 API 模块

### 0. 通用 BW 对象操作 (`bwObject.ts`, `common.ts`, `types.ts`) ✅ 新增

#### 泛型基类 BWObject<T>

提供所有 BW 对象类型的统一操作接口：

| 方法 | 描述 |
|------|------|
| `lock()` | 锁定对象 |
| `unlock()` | 解锁对象 |
| `activate(lockHandle?)` | 激活对象 |
| `check()` | 检查对象一致性 |
| `getVersions()` | 获取版本历史 |
| `validate(action)` | 验证对象 |
| `exists()` | 检查对象是否存在 |
| `isNewNameAvailable()` | 检查新名称是否可用 |
| `canDelete()` | 检查对象是否可删除 |
| `canActivate()` | 检查对象是否可激活 |

#### 支持的对象类型 (BWObjectType)

| 类型 | 枚举值 | 端点前缀 | Content-Type |
|------|--------|----------|--------------|
| ADSO | `BWObjectType.ADSO` | `/sap/bw/modeling/adso` | `v1_5_0+xml` |
| Transformation | `BWObjectType.TRANSFORMATION` | `/sap/bw/modeling/trfn` | `v1_0_0+xml` |
| DTP | `BWObjectType.DTP` | `/sap/bw/modeling/dtpa` | `v1_0_0+xml` |
| Process Chain | `BWObjectType.PROCESS_CHAIN` | `/sap/bw/modeling/pc` | `v1_0_0+xml` |
| InfoObject | `BWObjectType.INFO_OBJECT` | `/sap/bw/modeling/iobj` | `v2_1_0+xml` |
| DataSource | `BWObjectType.DATA_SOURCE` | `/sap/bw/modeling/datasource` | `datasource+xml` |
| InfoSource | `BWObjectType.INFO_SOURCE` | `/sap/bw/modeling/infosource` | `infosource+xml` |
| InfoArea | `BWObjectType.INFO_AREA` | `/sap/bw/modeling/area` | `infoarea+xml` |

#### 通用验证端点

| 功能 | HTTP 方法 | 端点 | 描述 |
|------|-----------|------|------|
| 验证对象 | POST | `/sap/bw/modeling/validation?objectType={type}&objectName={name}&action={action}` | 通用验证接口 |

**验证动作 (ValidationAction):**
- `EXISTS` - 验证对象是否存在
- `NEW` - 验证新名称是否可用
- `DELETE` - 验证对象是否可删除
- `ACTIVATE` - 验证对象是否可激活

#### 使用示例

```typescript
import { BWObject, BWObjectType } from "bw-adt-api"

// 方式 1: 直接使用泛型基类
const adso = new BWObject(client, BWObjectType.ADSO, "ZSD001")

// 通用操作
await adso.lock()
const lockHandle = (await adso.lock()).lockHandle
await adso.check()
await adso.activate(lockHandle)
await adso.unlock()

// Validation
const exists = await adso.exists()
const isNew = await adso.isNewNameAvailable()
const canDelete = await adso.canDelete()
const canActivate = await adso.canActivate()

// Versions
const versions = await adso.getVersions()
```

#### 统一类型定义 (types.ts)

| 类型 | 描述 |
|------|------|
| `LockResult` | 锁定结果 (lockHandle, corrNr, corrUser, corrText) |
| `ActivationResult` | 激活结果 (success, messages) |
| `ObjectVersion` | 对象版本 (version, uri, created, user, description) |
| `ValidationResult` | 验证结果 (valid, message) |
| `ADSODetails` | ADSO 详细信息 |
| `TransformationDetails` | Transformation 详细信息 |
| `DTPDetails` | DTP 详细信息 |
| `ProcessChainDetails` | Process Chain 详细信息 |
| `InfoObjectDetails` | InfoObject 详细信息 |

### 1. InfoObject 操作 (`infoobject.ts`) ✅ 新增

| 功能 | HTTP 方法 | 端点 | 描述 |
|------|-----------|------|------|
| 获取 InfoObject | GET | `/sap/bw/modeling/iobj/{name}/a` | 获取 InfoObject 详细信息 (v2_1_0) |
| 获取 InfoObject 元数据 | GET | `/sap/bw/modeling/iobj/{name}/m` | 获取 InfoObject 元数据 |
| **验证 InfoObject 存在** | **POST** | **`/sap/bw/modeling/validation`** | **验证 InfoObject 是否存在** |
| **验证新 InfoObject 名称** | **POST** | **`/sap/bw/modeling/validation`** | **验证新名称是否可用** |
| **验证 InfoObject 可删除** | **POST** | **`/sap/bw/modeling/validation`** | **验证是否可删除** |
| **验证 InfoObject 可激活** | **POST** | **`/sap/bw/modeling/validation`** | **验证是否可激活** |

### 2. InfoProvider 结构查询 (`infoprovider.ts`)

| 功能 | HTTP 方法 | 端点 | 描述 |
|------|-----------|------|------|
| InfoArea 列表 | GET | `/sap/bw/modeling/repo/infoproviderstructure` | 查询根层 InfoArea 列表 |
| InfoArea 子节点 | GET | `/sap/bw/modeling/repo/infoproviderstructure/area/{area}/adso` | 查询 InfoArea 下的 ADSO |
| ADSO 子节点 | GET | `/sap/bw/modeling/repo/infoproviderstructure/adso/{adso}/trfn` | 查询 ADSO 的 Transformations |
| ADSO 子节点 | GET | `/sap/bw/modeling/repo/infoproviderstructure/adso/{adso}/dtpa` | 查询 ADSO 的 DTPs |

### 2. 系统信息查询 (`systemInfo.ts`)

| 功能 | HTTP 方法 | 端点 | 描述 |
|------|-----------|------|------|
| 系统信息 | GET | `/sap/bw/modeling/repo/is/systeminfo` | 获取 BW 系统能力和配置 |
| 系统属性 | GET | (同上) | 获取特定系统属性值 |
| 功能检查 | GET | (同上) | 检查系统是否支持某功能 |

### 3. BW 对象搜索 (`search.ts`)

| 功能 | HTTP 方法 | 端点 | 描述 |
|------|-----------|------|------|
| 对象搜索 | GET | `/sap/bw/modeling/repo/is/bwsearch` | 按名称/描述搜索 BW 对象 |
| 快速搜索 | GET | (同上) | 简化版搜索 |
| 类型搜索 | GET | (同上) | 按对象类型过滤 |

### 4. ADSO 操作 (`adso.ts`)

| 功能 | HTTP 方法 | 端点 | 描述 |
|------|-----------|------|------|
| 获取 ADSO | GET | `/sap/bw/modeling/adso/{id}` | 获取 ADSO 详细信息 (v1_5_0) |
| 获取 ADSO 版本 | GET | `/sap/bw/modeling/adso/{id}/versions` | 获取 ADSO 版本历史 |
| 获取 ADSO 配置 | GET | `/sap/bw/modeling/adso/{id}/configuration` | 获取 ADSO 配置信息 |
| 获取 ADSO 表名 | GET | `/sap/bw/modeling/adso/{id}/sql` | 获取关联的表名 |
| 锁定 ADSO | POST | `/sap/bw/modeling/adso/{id}?action=lock` | 锁定 ADSO 以便编辑 |
| 解锁 ADSO | POST | `/sap/bw/modeling/adso/{id}?action=unlock` | 解锁 ADSO |
| **更新 ADSO** | **PUT** | **`/sap/bw/modeling/adso/{id}/m`** | **更新 ADSO 元数据 (完整 XML)** |
| 激活 ADSO | POST | `/sap/bw/modeling/activation` | 激活 ADSO |
| 检查 ADSO | POST | `/sap/bw/modeling/activation` | 检查 ADSO 一致性 |
| **验证 InfoArea** | **POST** | **`/sap/bw/modeling/validation?objectType=AREA&objectName={name}&action=exists`** | **验证 InfoArea 是否存在** |
| **验证模板 ADSO** | **POST** | **`/sap/bw/modeling/validation?objectType=ADSO&objectName={name}&action=exists`** | **验证模板 ADSO 是否存在** |
| **验证新名称** | **POST** | **`/sap/bw/modeling/validation?objectType=ADSO&objectName={name}&action=new`** | **验证新 ADSO 名称是否可用** |
| **验证 ADSO 存在** | **POST** | **`/sap/bw/modeling/validation`** | **验证 ADSO 是否存在** |
| **验证 ADSO 可删除** | **POST** | **`/sap/bw/modeling/validation`** | **验证 ADSO 是否可删除** |
| **验证 ADSO 可激活** | **POST** | **`/sap/bw/modeling/validation`** | **验证 ADSO 是否可激活** |
| **创建 ADSO** | **POST** | **`/sap/bw/modeling/adso/{name}?lockHandle={id}`** | **创建 ADSO (支持 5 种模板类型)** |
| **获取节点路径** | **GET** | **`/sap/bw/modeling/repo/nodepath?objectUri={uri}`** | **获取 ADSO 在系统中的层级路径** |

### 5. Transformation 操作 (`transformation.ts`)

| 功能 | HTTP 方法 | 端点 | 描述 |
|------|-----------|------|------|
| 锁定转换 | POST | `/sap/bw/modeling/trfn/{id}?action=lock` | 锁定 Transformation 以便编辑 |
| 解锁转换 | POST | `/sap/bw/modeling/trfn/{id}?action=unlock` | 解锁 Transformation |
| 获取转换 | GET | `/sap/bw/modeling/trfn/{id}/{version}` | 获取转换元数据 |
| 获取版本历史 | GET | `/sap/bw/modeling/trfn/{id}/versions` | 获取版本历史 |
| **更新转换** | **PUT** | **`/sap/bw/modeling/trfn/{id}/{version}`** | **更新转换元数据 (完整 XML)** |
| 检查转换 | POST | `/sap/bw/modeling/activation` | 检查转换一致性 |
| 激活转换 | POST | `/sap/bw/modeling/activation` | 激活转换 |
| **验证 Transformation 存在** | **POST** | **`/sap/bw/modeling/validation`** | **验证 Transformation 是否存在** |
| **验证新 Transformation 名称** | **POST** | **`/sap/bw/modeling/validation`** | **验证新名称是否可用** |
| **验证 Transformation 可删除** | **POST** | **`/sap/bw/modeling/validation`** | **验证是否可删除** |
| **验证 Transformation 可激活** | **POST** | **`/sap/bw/modeling/validation`** | **验证是否可激活** |

### 6. DTP (Data Transfer Process) 操作 (`dtp.ts`)

| 功能 | HTTP 方法 | 端点 | 描述 |
|------|-----------|------|------|
| 获取 DTP | GET | `/sap/bw/modeling/dtpa/{id}/m` | 获取 DTP 详细信息 |
| 获取 DTP 版本 | GET | `/sap/bw/modeling/dtpa/{id}/versions` | 获取 DTP 版本历史 |
| 锁定 DTP | POST | `/sap/bw/modeling/dtpa/{id}?action=lock` | 锁定 DTP 以便编辑 |
| 解锁 DTP | POST | `/sap/bw/modeling/dtpa/{id}?action=unlock` | 解锁 DTP |
| 激活 DTP | POST | `/sap/bw/modeling/activation` | 激活 DTP |
| 检查 DTP | POST | `/sap/bw/modeling/activation` | 检查 DTP 一致性 |
| 执行 DTP | POST | `/sap/bw/modeling/dtpa/{id}?action=execute` | 执行数据加载 |
| **验证 DTP 存在** | **POST** | **`/sap/bw/modeling/validation`** | **验证 DTP 是否存在** |
| **验证新 DTP 名称** | **POST** | **`/sap/bw/modeling/validation`** | **验证新名称是否可用** |
| **验证 DTP 可删除** | **POST** | **`/sap/bw/modeling/validation`** | **验证是否可删除** |
| **验证 DTP 可激活** | **POST** | **`/sap/bw/modeling/validation`** | **验证是否可激活** |

## 使用示例

```typescript
import { BWAdtClient } from "bw-adt-api"

const client = new BWAdtClient(
  "http://bw-system:8000",
  "username",
  "password"
)

await client.login()

// ========== 使用泛型基类 BWObject ==========
// 方式 1: 直接使用泛型基类（推荐用于需要处理多种对象类型的场景）
import { BWObject, BWObjectType } from "bw-adt-api"

// 创建 ADSO 对象实例
const adso = new BWObject(client, BWObjectType.ADSO, "ZSD001")

// 通用操作
await adso.lock()
await adso.check()
await adso.activate(lockHandle)
await adso.unlock()

// Validation
const exists = await adso.exists()
const isNew = await adso.isNewNameAvailable()
const canDelete = await adso.canDelete()
const canActivate = await adso.canActivate()

// Versions
const versions = await adso.getVersions()

// 创建 Transformation 对象实例
const trfn = new BWObject(client, BWObjectType.TRANSFORMATION, "0TRFN_ID")
await trfn.lock()
await trfn.check()
await trfn.activate(lockHandle)
await trfn.unlock()

// 创建 DTP 对象实例
const dtp = new BWObject(client, BWObjectType.DTP, "DTP_001")
await dtp.lock()
await dtp.check()
await dtp.activate(lockHandle)
await dtp.unlock()

// 创建 Process Chain 对象实例
const pc = new BWObject(client, BWObjectType.PROCESS_CHAIN, "PC_DAILY")
await pc.lock()
await pc.check()
await pc.activate(lockHandle)
await pc.unlock()

// 方式 2: 使用 BWAdtClient 的 bwObject() 方法
const adso2 = await client.bwObject("ADSO", "ZSD001")
await adso2.lock()
await adso2.unlock()

// 方式 3: 使用便捷函数（保持向后兼容）
const adsoLock = await client.lockADSO("ZSD001")
const adsoResult = await client.activateADSO("ZSD001", adsoLock.lockHandle)
await client.unlockADSO("ZSD001")

// ========== Validation 方法使用示例 ==========
// 统一的验证接口 - 所有对象类型都支持相同的验证方法

// ADSO Validation
const adsoExists = await client.validateADSOExists("ZSD001")
const adsoNewName = await client.validateADSONewName("ZNEW_NAME")
const adsoCanDelete = await client.validateADSOCanDelete("ZSD001")
const adsoCanActivate = await client.validateADSOCanActivate("ZSD001")

// Transformation Validation
const trfnExists = await client.validateTransformationExists("0TRFN_ID")
const trfnNewName = await client.validateTransformationNewName("0NEW_TRFN")
const trfnCanDelete = await client.validateTransformationCanDelete("0TRFN_ID")
const trfnCanActivate = await client.validateTransformationCanActivate("0TRFN_ID")

// DTP Validation
const dtpExists = await client.validateDTPExists("DTP_001")
const dtpNewName = await client.validateDTPNewName("DTP_NEW")
const dtpCanDelete = await client.validateDTPCanDelete("DTP_001")
const dtpCanActivate = await client.validateDTPCanActivate("DTP_001")

// Process Chain Validation
const pcExists = await client.validateProcessChainExists("PC_DAILY")
const pcNewName = await client.validateProcessChainNewName("PC_NEW")
const pcCanDelete = await client.validateProcessChainCanDelete("PC_DAILY")
const pcCanActivate = await client.validateProcessChainCanActivate("PC_DAILY")

// InfoObject Validation
const iobjExists = await client.validateInfoObjectExists("0CUSTOMER")
const iobjNewName = await client.validateInfoObjectNewName("0NEW_OBJ")
const iobjCanDelete = await client.validateInfoObjectCanDelete("0CUSTOMER")
const iobjCanActivate = await client.validateInfoObjectCanActivate("0CUSTOMER")

// ========== 通用验证方法（适用于所有对象类型）==========
const genericExists = await client.validateObjectExists("ADSO", "ZSD001")
const genericNewName = await client.validateNewObjectName("TRFN", "0NEW_TRFN")

// ========== InfoObject 操作 ==========
// 获取 InfoObject 详细信息
const iobjDetails = await client.getInfoObject("0CUSTOMER")
console.log(`InfoObject: ${iobjDetails.name}`)
console.log(`Type: ${iobjDetails.infoObjectType}`)
console.log(`Data Type: ${iobjDetails.dataType}`)
if (iobjDetails.texts) {
  iobjDetails.texts.forEach(text => {
    console.log(`  [${text.language}] ${text.shortText}`)
  })
}

// 获取 InfoObject 元数据
const iobjMetadata = await client.getInfoObjectMetadata("0CUSTOMER")

// 查询 InfoArea 列表
const areas = await client.infoProviderStructure()

// 查询特定 InfoArea 下的 ADSO
const adsos = await client.infoAreaADSOs("ZBW_LDL_FI")

// 查询 ADSO 的 Transformations
const transformations = await client.adsoTransformations("ZL_FID01")

// 搜索 BW 对象
const results = await client.searchBWObjects({
  searchTerm: "ZL_FID01",
  searchInName: true
})

// 获取系统信息
const sysInfo = await client.systemInfo()

// 检查系统是否支持某功能
const hasPlanning = await client.hasCapability("bw.planning_supported")

// ADSO 操作
const adsoDetails = await client.getADSODetails("ZL_FID01")
const adsoConfig = await client.getADSOConfiguration("ZL_FID01")
const adsoVersions = await client.getADSOVersions("ZL_FID01")
const adsoTables = await client.getADSOTables("ZL_FID01")
console.log(`Active Table: ${adsoTables.activeTable}`)
console.log(`Inbound Table: ${adsoTables.inboundTable}`)

// ========== 创建 ADSO ==========
// 支持 5 种创建方式：
// 1. 以 DataSource 为模板 (type: "DSO")
// 2. 以 InfoProvider 为模板 (type: "ADSO")
// 3. 以 InfoObject 为模板 (type: "IOBJ")
// 4. 以 InfoSource 为模板 (type: "ISRC")
// 5. 空白创建 (不提供 template)

// 以 InfoProvider 为模板创建 ADSO
const createResult = await client.createADSO({
  name: "ZSD001",
  description: "测试 ADSO",
  infoArea: "ZGLD_TEST",
  masterLanguage: "ZH",
  responsible: "10031990",
  template: {
    objectName: "ZL_ORDER",  // 模板 ADSO 名称
    type: "ADSO"             // 模板类型
  },
  activateData: true,
  writeChangelog: true,
  readOnly: false,
  autoActivate: false  // 创建后是否自动激活
})
console.log(`ADSO created, lock handle: ${createResult.lockHandle}`)

// 空白创建 ADSO (无模板)
const createResult2 = await client.createADSO({
  name: "ZSD002",
  description: "空白 ADSO",
  infoArea: "ZGLD_TEST",
  masterLanguage: "ZH",
  // 不提供 template，创建空白 ADSO
  autoActivate: false
})

// 锁定并更新 ADSO
const adsoLock = await client.lockADSO("ZL_FID01")
console.log(`Lock Handle: ${adsoLock.lockHandle}`)

// 获取当前 XML（可选）
const currentAdso = await client.getADSO("ZL_FID01", "m")

// 修改后更新（需要完整的 ADSO XML 定义）
const updateResult = await client.updateADSO(
  "ZL_FID01",
  modifiedAdsoXmlContent,  // 完整的 XML 内容
  { lockHandle: adsoLock.lockHandle }
)
console.log(`Update Success: ${updateResult.success}`)

// 激活 ADSO
const adsoActivateResult = await client.activateADSO("ZL_FID01", adsoLock.lockHandle)
await client.unlockADSO("ZL_FID01")

// ========== 验证相关操作 ==========
// 验证 InfoArea 存在
const areaValid = await client.validateInfoArea("ZGLD_TEST")
console.log(`InfoArea exists: ${areaValid.valid}`)

// 验证模板 ADSO 存在
const templateValid = await client.validateTemplateADSO("ZL_ORDER")
console.log(`Template ADSO exists: ${templateValid.valid}`)

// 验证新 ADSO 名称可用
const nameValid = await client.validateNewADSOName("ZSD_NEW")
console.log(`Name available: ${nameValid.valid}`)

// ========== 节点路径查询 ==========
// 获取 ADSO 在系统中的层级路径
const nodePath = await client.getADSONodePath("ZSD001", "m")
nodePath.forEach(node => {
  console.log(`  - ${node.type}: ${node.name} (${node.techName})`)
})

// 锁定并更新 Transformation
const trfnLock = await client.lockTransformation("0GFA4DZN1C853MBWOUHEKC014661O472")
console.log(`Lock Handle: ${trfnLock.lockHandle}`)

// 获取当前 Transformation XML
const currentTrfn = await client.getTransformation("0GFA4DZN1C853MBWOUHEKC014661O472", "m")

// 修改后更新（需要完整的 transformation XML 定义）
const trfnUpdateResult = await client.updateTransformation(
  "0GFA4DZN1C853MBWOUHEKC014661O472",
  modifiedTrfnXmlContent,  // 完整的 XML 内容
  { lockHandle: trfnLock.lockHandle }
)
console.log(`Update Success: ${trfnUpdateResult.success}`)

// 激活 Transformation
const trfnActivateResult = await client.activateTransformation("0GFA4DZN1C853MBWOUHEKC014661O472")
await client.unlockTransformation("0GFA4DZN1C853MBWOUHEKC014661O472")

// DTP 操作
const dtpDetails = await client.getDTPDetails("DTP_XXX")
const dtpVersions = await client.getDTPVersions("DTP_XXX")
const dtpLock = await client.lockDTP("DTP_XXX")
const dtpActivateResult = await client.activateDTP("DTP_XXX", dtpLock.lockHandle)
const executeResult = await client.executeDTP("DTP_XXX")
await client.unlockDTP("DTP_XXX")
```

## Communication Log 映射

基于 `communation logs/` 目录中的实际日志文件：

| 日志文件 | API 功能 | 端点 |
|----------|----------|------|
| `sapbwmodelingrepoissysteminfo.txt` | 系统信息 | `/sap/bw/modeling/repo/is/systeminfo` |
| `sapbwmodelingrepoisbwsearch*.txt` | 对象搜索 | `/sap/bw/modeling/repo/is/bwsearch` |
| `sapbwmodelingrepoinfoproviderstructure.txt` | InfoArea 列表 | `/sap/bw/modeling/repo/infoproviderstructure` |
| `sapbwmodelingrepoinfoproviderstructurearea*_fiadso.txt` | ADSO 列表 | `/sap/bw/modeling/repo/infoproviderstructure/area/*/adso` |
| `sapbwmodelingrepoinfoproviderstructureadso*dtpa.txt` | DTP 列表 | `/sap/bw/modeling/repo/infoproviderstructure/adso/*/dtpa` |
| `sapbwmodelingtrfn*action=lock.txt` | 锁定转换 | `/sap/bw/modeling/trfn/*?action=lock` |
| `sapbwmodelingtrfn*action=unlock.txt` | 解锁转换 | `/sap/bw/modeling/trfn/*?action=unlock` |
| `sapbwmodelingtrfn*m?lockHandle=*` | 更新转换 | `PUT /sap/bw/modeling/trfn/*/{version}` |
| `sapbwmodelingactivation.txt` | 激活对象 | `/sap/bw/modeling/activation` |
| `sapbwmodelingadso*` | ADSO 操作 | `/sap/bw/modeling/adso/*` |
| `sapbwmodelingadso*?action=lock` | 锁定 ADSO | `/sap/bw/modeling/adso/*?action=lock` |
| `sapbwmodelingadso*?action=unlock` | 解锁 ADSO | `/sap/bw/modeling/adso/*?action=unlock` |
| `sapbwmodelingadso*m?lockHandle=*` | 创建/更新 ADSO | `POST /sap/bw/modeling/adso/*` |
| `sapbwmodelingiobj*` | InfoObject 操作 | `/sap/bw/modeling/iobj/*` |
| `sapbwmodelingdtpadtp*.txt` | DTP 操作 | `/sap/bw/modeling/dtpa/*` |

### ADSO 创建流程相关日志 (`communation logs/adso/`)

| 日志文件 | API 功能 | 端点 |
|----------|----------|------|
| `sapbwmodelingvalidationobjectType=AREA&objectName=ZGLD_TEST&action=exists.txt` | 验证 InfoArea | `/sap/bw/modeling/validation` |
| `sapbwmodelingvalidationobjectType=ADSO&objectName=ZL_ORDER&action=exists.txt` | 验证模板 ADSO | `/sap/bw/modeling/validation` |
| `sapbwmodelingvalidationobjectType=ADSO&objectName=ZSD001&action=new.txt` | 验证新名称 | `/sap/bw/modeling/validation` |
| `sapbwmodelingadsozsd001action=lock.txt` | 锁定 ADSO | `/sap/bw/modeling/adso/{name}?action=lock` |
| `sapbwmodelingadsozsd001lockHandle=*.txt` | 创建 ADSO | `/sap/bw/modeling/adso/{name}?lockHandle=*` |
| `sapbwmodelingadsozsd001action=unlock.txt` | 解锁 ADSO | `/sap/bw/modeling/adso/{name}?action=unlock` |
| `sapbwmodelingreponodepathobjectUri=*.txt` | 获取节点路径 | `/sap/bw/modeling/repo/nodepath` |
| `sapbwmodelingrepoinfoproviderstructureareazgld_testadso*.txt` | 查询 InfoProvider 结构 | `/sap/bw/modeling/repo/infoproviderstructure/area/{area}/adso` |
| `sapbwmodelingactivation.txt` | 激活 ADSO | `/sap/bw/modeling/activation` |

## API 端点模式总结

### InfoProvider 结构
```
/sap/bw/modeling/repo/infoproviderstructure
├── /area/{area}                    # InfoArea 下的子节点
│   └── /adso                       # ADSO 列表
└── /adso/{adso}                    # ADSO 下的子节点
    ├── /trfn                       # Transformations
    └── /dtpa                       # DTPs
```

### 对象操作
```
/sap/bw/modeling/{objectType}/{objectId}
├── ?action=lock                    # 锁定对象
├── ?action=unlock                  # 解锁对象
├── /{version}                      # 获取特定版本 (m=active, a=modified, d=revised)
├── /versions                       # 获取版本历史
├── /versions/{versionid}           # 获取特定历史版本
└── /configuration                  # 获取配置信息 (ADSO)

# 支持的对象类型:
# - adso: ADSO (Advanced DataStore Object) - v1_5_0
# - trfn: Transformation - v1_0_0
# - dtpa: Data Transfer Process - v1_0_0
```
├── ?action=lock                    # 锁定对象
├── ?action=unlock                  # 解锁对象
└── /{version}                      # 获取特定版本 (m=active, a=modified, d=revised)
```

### 系统服务
```
/sap/bw/modeling/repo/is/
├── systeminfo                       # 系统能力和配置
└── bwsearch                         # 对象搜索
```

## 响应格式

所有查询接口统一返回 **ATOM Feed** 格式：

```xml
<atom:feed xmlns:atom="http://www.w3.org/2005/Atom">
  <atom:entry>
    <atom:content>
      <bwModel:object objectName="..." objectType="..." />
    </atom:content>
    <atom:id>...</atom:id>
    <atom:link href="..." rel="self" />
    <atom:title>...</atom:title>
  </atom:entry>
</atom:feed>
```

## 下一步计划

根据新增的 Communication Log，可以继续实现：
- Process Chain 操作 ✅ (已实现)
- InfoObject 操作 ✅ (已实现 - 读取功能)
- InfoObject 创建/更新/删除 (需要更多 logs)
- Query 管理
- DataSource 操作

---

### 7. Process Chain (流程链) 操作 (`processchain.ts`) ✅

| 功能 | HTTP 方法 | 端点 | 描述 |
|------|-----------|------|------|
| 获取流程链 | GET | `/sap/bw/modeling/pc/{id}/m` | 获取流程链详细信息 |
| 获取版本历史 | GET | `/sap/bw/modeling/pc/{id}/versions` | 获取流程链版本历史 |
| 锁定流程链 | POST | `/sap/bw/modeling/pc/{id}?action=lock` | 锁定流程链以便编辑 |
| 解锁流程链 | POST | `/sap/bw/modeling/pc/{id}?action=unlock` | 解锁流程链 |
| 激活流程链 | POST | `/sap/bw/modeling/activation` | 激活流程链 |
| 检查流程链 | POST | `/sap/bw/modeling/activation` | 检查流程链一致性 |
| 执行流程链 | POST | `/sap/bw/modeling/pc/{id}?action=execute` | 执行流程链 |
| 停止流程链 | POST | `/sap/bw/modeling/pc/{id}?action=stop` | 停止正在运行的流程链 |
| 获取日志 | GET | `/sap/bw/modeling/pc/{id}/logs` | 获取流程链执行日志 |
| 获取状态 | GET | `/sap/bw/modeling/pc/{id}/status` | 获取流程链运行状态 |
| **验证 Process Chain 存在** | **POST** | **`/sap/bw/modeling/validation`** | **验证 Process Chain 是否存在** |
| **验证新 Process Chain 名称** | **POST** | **`/sap/bw/modeling/validation`** | **验证新名称是否可用** |
| **验证 Process Chain 可删除** | **POST** | **`/sap/bw/modeling/validation`** | **验证是否可删除** |
| **验证 Process Chain 可激活** | **POST** | **`/sap/bw/modeling/validation`** | **验证是否可激活** |

#### Process Chain 使用示例

```typescript
import { BWAdtClient } from "bw-adt-api"

const client = new BWAdtClient(
  "http://bw-system:8000",
  "username",
  "password"
)

await client.login()

// 获取流程链详情
const chainDetails = await client.getProcessChainDetails("PC_DAILY_LOAD")
console.log(`Chain: ${chainDetails.name}`)
console.log(`Status: ${chainDetails.status}`)
if (chainDetails.steps) {
  console.log(`Steps: ${chainDetails.steps.length}`)
  chainDetails.steps.forEach(step => {
    console.log(`  - ${step.stepType}: ${step.stepId}`)
  })
}

// 获取版本历史
const versions = await client.getProcessChainVersions("PC_DAILY_LOAD")
versions.forEach(v => {
  console.log(`Version ${v.version}: ${v.description}`)
})

// 锁定并激活流程链
const lockResult = await client.lockProcessChain("PC_DAILY_LOAD")
console.log(`Lock Handle: ${lockResult.lockHandle}`)

const activateResult = await client.activateProcessChain(
  "PC_DAILY_LOAD",
  lockResult.lockHandle
)
console.log(`Activation Success: ${activateResult.success}`)

await client.unlockProcessChain("PC_DAILY_LOAD")

// 检查流程链一致性
const checkResult = await client.checkProcessChain("PC_DAILY_LOAD")
console.log(`Check Success: ${checkResult.success}`)
checkResult.messages.forEach(msg => {
  console.log(`  ${msg.type}: ${msg.message}`)
})

// 执行流程链
const execResult = await client.executeProcessChain("PC_DAILY_LOAD")
console.log(`Execution Success: ${execResult.success}`)
if (execResult.requestID) {
  console.log(`Request ID: ${execResult.requestID}`)
}

// 获取执行日志
const logs = await client.getProcessChainLogs("PC_DAILY_LOAD")
console.log(`Found ${logs.length} log entries`)
logs.forEach(log => {
  console.log(`  [${log.timestamp}] ${log.status}: ${log.message}`)

  // 获取运行状态
  const status = await client.getProcessChainStatus("PC_DAILY_LOAD")
  console.log(`Status: ${status.status}`)
  if (status.currentStep) {
    console.log(`Current: ${status.currentStep}`)
    console.log(`Progress: ${status.completedSteps}/${status.totalSteps}`)
  }

  // 停止正在运行的流程链
  const stopResult = await client.stopProcessChain("PC_DAILY_LOAD")
  console.log(`Stop Success: ${stopResult.success}`)
}
```
