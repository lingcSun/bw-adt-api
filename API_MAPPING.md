# BW-ADT-API - 基于 Communication Log 的完整 API 封装

## 项目概述

根据 SAP BW/4HANA Communication Log 实际追踪结果，封装 BW ADT REST API。

## 已实现的 API 模块

### 1. InfoObject 操作 (`infoobject.ts`) ✅ 新增

| 功能 | HTTP 方法 | 端点 | 描述 |
|------|-----------|------|------|
| 获取 InfoObject | GET | `/sap/bw/modeling/iobj/{name}/a` | 获取 InfoObject 详细信息 (v2_1_0) |
| 获取 InfoObject 元数据 | GET | `/sap/bw/modeling/iobj/{name}/m` | 获取 InfoObject 元数据 |

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

## 使用示例

```typescript
import { BWAdtClient } from "bw-adt-api"

const client = new BWAdtClient(
  "http://bw-system:8000",
  "username",
  "password"
)

await client.login()

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
| `sapbwmodelingadso*m?lockHandle=*` | 更新 ADSO | `PUT /sap/bw/modeling/adso/*/m` |
| `sapbwmodelingiobj*` | InfoObject 操作 | `/sap/bw/modeling/iobj/*` |
| `sapbwmodelingdtpadtp*.txt` | DTP 操作 | `/sap/bw/modeling/dtpa/*` |

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
