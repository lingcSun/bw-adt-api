# BW-ADT-API - 基于 Communication Log 的完整 API 封装

## 项目概述

根据 SAP BW/4HANA Communication Log 实际追踪结果，封装 BW ADT REST API。

## 已实现的 API 模块

### 1. InfoProvider 结构查询 (`infoprovider.ts`)

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
| 锁定 ADSO | POST | `/sap/bw/modeling/adso/{id}?action=lock` | 锁定 ADSO 以便编辑 |
| 解锁 ADSO | POST | `/sap/bw/modeling/adso/{id}?action=unlock` | 解锁 ADSO |
| 激活 ADSO | POST | `/sap/bw/modeling/activation` | 激活 ADSO |
| 检查 ADSO | POST | `/sap/bw/modeling/activation` | 检查 ADSO 一致性 |

### 5. Transformation 操作 (`transformation.ts`)

| 功能 | HTTP 方法 | 端点 | 描述 |
|------|-----------|------|------|
| 锁定转换 | POST | `/sap/bw/modeling/trfn/{id}?action=lock` | 锁定 Transformation 以便编辑 |
| 解锁转换 | POST | `/sap/bw/modeling/trfn/{id}?action=unlock` | 解锁 Transformation |
| 获取转换 | GET | `/sap/bw/modeling/trfn/{id}/{version}` | 获取转换元数据 |
| 激活对象 | POST | `/sap/bw/modeling/activation` | 激活 BW 对象 |

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
const adsoLock = await client.lockADSO("ZL_FID01")
const adsoActivateResult = await client.activateADSO("ZL_FID01", adsoLock.lockHandle)
await client.unlockADSO("ZL_FID01")

// 锁定并激活 Transformation
const lockResult = await client.lockTransformation("0F30KPOAZK07TIY86JBGVAO9XHWIVIBT")
const activateResult = await client.activateObject(
  "/sap/bw/modeling/trfn/0f30kpoazk07tiy86jbgvao9xhwivibt/m",
  lockResult.lockHandle
)
await client.unlockTransformation("0F30KPOAZK07TIY86JBGVAO9XHWIVIBT")

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
| `sapbwmodelingactivation.txt` | 激活对象 | `/sap/bw/modeling/activation` |
| `sapbwmodelingadso*` | ADSO 操作 | `/sap/bw/modeling/adso/*` |
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
- Process Chain 操作
- InfoObject 详细操作
- Query 管理
