# BW-ADT-API 完整 API 参考（代码生成）

> 本文件由 `scripts/gen-api-reference.mjs` 从源码机械生成，生成器对"分类表 vs 代码导出"做集合断言，保证与代码 100% 一致。
> 重新生成：`node scripts/gen-api-reference.mjs [--results .local/verify-results.json]`。最后生成：2026-09-21。

## 分类

| 类 | 含义 | 数量 |
|---|---|---|
| **读 (R)** | 非变更：GET、搜索、validation/checkruns 探针、数据预览、BICS 会话分析 | 71 |
| **写 (W)** | 变更或建立会话：lock/unlock、create/update/delete/activate、编排、执行、TR 创建 | 43 |
| **本地 (L)** | 纯函数：XML/解析/工厂辅助，无服务器 I/O | 46 |

读/写 API 的真机验证状态见状态列（✅/⚠️/❌，⚠️ 含"范围外未验证"登记）与 [VERIFIED_APIS.md](./VERIFIED_APIS.md)。写验证范围：ZGLD_TEST / $TMP 本地对象（2026-09-21）。

> 2026-09-20：依据读验证 V1 结论（validation 端点拒绝 delete/activate action、PC/DTPA 不支持 new/exists），
> 13 个 `validate*CanDelete/CanActivate/validateProcessChain*/validateDTPNewName` 函数已从 API 面移除，
> `ValidationAction` 仅存 EXISTS/NEW。
> 2026-09-21：依据 V2 结论（/sap/bc/adt/bw/objects/* 服务树本系统 404），
> `infoObjects`/`infoObjectDetails`/`infoObjectCatalogs` 及其类型已移除。
> 详见 VERIFIED_APIS 第 7 节。

## 总览

| 模块 | api 函数 | 门面 |
|---|---|---|
| abapClass | 8 | — |
| adso | 29 | AdsoDomain |
| bwObject | 1 | — |
| common | 8 | — |
| dataflow | 2 | RepositoryDomain |
| datasource | 15 | DataSourceDomain |
| ddic | 10 | DdicDomain |
| dtp | 14 | DtpDomain |
| infoobject | 5 | InfoObjectDomain |
| processchain | 13 | ProcessChainDomain |
| replication | 6 | DataSourceDomain |
| reporting | 8 | QueryDomain |
| repository | 2 | RepositoryDomain |
| search | 5 | RepositoryDomain |
| systemInfo | 3 | SystemDomain |
| transformation | 27 | TrfnDomain |
| transport | 4 | TransportDomain |


## API 层（src/api/*.ts，160 个导出函数）


### 通用（激活/检查/验证/会话恢复）（`common.ts`）

| 函数 | 类 | 端点/说明 | 验证状态 |
|---|---|---|---|
| `activateObject` | 写 | POST /sap/bw/modeling/activation — 激活对象（checkProperties feed） | ✅ 经 activateADSO/…家族调用（activateADSO/DTP 路径） |
| `checkObject` | 读 | POST /sap/bw/modeling/checkruns — 一致性检查（不激活；注意与激活端点不同） | ✅ checkruns（写后一致性 success=true） |
| `validateObject` | 读 | POST /sap/bw/modeling/validation — 对象验证（exists/new/delete/activate） | ✅ AREA token valid=true（与 adso.validateObject 同端点独立符号） |
| `parseActivationResponse` | 本地 | 解析激活/检查 ATOM 响应 | — |
| `parseLockResponse` | 本地 | 解析 lock 响应（lockHandle/corrNr/isLocal） | — |
| `parseObjectVersions` | 本地 | 解析版本 ATOM feed | — |
| `isServerErrorException` | 本地 | 判定 5xx 类异常 | — |
| `withFreshSessionOnServerError` | 写 | 会话恢复 — 5xx 时 dropSession+重登并重试一次（仅限 lock 入口） | ⚠️ 已由离线单测覆盖（无法安全制造真机 500 中毒） |

### 通用 BW 对象基类（`bwObject.ts`）

| 函数 | 类 | 端点/说明 | 验证状态 |
|---|---|---|---|
| `createBWObject` | 本地 | BWObject 泛型实例工厂（lock/unlock/check/versions/create/update/delete） | — |

### ADSO（Advanced DataStore Object）（`adso.ts`）

| 函数 | 类 | 端点/说明 | 验证状态 |
|---|---|---|---|
| `validateObject` | 读 | POST /sap/bw/modeling/validation — 对象验证（通用，ADSO 域内副本） | ✅ IOBJ token valid=true |
| `validateInfoArea` | 读 | POST /sap/bw/modeling/validation — InfoArea 存在性 | ✅ valid |
| `validateTemplateADSO` | 读 | POST /sap/bw/modeling/validation — 模板 ADSO 存在性 | ✅ valid（0* ADSO 作模板） |
| `templateValidationObjectType` | 本地 | tlogo → validation objectType 映射 | — |
| `validateNewADSOName` | 读 | POST /sap/bw/modeling/validation — 新名称可用性 | ✅ 新名 valid=true；重名报错(名称为 ZADSO_02（类型为 ADSO）的信息提供者已存在) |
| `getADSO` | 读 | GET /sap/bw/modeling/adso/{id}/m — ADSO 完整解析树 | ✅ 0标准:name✓/xml 4678B；Z客户:name✓/xml 4678B；Z客户2:name✓/xml 7600B；命名空间:name✓/xml 15205B |
| `getADSODetails` | 读 | GET /sap/bw/modeling/adso/{id}/m — ADSO 元数据（解析后） | ✅ 0标准:name✓/xml 4678B；Z客户:name✓/xml 4678B；Z客户2:name✓/xml 7600B；命名空间:name✓/xml 15205B |
| `getADSOXml` | 读 | GET /sap/bw/modeling/adso/{id}/m — ADSO 原始 XML | ✅ 0标准:name✓/xml 4678B；Z客户:name✓/xml 4678B；Z客户2:name✓/xml 7600B；命名空间:name✓/xml 15205B |
| `getADSOVersions` | 读 | GET /sap/bw/modeling/adso/{id}/versions — 版本历史 | ✅ Z 2 版本；命名空间 9 |
| `getADSOConfiguration` | 读 | GET /sap/bw/modeling/adso/{id}/configuration — 配置信息 | ✅ 0*+Z* 两样本（键 8/8） |
| `getADSOTables` | 读 | GET /sap/bw/modeling/adso/{id}/{version} — 关联表名（AT/AQ/CL） | ✅ activeTable=/BIC/AXXXXXX…；命名空间 activeTable=✓ |
| `getADSONodePath` | 读 | GET /sap/bw/modeling/repo/nodepath — 仓库节点路径 | ✅ adso 3 节点 |
| `checkADSO` | 读 | POST /sap/bw/modeling/checkruns — 一致性检查 | ✅ success=true |
| `validateADSOExists` | 读 | POST /sap/bw/modeling/validation — 存在性 | ✅ 存在=valid；负例报错(数据存储对象 'ZQNOTXIST9' 不存在) |
| `validateADSONewName` | 读 | POST /sap/bw/modeling/validation — 新名称可用性 | ✅ 新名 valid=true；重名报错(名称为 ZADSO_02（类型为 ADSO）的信息提供者已存在) |
| `createADSO` | 写 | POST /sap/bw/modeling/adso/{name}?lockHandle — 创建（需先 lock） | ✅ blank 创建 200（经 createADSOFull） |
| `createADSOFull` | 写 | 验证→lock→创建→(激活)→unlock — 创建编排（门面入口） | ✅ 门面编排（验证→lock→create→unlock） |
| `lockADSO` | 写 | POST /adso/{id}?action=lock — 锁定（stateful） | ✅ stateful 锁；重复 lock 同 handle✓；isLocal=true |
| `unlockADSO` | 写 | POST /adso/{id}?action=unlock — 解锁（stateful） | ✅ 解锁（finally 语义） |
| `activateADSO` | 写 | POST /sap/bw/modeling/activation — 激活 | ✅ 经 addADSOField 编排激活（active 回读） |
| `updateADSO` | 写 | PUT /sap/bw/modeling/adso/{id}/m — 保存 XML（stateless） | ✅ PUT 改 label（timestamp 自动提取） |
| `saveAndActivateADSO` | 写 | lock→transport→PUT→activate→unlock — 保存并激活编排 | ✅ lock→transport(undefined)→PUT→activate→unlock 全链 |
| `addADSOKey` | 写 | getXml→addADSOKeyToXml→saveAndActivate — 加键编排（默认不激活） | ✅ keyElement+引用元素 PUT（activated=false，由 addField 收尾激活） |
| `buildADSOFieldElementXml` | 本地 | 本地字段元素 XML（infoObjectName 时分派引用分支） | — |
| `buildADSOInfoObjectElementXml` | 本地 | IOBJ 引用字段元素 XML（最小形态） | — |
| `addADSOFieldToXml` | 本地 | 插入字段（无键 fail-fast） | — |
| `addADSOKeyToXml` | 本地 | 插入键定义（keyElement+引用元素，幂等） | — |
| `removeADSOFieldFromXml` | 本地 | 移除字段元素 | — |
| `extractADSOTimestamp` | 本地 | 提取 changedAt → timestamp 头 | — |

### TRFN（Transformation）（`transformation.ts`）

| 函数 | 类 | 端点/说明 | 验证状态 |
|---|---|---|---|
| `getTransformation` | 读 | GET /sap/bw/modeling/trfn/{id}/{version} — TRFN 解析树 | ✅ 解析树双样本（经 details/xml 已验同名端点） |
| `getTransformationDetails` | 读 | GET /sap/bw/modeling/trfn/{id}/{version} — TRFN 元数据 | ✅ 双样本；source.name=无；例程类=找到 |
| `getTransformationXml` | 读 | GET /sap/bw/modeling/trfn/{id}/{version} — TRFN 原始 XML | ✅ 278363/76290B 双样本 |
| `getTransformationVersions` | 读 | GET /sap/bw/modeling/trfn/{id}/versions — 版本历史 | ✅ 106 版本 |
| `checkTransformation` | 读 | POST /sap/bw/modeling/checkruns — 一致性检查 | ✅ success=true |
| `validateTransformationExists` | 读 | POST /sap/bw/modeling/validation — 存在性 | ✅ valid=true |
| `validateTransformationNewName` | 读 | POST /sap/bw/modeling/validation — 新名称可用性 | ✅ valid=true（新生成 id） |
| `lockTransformation` | 写 | POST /trfn/{id}?action=lock — 锁定（stateful） | ✅（createTransformation 内 CREA lock + saveAndActivate 内 lock/unlock 复用同模型） |
| `unlockTransformation` | 写 | POST /trfn/{id}?action=unlock — 解锁 | ✅（同上，finally unlock） |
| `updateTransformation` | 写 | PUT /sap/bw/modeling/trfn/{id}/m — 保存 XML | ✅ PUT 带 addRule(CONSTANT) XML |
| `activateTransformation` | 写 | POST /sap/bw/modeling/activation — 激活 | ✅ 编排内激活（success 回读） |
| `saveAndActivateTransformation` | 写 | lock→transport→PUT→activate→unlock — 保存并激活编排 | ✅ lock→PUT→activate→unlock（本地无 TR） |
| `createTransformation` | 写 | GET 8TRANSIENT→CREA lock→POST→unlock — 8TRANSIENT 瞬态流创建 | ✅ 8TRANSIENT 瞬态流（0DYWYICUWK…，A3→A2） |
| `parseTransformationSettings` | 本地 | 解析 settings/例程步骤规则 | — |
| `extractTransformationTimestamp` | 本地 | 提取 changedAt | — |
| `extractAbapClassName` | 本地 | 从解析树提取例程 ABAP 类名（含回退） | — |
| `extractRoutineMethodName` | 本地 | 提取例程方法名 | — |
| `isEndRoutineFieldSelected` | 本地 | END 例程字段选中判定 | — |
| `addFieldToEndRoutine` | 本地 | END 例程加字段（XML） | — |
| `removeFieldFromEndRoutine` | 本地 | END 例程去字段（XML） | — |
| `hasStartRoutine` | 本地 | START 例程存在判定 | — |
| `hasEndRoutine` | 本地 | END 例程存在判定 | — |
| `hasExpertRoutine` | 本地 | EXPERT 例程存在判定 | — |
| `addTransformationRule` | 本地 | 规则 XML 构建（定向/常量/初选等） | — |
| `addRule` | 本地 | 通用规则入口（DIRECT/CONSTANT/INITIAL/FORMULA/NO_UPDATE） | — |
| `autoMapTransformationFields` | 本地 | 同名字段自动映射（XML） | — |
| `switchTransformationRuntime` | 本地 | 翻转 HANARuntime 根属性（XML） | — |

### DTP（Data Transfer Process）（`dtp.ts`）

| 函数 | 类 | 端点/说明 | 验证状态 |
|---|---|---|---|
| `getDTP` | 读 | GET /sap/bw/modeling/dtpa/{id}/m — DTP 解析树 | ✅ 解析树 |
| `getDTPXml` | 读 | GET /sap/bw/modeling/dtpa/{id}/m — DTP 原始 XML | ✅ 127303B |
| `getDTPDetails` | 读 | GET /sap/bw/modeling/dtpa/{id}/m — DTP 元数据（source/target/tlogo） | ✅ 双样本 src/tgt✓（→…） |
| `getDTPVersions` | 读 | GET /sap/bw/modeling/dtpa/{id}/versions — 版本历史 | ✅ 10 版本 |
| `checkDTP` | 读 | POST /sap/bw/modeling/checkruns — 一致性检查 | ✅ success=true |
| `validateDTPExists` | 读 | POST /sap/bw/modeling/validation — 存在性 | ✅ valid=true |
| `lockDTP` | 写 | POST /dtpa/{id}?action=lock — 锁定 | ✅ stateful 锁（isLocal=true） |
| `unlockDTP` | 写 | POST /dtpa/{id}?action=unlock — 解锁 | ✅ 解锁 |
| `activateDTP` | 写 | POST /sap/bw/modeling/activation — 激活 | ✅ 激活后 active 回读 |
| `updateDTP` | 写 | PUT /sap/bw/modeling/dtpa/{id}/m — 保存 XML | ✅ extractionSettings.packageSize 编辑 PUT 持久化实测；overview@description 为服务端派生字段（PUT 接受不持久） |
| `executeDTP` | 写 | POST /dtpa/{id}?action=execute — 运维执行（批量运行） | ❌ W3：?action=execute 本系统「内部错误：不支持 URI」——从未有真机验证记录，需 Eclipse 抓包 |
| `createDTP` | 写 | POST /sap/bw/modeling/dtpa/{id}?lockHandle — CREA lock→collection POST 创建 | ✅ CREA lock→collection POST；W2 已处置：TRFN 须 active 预检（inactive 明确报错、active 放行实测）+ description 不生效已文档化 |
| `saveAndActivateDTP` | 写 | lock→transport→PUT→activate→unlock — 保存并激活编排 | ✅ 编辑→激活→DTP active 回读 |
| `generateDtpId` | 本地 | 生成 DTP_<26 位> 技术名 | — |

### RSDS（DataSource）（`datasource.ts`）

| 函数 | 类 | 端点/说明 | 验证状态 |
|---|---|---|---|
| `getDataSource` | 读 | GET /sap/bw/modeling/rsds/{ds}/{sys}/m — RSDS 解析树（版本在 atom:id） | ✅ 解析树 |
| `getDataSourceXml` | 读 | GET /sap/bw/modeling/rsds/{ds}/{sys}/m — RSDS 原始 XML | ✅ 9284B |
| `getDataSourceDetails` | 读 | GET /sap/bw/modeling/rsds/{ds}/{sys}/m — RSDS 元数据 | ✅ 样本1(sys XXXXXXXXXX)✓；样本2(sys XXXXXXXXXX)✓ |
| `getDataSourceFields` | 读 | GET /sap/bw/modeling/rsds/{ds}/{sys}/m — 字段列表 | ✅ 10 字段 |
| `getDataSourceVersions` | 读 | GET /sap/bw/modeling/rsds/{ds}/{sys}/versions — 版本历史 | ✅ 1 版本（版本字符在 atom:id，RSDS 特例） |
| `lockDataSource` | 写 | POST /rsds/{ds}/{sys}?action=lock — 锁定（含 5xx 会话恢复） | ⚠️ 无本地 RSDS 靶子（RSDS 属源系统对象，非 ZGLD_TEST 本地） |
| `unlockDataSource` | 写 | POST /rsds/{ds}/{sys}?action=unlock — 解锁 | ⚠️ 同上 |
| `updateDataSource` | 写 | PUT /sap/bw/modeling/rsds/{ds}/{sys}/m — 保存 XML | ⚠️ 同上 |
| `activateDataSource` | 写 | POST /sap/bw/modeling/activation — 激活 | ⚠️ 同上 |
| `mergeDataSourceProposal` | 写 | POST /rsds/{ds}/{sys}/proposals — 适配器变更后字段合并建议 | ⚠️ 同上（且需适配器变更前置） |
| `saveAndActivateDataSource` | 写 | lock→transport→PUT→activate→unlock — 保存并激活编排 | ⚠️ 同上 |
| `parseDataSourceDetails` | 本地 | 解析 RSDS 元数据 | — |
| `parseDataSourceFields` | 本地 | 解析字段列表 | — |
| `parseDataSourceVersions` | 本地 | 解析版本 feed | — |
| `extractDataSourceTimestamp` | 本地 | 提取 changedAt | — |

### 复制（Replication）（`replication.ts`）

| 函数 | 类 | 端点/说明 | 验证状态 |
|---|---|---|---|
| `getReplicationInfo` | 读 | GET /sap/bw/modeling/lsysint/replication — 源系统复制信息 | ✅ 0 任务（源系统 XXXXXXXXXX） |
| `replicateDataSource` | 写 | POST /lsysint/replication — 触发复制 | ⚠️ 复制影响面超出本地对象（系统级操作） |
| `replicateDataSourceFull` | 写 | POST /lsysint/replication — 全量复制 | ⚠️ 同上 |
| `buildReplicationRequestBody` | 本地 | 复制请求体构建 | — |
| `parseReplicationTasks` | 本地 | 解析复制任务 | — |
| `parseReplicationResult` | 本地 | 解析复制结果 | — |

### DDIC 表与数据预览（`ddic.ts`）

| 函数 | 类 | 端点/说明 | 验证状态 |
|---|---|---|---|
| `getADSODDICLinks` | 读 | GET /sap/bw/modeling/adso/{id}/m — Link 头解析（ddicTableLink 是模板占位符） | ✅ Link 头解析✓；ddicTableLink 本样本缺失（F9 已文档化不可靠，取表名走 getADSODDICTableName）；defaultDataPreview=无 |
| `getADSODDICTableName` | 读 | GET /sap/bw/modeling/adso/{id}/{version} — 真实表名（XML tables 段） | ✅ activeTable=/BIC/AXXXXXXXX… |
| `getDDICTableMetadata` | 读 | GET /sap/bc/adt/ddic/tables/{t} — 表元数据（blueSource） | ✅ 标准表(T000) 标准表 name✓；/BIC/ /BIC/ name✓ |
| `getDDICTableInfo` | 读 | GET /sap/bc/adt/ddic/tables/{t}/source/main — 表定义（DDL 源解析） | ✅ V7 修复后实测：T000 数据元素型 DDL 17 字段（MANDT key✓）；/BIC/ 原始类型 5 字段不回归 |
| `getDDICTableFields` | 读 | GET /sap/bc/adt/ddic/tables/{t}/source/main — 字段列表 | ✅ V7 修复后实测：T000 数据元素型 DDL 17 字段（MANDT key✓）；/BIC/ 原始类型 5 字段不回归 |
| `getDDICTableDataMetadata` | 读 | GET /sap/bc/adt/datapreview/ddic/{t}/metadata — 数据预览列元数据 | ✅ 标准表✓；/BIC/✓ |
| `getDDICTableData` | 读 | POST /sap/bc/adt/datapreview/ddic — 数据预览（SELECT，非变更） | ✅ 列表路径 0 行×7 列；selectStar(T000) 2 行 |
| `getTableDataViaSQL` | 读 | POST /sap/bc/adt/datapreview/freestyle — Freestyle OpenSQL 查询 | ✅ freestyle 2 行（ORDER BY 生效） |
| `parseLinkHeader` | 本地 | Link 头解析 | — |
| `extractTableNameFromUrl` | 本地 | 从 DDIC URL 提表名 | — |

### 搜索与关联（`search.ts`）

| 函数 | 类 | 端点/说明 | 验证状态 |
|---|---|---|---|
| `searchBWObjects` | 读 | GET /sap/bw/modeling/repo/is/bwsearch — BW 对象搜索（名称/描述/类型过滤） | ✅ 样本采集即用（Z=1224/0=3189；名称+类型过滤）；日期过滤窄区间 163 条（合法无错） |
| `quickSearch` | 读 | GET /sap/bw/modeling/repo/is/bwsearch — 按名快速搜索 | ✅ 命中 4；无匹配负例=0 |
| `searchByObjectType` | 读 | GET /sap/bw/modeling/repo/is/bwsearch — 按类型搜索 | ✅ ADSO 267/TRFN 389/RSPC 89，类型无泄漏 |
| `getTransformationsOf` | 读 | GET /sap/bw/modeling/repo/is/bwsearch — InfoProvider 关联 TRFN | ✅ 样本 1 条（负例 0） |
| `getDTPsOf` | 读 | GET /sap/bw/modeling/repo/is/bwsearch — InfoProvider 关联 DTP | ✅ 0 条 |

### 数据流与血缘（DMOD）（`dataflow.ts`）

| 函数 | 类 | 端点/说明 | 验证状态 |
|---|---|---|---|
| `getDataflow` | 读 | GET /sap/bw/modeling/dmod/8TRANSIENT — DMOD 数据流（上/下游） | ✅ up1=0 down1=0 both=0 |
| `getDataflowLineage` | 读 | GET /sap/bw/modeling/dmod/8TRANSIENT — 血缘（upstream/downstream/both） | ✅ 1 关系（source=XXXXXXXX） |

### InfoObject（`infoobject.ts`）

| 函数 | 类 | 端点/说明 | 验证状态 |
|---|---|---|---|
| `getInfoObject` | 读 | GET /sap/bw/modeling/iobj/{n}/a — InfoObject 详情（modified 版本） | ✅ 特征(0MATERIAL)✓；关键指标(0QUANTITY)✓；Z 定制✓ |
| `getInfoObjectMetadata` | 读 | GET /sap/bw/modeling/iobj/{n}/m — InfoObject 元数据（active） | ✅ 特征样本 /m 版本 |
| `validateInfoObjectExists` | 读 | POST /sap/bw/modeling/validation — 存在性 | ✅ valid=true |
| `validateInfoObjectNewName` | 读 | POST /sap/bw/modeling/validation — 新名称可用性 | ✅ valid=true |
| `parseInfoObjectDetails` | 本地 | 解析 InfoObject 详情 | — |

### 仓库目录（InfoObject Catalog）（`repository.ts`）

| 函数 | 类 | 端点/说明 | 验证状态 |
|---|---|---|---|
| `getInfoproviderStructure` | 读 | GET /sap/bw/modeling/repo/infoproviderstructure/area/{area}/{type} — InfoArea 查询树（2026-09-21 真机验证） | ✅ cha=20 kyf=0 adso=0；负例区域=空数组 |
| `parseInfoproviderStructure` | 本地 | 解析结构 feed | — |

### 系统信息（`systemInfo.ts`）

| 函数 | 类 | 端点/说明 | 验证状态 |
|---|---|---|---|
| `systemInfo` | 读 | GET /sap/bw/modeling/repo/is/systeminfo — 系统信息（properties[]） | ✅ properties 结构✓ |
| `getSystemProperty` | 读 | GET /sap/bw/modeling/repo/is/systeminfo — 读取单个系统属性 | ✅ system.logsys=有值；非法属性=空(不报错) |
| `hasCapability` | 读 | GET /sap/bw/modeling/repo/is/systeminfo — 能力判定 | ✅ planning=true；非法=false（false 不报错） |

### Process Chain（rspc JSON）（`processchain.ts`）

| 函数 | 类 | 端点/说明 | 验证状态 |
|---|---|---|---|
| `getProcessChain` | 读 | GET /sap/bw/modeling/rspc/{id}/m — 链元数据（JSON，已实测） | ✅ name✓ objVers=M |
| `getProcessChainDetails` | 读 | GET /sap/bw/modeling/rspc/{id}/m — 链详情（JSON，已实测） | ✅ 双链 status=active/active |
| `getProcessChainVersions` | 读 | GET /sap/bw/modeling/rspc/{id}/versions — ⚠️ 本系统不支持（对象版本 V） | ⚠️ 本系统不支持（V）——文档化行为复认 |
| `getProcessChainLogs` | 读 | GET /sap/bw/modeling/rspc/{id}/logs — ⚠️ 本系统不支持（对象版本 L） | ⚠️ 本系统不支持（L）——文档化行为复认 |
| `getProcessChainStatus` | 读 | GET /sap/bw/modeling/rspc/{id}/status — ⚠️ 本系统不支持（对象版本 S） | ⚠️ 本系统不支持（S）——文档化行为复认 |
| `checkProcessChain` | 读 | POST /sap/bw/modeling/checkruns — 一致性检查（⚠️ 未实测） | ✅ success=true（rspc 前缀经 checkruns） |
| `lockProcessChain` | 写 | POST /rspc/{id}?action=lock — 锁定（⚠️ 未实测） | ⚠️ 需专用可执行测试链（业务链不可动） |
| `unlockProcessChain` | 写 | POST /rspc/{id}?action=unlock — 解锁（⚠️ 未实测） | ⚠️ 同上 |
| `activateProcessChain` | 写 | POST /sap/bw/modeling/activation — 激活（⚠️ 未实测） | ⚠️ 同上 |
| `executeProcessChain` | 写 | POST /rspc/{id}?action=execute — 执行（⚠️ 未实测） | ⚠️ 同上 |
| `stopProcessChain` | 写 | POST /rspc/{id}?action=stop — 停止（⚠️ 未实测） | ⚠️ 同上 |
| `parseProcessChainMetaData` | 本地 | 解析 rspc JSON 元数据 | — |
| `parseProcessChainDetails` | 本地 | 解析 rspc JSON 详情 | — |

### CTS 传输（`transport.ts`）

| 函数 | 类 | 端点/说明 | 验证状态 |
|---|---|---|---|
| `transportCheck` | 读 | POST /sap/bc/adt/cts/transportchecks — 录制检查（非变更探针） | ✅ 0*样本 RECORDING=空；Z 样本 RECORDING=空 TR=0 |
| `createTransport` | 写 | POST /sap/bc/adt/cts/transports — 新建工作台请求 | ⚠️ 创建 TR 属传输组织器写（超出 ZGLD_TEST/本地对象范围） |
| `resolveTransportForWrite` | 写 | check→(create)→TR — 写前 TR 解析编排 | ✅ 本地对象 RECORDING 空 → undefined，不建 TR（全链实证） |
| `isTransportRequiredError` | 本地 | TransportRequiredError 判定 | — |

### ABAP 类（例程运行时类）（`abapClass.ts`）

| 函数 | 类 | 端点/说明 | 验证状态 |
|---|---|---|---|
| `getAbapClassMetadata` | 读 | GET /sap/bc/adt/oo/classes/{n} — 类元数据 | ✅ ✓ |
| `getAbapClassSource` | 读 | GET /sap/bc/adt/oo/classes/{n}/source/main — 类源码（例程读） | ✅ 42270B sourceCode（类 /BIC/RXXXXXXXXXXXXXXXXXXXXX） |
| `getAbapClassObjectStructure` | 读 | GET /sap/bc/adt/oo/classes/{n} — 类结构 | ✅ ✓ |
| `lockAbapClass` | 写 | POST /oo/classes/{n}?_action=LOCK — 类锁定 | ⚠️ 例程类属业务 TRFN（例程创建无 REST 路径，无法本地造靶） |
| `unlockAbapClass` | 写 | POST /oo/classes/{n}?_action=UNLOCK — 类解锁 | ⚠️ 同上 |
| `updateAbapClassSource` | 写 | PUT /oo/classes/{n}/source/main — 保存类源码 | ⚠️ 同上 |
| `activateAbapClass` | 写 | POST /sap/bc/adt/activation — 类激活（非 BW modeling） | ⚠️ 同上 |
| `saveAndActivateAbapClassSource` | 写 | lock→PUT→activate→unlock — 类源码保存编排 | ⚠️ 同上 |

### BICS Reporting（`reporting.ts`）

| 函数 | 类 | 端点/说明 | 验证状态 |
|---|---|---|---|
| `queryProviderPreview` | 读 | POST /sap/bw/modeling/comp/reporting — BICS 提供者预览（会话状态） | ✅ rows=[4XXXXXXXX-BELNR] 预览✓ |
| `getReportingInitialView` | 读 | POST /sap/bw/modeling/comp/reporting — BICS 初始视图（会话状态） | ✅ 初始视图可用 |
| `updateReportingView` | 读 | POST /sap/bw/modeling/comp/reporting — BICS 视图增量更新（仅会话状态，非持久） | ✅ state 回写✓ |
| `toReportingCompId` | 本地 | 对象名 → BICS comp id | — |
| `buildQuerySelectorXml` | 本地 | query selector XML 构建 | — |
| `remapReportingState` | 本地 | 视图状态 id 重映射 | — |
| `flattenReportingResultSet` | 本地 | 结果集扁平化 | — |
| `parseQueryView` | 本地 | 视图响应解析 | — |

## 域门面（src/domains/*.ts，63 个方法）

> 门面是对 api 层的薄转发；类（读/写/本地）继承目标函数。


### AdsoDomain

| 方法 | 类 | 目标 |
|---|---|---|
| `details` | 读 | → getADSODetails |
| `xml` | 读 | → getADSOXml |
| `versions` | 读 | → getADSOVersions |
| `check` | 读 | → checkADSO |
| `saveAndActivate` | 写 | → saveAndActivateADSO |
| `addField` | 写 | → @addADSOFieldToXml 编排 |
| `addKey` | 写 | → addADSOKey |
| `create` | 写 | → createADSOFull |
| `validateInfoArea` | 读 | → validateInfoArea |
| `validateTemplate` | 读 | → validateTemplateADSO |
| `validateNewName` | 读 | → validateNewADSOName |
| `getRaw` | 读 | → getADSO |

### DataSourceDomain

| 方法 | 类 | 目标 |
|---|---|---|
| `details` | 读 | → getDataSourceDetails |
| `fields` | 读 | → getDataSourceFields |
| `xml` | 读 | → getDataSourceXml |
| `versions` | 读 | → getDataSourceVersions |
| `saveAndActivate` | 写 | → saveAndActivateDataSource |
| `mergeProposal` | 写 | → mergeDataSourceProposal |
| `replicationInfo` | 读 | → getReplicationInfo |
| `replicate` | 写 | → replicateDataSource |
| `replicateFull` | 写 | → replicateDataSourceFull |

### DdicDomain

| 方法 | 类 | 目标 |
|---|---|---|
| `describe` | 读 | → getDDICTableInfo |
| `getData` | 读 | → getDDICTableData |
| `querySql` | 读 | → getTableDataViaSQL |
| `adsoDdicLinks` | 读 | → getADSODDICLinks |
| `adsoDdicTableName` | 读 | → getADSODDICTableName |

### DtpDomain

| 方法 | 类 | 目标 |
|---|---|---|
| `details` | 读 | → getDTPDetails |
| `xml` | 读 | → getDTPXml |
| `versions` | 读 | → getDTPVersions |
| `check` | 读 | → checkDTP |
| `activate` | 写 | → activateDTP |
| `saveAndActivate` | 写 | → saveAndActivateDTP |
| `execute` | 写 | → executeDTP |

### InfoObjectDomain

| 方法 | 类 | 目标 |
|---|---|---|
| `get` | 读 | → getInfoObject |
| `validateExists` | 读 | → validateInfoObjectExists |
| `validateNewName` | 读 | → validateInfoObjectNewName |

### ProcessChainDomain

| 方法 | 类 | 目标 |
|---|---|---|
| `details` | 读 | → getProcessChainDetails |
| `check` | 读 | → checkProcessChain |
| `execute` | 写 | → executeProcessChain |
| `stop` | 写 | → stopProcessChain |
| `logs` | 读 | → @getProcessChainLogs+Status |

### QueryDomain

| 方法 | 类 | 目标 |
|---|---|---|
| `initialView` | 读 | → getReportingInitialView |
| `updateView` | 读 | → updateReportingView |
| `preview` | 读 | → queryProviderPreview |

### RepositoryDomain

| 方法 | 类 | 目标 |
|---|---|---|
| `infoproviderStructure` | 读 | → getInfoproviderStructure |
| `search` | 读 | → searchBWObjects |
| `transformationsOf` | 读 | → getTransformationsOf |
| `dtpsOf` | 读 | → getDTPsOf |
| `dataflow` | 读 | → getDataflow |
| `lineage` | 读 | → getDataflowLineage |

### SystemDomain

| 方法 | 类 | 目标 |
|---|---|---|
| `info` | 读 | → systemInfo |
| `getProperty` | 读 | → getSystemProperty |
| `hasCapability` | 读 | → hasCapability |

### TransportDomain

| 方法 | 类 | 目标 |
|---|---|---|
| `check` | 读 | → transportCheck |
| `create` | 写 | → createTransport |

### TrfnDomain

| 方法 | 类 | 目标 |
|---|---|---|
| `details` | 读 | → getTransformationDetails |
| `xml` | 读 | → getTransformationXml |
| `versions` | 读 | → getTransformationVersions |
| `check` | 读 | → checkTransformation |
| `saveAndActivate` | 写 | → saveAndActivateTransformation |
| `create` | 写 | → createTransformation |
| `setEndRoutineFields` | 写 | → @addFieldToEndRoutine 编排 |
| `switchRuntime` | 本地 | → switchTransformationRuntime |

## BWAdtClient（src/BWAdtClient.ts）

> 每个公共方法动态导入对应 api 函数转发；下表「同名转发」指方法名 = api 函数名。域门面经 `client.<domain>` 访问（如 `client.adso.details`）。

| 方法 | 类 | 目标 |
|---|---|---|
| `login` | W | 会话 |
| `logout` | W | 会话 |
| `dropSession` | W | 会话 |
| `reentranceTicket` | W | 会话 |
| `systemInfo` | R | GET systeminfo |
| `getSystemProperty` | 读 | = getSystemProperty |
| `hasCapability` | 读 | = hasCapability |
| `searchBWObjects` | 读 | = searchBWObjects |
| `getInfoproviderStructure` | R | = getInfoproviderStructure |
| `quickSearch` | 读 | = quickSearch |
| `getADSOTransformations` | R | = getTransformationsOf |
| `getADSODataTransferProcesses` | R | = getDTPsOf |
| `getDataflow` | 读 | = getDataflow |
| `getDataflowLineage` | 读 | = getDataflowLineage |
| `createObject` | W | BWObject.create |
| `updateObject` | W | BWObject.update |
| `deleteObject` | W | BWObject.delete |
| `getObject` | L | 工厂 |
| `getADSO` | 读 | = getADSO |
| `getADSODetails` | 读 | = getADSODetails |
| `getADSOVersions` | 读 | = getADSOVersions |
| `lockADSO` | 写 | = lockADSO |
| `unlockADSO` | 写 | = unlockADSO |
| `activateADSO` | 写 | = activateADSO |
| `checkADSO` | 读 | = checkADSO |
| `updateADSO` | 写 | = updateADSO |
| `getADSOXml` | 读 | = getADSOXml |
| `saveAndActivateADSO` | 写 | = saveAndActivateADSO |
| `addADSOField` | W | getXml→addFieldToXml→saveAndActivate |
| `getADSOConfiguration` | 读 | = getADSOConfiguration |
| `validateInfoArea` | 读 | = validateInfoArea |
| `validateTemplateADSO` | 读 | = validateTemplateADSO |
| `validateNewADSOName` | 读 | = validateNewADSOName |
| `createADSO` | 写 | = createADSO |
| `getADSONodePath` | 读 | = getADSONodePath |
| `lockTransformation` | 写 | = lockTransformation |
| `unlockTransformation` | 写 | = unlockTransformation |
| `getTransformation` | 读 | = getTransformation |
| `activateObject` | W | POST activation |
| `activateTransformation` | 写 | = activateTransformation |
| `getTransformationDetails` | 读 | = getTransformationDetails |
| `getTransformationVersions` | 读 | = getTransformationVersions |
| `checkTransformation` | 读 | = checkTransformation |
| `updateTransformation` | 写 | = updateTransformation |
| `getTransformationXml` | 读 | = getTransformationXml |
| `createTransformation` | 写 | = createTransformation |
| `createDTP` | 写 | = createDTP |
| `saveAndActivateTransformation` | 写 | = saveAndActivateTransformation |
| `setEndRoutineFields` | W | addFieldToEndRoutine+save |
| `addTransformationRule` | 本地 | = addTransformationRule |
| `autoMapTransformationFields` | 本地 | = autoMapTransformationFields |
| `addTransformationRulesAndSave` | W | addRule+saveAndActivate |
| `autoMapTransformationFieldsAndSave` | W | autoMap+saveAndActivate |
| `getTransformationClass` | R | = getAbapClassMetadata |
| `getTransformationClassSource` | R | = getAbapClassSource |
| `saveAndActivateTransformationClassSource` | W | = saveAndActivateAbapClassSource |
| `updateTransformationClassSource` | W | = updateAbapClassSource |
| `switchRuntimeAndSave` | W | switchRuntime+saveAndActivate |
| `lockTransformationClass` | W | = lockAbapClass |
| `unlockTransformationClass` | W | = unlockAbapClass |
| `getInfoObject` | 读 | = getInfoObject |
| `getInfoObjectMetadata` | 读 | = getInfoObjectMetadata |
| `getDTP` | 读 | = getDTP |
| `getDTPXml` | 读 | = getDTPXml |
| `getDTPDetails` | 读 | = getDTPDetails |
| `getDTPVersions` | 读 | = getDTPVersions |
| `lockDTP` | 写 | = lockDTP |
| `unlockDTP` | 写 | = unlockDTP |
| `activateDTP` | 写 | = activateDTP |
| `activateDTPWithLock` | W | = activateDTP |
| `checkDTP` | 读 | = checkDTP |
| `executeDTP` | 写 | = executeDTP |
| `updateDTP` | 写 | = updateDTP |
| `transportCheck` | 读 | = transportCheck |
| `createTransport` | 写 | = createTransport |
| `saveAndActivateDTP` | 写 | = saveAndActivateDTP |
| `getDataSource` | 读 | = getDataSource |
| `getDataSourceXml` | 读 | = getDataSourceXml |
| `getDataSourceDetails` | 读 | = getDataSourceDetails |
| `getDataSourceVersions` | 读 | = getDataSourceVersions |
| `getDataSourceFields` | 读 | = getDataSourceFields |
| `lockDataSource` | 写 | = lockDataSource |
| `unlockDataSource` | 写 | = unlockDataSource |
| `updateDataSource` | 写 | = updateDataSource |
| `activateDataSource` | 写 | = activateDataSource |
| `mergeDataSourceProposal` | 写 | = mergeDataSourceProposal |
| `saveAndActivateDataSource` | 写 | = saveAndActivateDataSource |
| `getReplicationInfo` | 读 | = getReplicationInfo |
| `replicateDataSource` | 写 | = replicateDataSource |
| `replicateDataSourceFull` | 写 | = replicateDataSourceFull |
| `getADSODDICLinks` | 读 | = getADSODDICLinks |
| `getADSODDICTableName` | 读 | = getADSODDICTableName |
| `getDDICTableMetadata` | 读 | = getDDICTableMetadata |
| `getADSOTables` | 读 | = getADSOTables |
| `getDDICTableInfo` | 读 | = getDDICTableInfo |
| `getDDICTableFields` | 读 | = getDDICTableFields |
| `getDDICTableDataMetadata` | 读 | = getDDICTableDataMetadata |
| `getDDICTableData` | 读 | = getDDICTableData |
| `getTableDataViaSQL` | 读 | = getTableDataViaSQL |
| `getReportingInitialView` | 读 | = getReportingInitialView |
| `updateReportingView` | 读 | = updateReportingView |
| `queryProviderPreview` | 读 | = queryProviderPreview |
| `getProcessChain` | 读 | = getProcessChain |
| `getProcessChainDetails` | 读 | = getProcessChainDetails |
| `getProcessChainVersions` | 读 | = getProcessChainVersions |
| `lockProcessChain` | 写 | = lockProcessChain |
| `unlockProcessChain` | 写 | = unlockProcessChain |
| `activateProcessChain` | 写 | = activateProcessChain |
| `checkProcessChain` | 读 | = checkProcessChain |
| `executeProcessChain` | 写 | = executeProcessChain |
| `stopProcessChain` | 写 | = stopProcessChain |
| `getProcessChainLogs` | 读 | = getProcessChainLogs |
| `getProcessChainStatus` | 读 | = getProcessChainStatus |
| `bwObject` | L | 工厂 |
| `validateObjectExists` | R | = validateObject |
| `validateNewObjectName` | R | = validateObject |
| `validateADSOExists` | 读 | = validateADSOExists |
| `validateADSONewName` | 读 | = validateADSONewName |
| `validateTransformationExists` | 读 | = validateTransformationExists |
| `validateTransformationNewName` | 读 | = validateTransformationNewName |
| `validateDTPExists` | 读 | = validateDTPExists |
| `validateInfoObjectExists` | 读 | = validateInfoObjectExists |
| `validateInfoObjectNewName` | 读 | = validateInfoObjectNewName |

（属性访问器 `client.adso`/`client.trfn`/… 共 11 个，返回对应域门面，不计入方法表。）

