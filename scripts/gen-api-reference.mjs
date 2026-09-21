#!/usr/bin/env node
/**
 * gen-api-reference.mjs — 从源码机械生成 docs/API_REFERENCE.md（唯一事实源 = 代码）。
 *
 * 机制：
 *  1. 扫描 src/api/*.ts、src/domains/*.ts、src/BWAdtClient.ts 提取全部导出函数/方法；
 *  2. 与本文件内的手工分类表（读 R / 写 W / 本地纯函数 L，含端点与说明）做**集合断言**——
 *     代码里有而表里没有（或反之）即报错退出，保证文档与代码 100% 一致；
 *  3. 可选 --results <file>（JSON："<module>.<fn>" -> "✅/⚠️/❌ 说明"）把读 API 验证
 *     结果写进状态列。
 *
 * 运行：node scripts/gen-api-reference.mjs [--results .local/verify-results.json]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

// ---------------------------------------------------------------------------
// 1. 代码事实提取
// ---------------------------------------------------------------------------
const apiDir = resolve(root, "src/api")
const domDir = resolve(root, "src/domains")
const inv = { api: {}, domains: {}, client: [] }

for (const f of readdirSync(apiDir).filter((x) => x.endsWith(".ts"))) {
  const src = readFileSync(resolve(apiDir, f), "utf8")
  const fns = []
  const re = /export\s+(?:async\s+)?function\s+(\w+)/g
  let m
  while ((m = re.exec(src))) fns.push(m[1])
  if (fns.length) inv.api[f] = fns
}
for (const f of readdirSync(domDir).filter((x) => x.endsWith(".ts"))) {
  const src = readFileSync(resolve(domDir, f), "utf8")
  const cls = src.match(/export class (\w+)/)
  const methods = []
  const re = /^\s{2}(?:async\s+)?(\w+)\s*(?:<[^>]*>)?\(/gm
  let m
  while ((m = re.exec(src))) if (m[1] !== "constructor") methods.push(m[1])
  if (cls) inv.domains[cls[1]] = methods
}
{
  const client = readFileSync(resolve(root, "src/BWAdtClient.ts"), "utf8")
  const re = /^\s{2}public\s+(?:async\s+)?(?:readonly\s+)?(\w+)/gm
  let m
  while ((m = re.exec(client))) inv.client.push(m[1])
}

// ---------------------------------------------------------------------------
// 2. 手工分类表（R=读/非变更, W=写/会话, L=本地纯函数）
//    断言：每个模块的条目集合 === 代码导出集合
// ---------------------------------------------------------------------------
const T = {
  "common.ts": [
    ["activateObject", "W", "POST /sap/bw/modeling/activation", "激活对象（checkProperties feed）"],
    ["checkObject", "R", "POST /sap/bw/modeling/checkruns", "一致性检查（不激活；注意与激活端点不同）"],
    ["validateObject", "R", "POST /sap/bw/modeling/validation", "对象验证（exists/new/delete/activate）"],
    ["parseActivationResponse", "L", "—", "解析激活/检查 ATOM 响应"],
    ["parseLockResponse", "L", "—", "解析 lock 响应（lockHandle/corrNr/isLocal）"],
    ["parseObjectVersions", "L", "—", "解析版本 ATOM feed"],
    ["isServerErrorException", "L", "—", "判定 5xx 类异常"],
    ["withFreshSessionOnServerError", "W", "会话恢复", "5xx 时 dropSession+重登并重试一次（仅限 lock 入口）"],
  ],
  "bwObject.ts": [
    ["createBWObject", "L", "—", "BWObject 泛型实例工厂（lock/unlock/check/versions/create/update/delete）"],
  ],
  "adso.ts": [
    ["validateObject", "R", "POST /sap/bw/modeling/validation", "对象验证（通用，ADSO 域内副本）"],
    ["validateInfoArea", "R", "POST /sap/bw/modeling/validation", "InfoArea 存在性"],
    ["validateTemplateADSO", "R", "POST /sap/bw/modeling/validation", "模板 ADSO 存在性"],
    ["templateValidationObjectType", "L", "—", "tlogo → validation objectType 映射"],
    ["validateNewADSOName", "R", "POST /sap/bw/modeling/validation", "新名称可用性"],
    ["getADSO", "R", "GET /sap/bw/modeling/adso/{id}/m", "ADSO 完整解析树"],
    ["getADSODetails", "R", "GET /sap/bw/modeling/adso/{id}/m", "ADSO 元数据（解析后）"],
    ["getADSOXml", "R", "GET /sap/bw/modeling/adso/{id}/m", "ADSO 原始 XML"],
    ["getADSOVersions", "R", "GET /sap/bw/modeling/adso/{id}/versions", "版本历史"],
    ["getADSOConfiguration", "R", "GET /sap/bw/modeling/adso/{id}/configuration", "配置信息"],
    ["getADSOTables", "R", "GET /sap/bw/modeling/adso/{id}/{version}", "关联表名（AT/AQ/CL）"],
    ["getADSONodePath", "R", "GET /sap/bw/modeling/repo/nodepath", "仓库节点路径"],
    ["checkADSO", "R", "POST /sap/bw/modeling/checkruns", "一致性检查"],
    ["validateADSOExists", "R", "POST /sap/bw/modeling/validation", "存在性"],
    ["validateADSONewName", "R", "POST /sap/bw/modeling/validation", "新名称可用性"],
    ["createADSO", "W", "POST /sap/bw/modeling/adso/{name}?lockHandle", "创建（需先 lock）"],
    ["createADSOFull", "W", "验证→lock→创建→(激活)→unlock", "创建编排（门面入口）"],
    ["lockADSO", "W", "POST /adso/{id}?action=lock", "锁定（stateful）"],
    ["unlockADSO", "W", "POST /adso/{id}?action=unlock", "解锁（stateful）"],
    ["activateADSO", "W", "POST /sap/bw/modeling/activation", "激活"],
    ["updateADSO", "W", "PUT /sap/bw/modeling/adso/{id}/m", "保存 XML（stateless）"],
    ["saveAndActivateADSO", "W", "lock→transport→PUT→activate→unlock", "保存并激活编排"],
    ["addADSOKey", "W", "getXml→addADSOKeyToXml→saveAndActivate", "加键编排（默认不激活）"],
    ["buildADSOFieldElementXml", "L", "—", "本地字段元素 XML（infoObjectName 时分派引用分支）"],
    ["buildADSOInfoObjectElementXml", "L", "—", "IOBJ 引用字段元素 XML（最小形态）"],
    ["addADSOFieldToXml", "L", "—", "插入字段（无键 fail-fast）"],
    ["addADSOKeyToXml", "L", "—", "插入键定义（keyElement+引用元素，幂等）"],
    ["removeADSOFieldFromXml", "L", "—", "移除字段元素"],
    ["extractADSOTimestamp", "L", "—", "提取 changedAt → timestamp 头"],
  ],
  "transformation.ts": [
    ["getTransformation", "R", "GET /sap/bw/modeling/trfn/{id}/{version}", "TRFN 解析树"],
    ["getTransformationDetails", "R", "GET /sap/bw/modeling/trfn/{id}/{version}", "TRFN 元数据"],
    ["getTransformationXml", "R", "GET /sap/bw/modeling/trfn/{id}/{version}", "TRFN 原始 XML"],
    ["getTransformationVersions", "R", "GET /sap/bw/modeling/trfn/{id}/versions", "版本历史"],
    ["checkTransformation", "R", "POST /sap/bw/modeling/checkruns", "一致性检查"],
    ["validateTransformationExists", "R", "POST /sap/bw/modeling/validation", "存在性"],
    ["validateTransformationNewName", "R", "POST /sap/bw/modeling/validation", "新名称可用性"],
    ["lockTransformation", "W", "POST /trfn/{id}?action=lock", "锁定（stateful）"],
    ["unlockTransformation", "W", "POST /trfn/{id}?action=unlock", "解锁"],
    ["updateTransformation", "W", "PUT /sap/bw/modeling/trfn/{id}/m", "保存 XML"],
    ["activateTransformation", "W", "POST /sap/bw/modeling/activation", "激活"],
    ["saveAndActivateTransformation", "W", "lock→transport→PUT→activate→unlock", "保存并激活编排"],
    ["createTransformation", "W", "GET 8TRANSIENT→CREA lock→POST→unlock", "8TRANSIENT 瞬态流创建"],
    ["parseTransformationSettings", "L", "—", "解析 settings/例程步骤规则"],
    ["extractTransformationTimestamp", "L", "—", "提取 changedAt"],
    ["extractAbapClassName", "L", "—", "从解析树提取例程 ABAP 类名（含回退）"],
    ["extractRoutineMethodName", "L", "—", "提取例程方法名"],
    ["isEndRoutineFieldSelected", "L", "—", "END 例程字段选中判定"],
    ["addFieldToEndRoutine", "L", "—", "END 例程加字段（XML）"],
    ["removeFieldFromEndRoutine", "L", "—", "END 例程去字段（XML）"],
    ["hasStartRoutine", "L", "—", "START 例程存在判定"],
    ["hasEndRoutine", "L", "—", "END 例程存在判定"],
    ["hasExpertRoutine", "L", "—", "EXPERT 例程存在判定"],
    ["addTransformationRule", "L", "—", "规则 XML 构建（定向/常量/初选等）"],
    ["addRule", "L", "—", "通用规则入口（DIRECT/CONSTANT/INITIAL/FORMULA/NO_UPDATE）"],
    ["autoMapTransformationFields", "L", "—", "同名字段自动映射（XML）"],
    ["switchTransformationRuntime", "L", "—", "翻转 HANARuntime 根属性（XML）"],
  ],
  "dtp.ts": [
    ["getDTP", "R", "GET /sap/bw/modeling/dtpa/{id}/m", "DTP 解析树"],
    ["getDTPXml", "R", "GET /sap/bw/modeling/dtpa/{id}/m", "DTP 原始 XML"],
    ["getDTPDetails", "R", "GET /sap/bw/modeling/dtpa/{id}/m", "DTP 元数据（source/target/tlogo）"],
    ["getDTPVersions", "R", "GET /sap/bw/modeling/dtpa/{id}/versions", "版本历史"],
    ["checkDTP", "R", "POST /sap/bw/modeling/checkruns", "一致性检查"],
    ["validateDTPExists", "R", "POST /sap/bw/modeling/validation", "存在性"],
    ["lockDTP", "W", "POST /dtpa/{id}?action=lock", "锁定"],
    ["unlockDTP", "W", "POST /dtpa/{id}?action=unlock", "解锁"],
    ["activateDTP", "W", "POST /sap/bw/modeling/activation", "激活"],
    ["updateDTP", "W", "PUT /sap/bw/modeling/dtpa/{id}/m", "保存 XML"],
    ["executeDTP", "W", "POST /dtpa/{id}?action=execute", "运维执行（批量运行）"],
    ["createDTP", "W", "POST /sap/bw/modeling/dtpa/{id}?lockHandle", "CREA lock→collection POST 创建"],
    ["saveAndActivateDTP", "W", "lock→transport→PUT→activate→unlock", "保存并激活编排"],
    ["generateDtpId", "L", "—", "生成 DTP_<26 位> 技术名"],
  ],
  "datasource.ts": [
    ["getDataSource", "R", "GET /sap/bw/modeling/rsds/{ds}/{sys}/m", "RSDS 解析树（版本在 atom:id）"],
    ["getDataSourceXml", "R", "GET /sap/bw/modeling/rsds/{ds}/{sys}/m", "RSDS 原始 XML"],
    ["getDataSourceDetails", "R", "GET /sap/bw/modeling/rsds/{ds}/{sys}/m", "RSDS 元数据"],
    ["getDataSourceFields", "R", "GET /sap/bw/modeling/rsds/{ds}/{sys}/m", "字段列表"],
    ["getDataSourceVersions", "R", "GET /sap/bw/modeling/rsds/{ds}/{sys}/versions", "版本历史"],
    ["lockDataSource", "W", "POST /rsds/{ds}/{sys}?action=lock", "锁定（含 5xx 会话恢复）"],
    ["unlockDataSource", "W", "POST /rsds/{ds}/{sys}?action=unlock", "解锁"],
    ["updateDataSource", "W", "PUT /sap/bw/modeling/rsds/{ds}/{sys}/m", "保存 XML"],
    ["activateDataSource", "W", "POST /sap/bw/modeling/activation", "激活"],
    ["mergeDataSourceProposal", "W", "POST /rsds/{ds}/{sys}/proposals", "适配器变更后字段合并建议"],
    ["saveAndActivateDataSource", "W", "lock→transport→PUT→activate→unlock", "保存并激活编排"],
    ["parseDataSourceDetails", "L", "—", "解析 RSDS 元数据"],
    ["parseDataSourceFields", "L", "—", "解析字段列表"],
    ["parseDataSourceVersions", "L", "—", "解析版本 feed"],
    ["extractDataSourceTimestamp", "L", "—", "提取 changedAt"],
  ],
  "replication.ts": [
    ["getReplicationInfo", "R", "GET /sap/bw/modeling/lsysint/replication", "源系统复制信息"],
    ["replicateDataSource", "W", "POST /lsysint/replication", "触发复制"],
    ["replicateDataSourceFull", "W", "POST /lsysint/replication", "全量复制"],
    ["buildReplicationRequestBody", "L", "—", "复制请求体构建"],
    ["parseReplicationTasks", "L", "—", "解析复制任务"],
    ["parseReplicationResult", "L", "—", "解析复制结果"],
  ],
  "ddic.ts": [
    ["getADSODDICLinks", "R", "GET /sap/bw/modeling/adso/{id}/m", "Link 头解析（ddicTableLink 是模板占位符）"],
    ["getADSODDICTableName", "R", "GET /sap/bw/modeling/adso/{id}/{version}", "真实表名（XML tables 段）"],
    ["getDDICTableMetadata", "R", "GET /sap/bc/adt/ddic/tables/{t}", "表元数据（blueSource）"],
    ["getDDICTableInfo", "R", "GET /sap/bc/adt/ddic/tables/{t}/source/main", "表定义（DDL 源解析）"],
    ["getDDICTableFields", "R", "GET /sap/bc/adt/ddic/tables/{t}/source/main", "字段列表"],
    ["getDDICTableDataMetadata", "R", "GET /sap/bc/adt/datapreview/ddic/{t}/metadata", "数据预览列元数据"],
    ["getDDICTableData", "R", "POST /sap/bc/adt/datapreview/ddic", "数据预览（SELECT，非变更）"],
    ["getTableDataViaSQL", "R", "POST /sap/bc/adt/datapreview/freestyle", "Freestyle OpenSQL 查询"],
    ["parseLinkHeader", "L", "—", "Link 头解析"],
    ["extractTableNameFromUrl", "L", "—", "从 DDIC URL 提表名"],
  ],
  "search.ts": [
    ["searchBWObjects", "R", "GET /sap/bw/modeling/repo/is/bwsearch", "BW 对象搜索（名称/描述/类型过滤）"],
    ["quickSearch", "R", "GET /sap/bw/modeling/repo/is/bwsearch", "按名快速搜索"],
    ["searchByObjectType", "R", "GET /sap/bw/modeling/repo/is/bwsearch", "按类型搜索"],
    ["getTransformationsOf", "R", "GET /sap/bw/modeling/repo/is/bwsearch", "InfoProvider 关联 TRFN"],
    ["getDTPsOf", "R", "GET /sap/bw/modeling/repo/is/bwsearch", "InfoProvider 关联 DTP"],
  ],
  "dataflow.ts": [
    ["getDataflow", "R", "GET /sap/bw/modeling/dmod/8TRANSIENT", "DMOD 数据流（上/下游）"],
    ["getDataflowLineage", "R", "GET /sap/bw/modeling/dmod/8TRANSIENT", "血缘（upstream/downstream/both）"],
  ],
  "infoobject.ts": [
    ["getInfoObject", "R", "GET /sap/bw/modeling/iobj/{n}/a", "InfoObject 详情（modified 版本）"],
    ["getInfoObjectMetadata", "R", "GET /sap/bw/modeling/iobj/{n}/m", "InfoObject 元数据（active）"],
    ["validateInfoObjectExists", "R", "POST /sap/bw/modeling/validation", "存在性"],
    ["validateInfoObjectNewName", "R", "POST /sap/bw/modeling/validation", "新名称可用性"],
    ["parseInfoObjectDetails", "L", "—", "解析 InfoObject 详情"],
  ],
  "repository.ts": [
    ["getInfoproviderStructure", "R", "GET /sap/bw/modeling/repo/infoproviderstructure/area/{area}/{type}", "InfoArea 查询树（2026-09-21 真机验证）"],
    ["parseInfoproviderStructure", "L", "—", "解析结构 feed"],
    ["infoObjects", "R", "GET /sap/bc/adt/bw/objects/infoobject", "InfoObject 目录查询"],
    ["infoObjectDetails", "R", "GET /sap/bc/adt/bw/objects/infoobject", "InfoObject 目录详情"],
    ["infoObjectCatalogs", "R", "GET /sap/bc/adt/bw/objects/infocatalog", "InfoObject 目录列表"],
  ],
  "systemInfo.ts": [
    ["systemInfo", "R", "GET /sap/bw/modeling/repo/is/systeminfo", "系统信息（properties[]）"],
    ["getSystemProperty", "R", "GET /sap/bw/modeling/repo/is/systeminfo", "读取单个系统属性"],
    ["hasCapability", "R", "GET /sap/bw/modeling/repo/is/systeminfo", "能力判定"],
  ],
  "processchain.ts": [
    ["getProcessChain", "R", "GET /sap/bw/modeling/rspc/{id}/m", "链元数据（JSON，已实测）"],
    ["getProcessChainDetails", "R", "GET /sap/bw/modeling/rspc/{id}/m", "链详情（JSON，已实测）"],
    ["getProcessChainVersions", "R", "GET /sap/bw/modeling/rspc/{id}/versions", "⚠️ 本系统不支持（对象版本 V）"],
    ["getProcessChainLogs", "R", "GET /sap/bw/modeling/rspc/{id}/logs", "⚠️ 本系统不支持（对象版本 L）"],
    ["getProcessChainStatus", "R", "GET /sap/bw/modeling/rspc/{id}/status", "⚠️ 本系统不支持（对象版本 S）"],
    ["checkProcessChain", "R", "POST /sap/bw/modeling/checkruns", "一致性检查（⚠️ 未实测）"],
    ["lockProcessChain", "W", "POST /rspc/{id}?action=lock", "锁定（⚠️ 未实测）"],
    ["unlockProcessChain", "W", "POST /rspc/{id}?action=unlock", "解锁（⚠️ 未实测）"],
    ["activateProcessChain", "W", "POST /sap/bw/modeling/activation", "激活（⚠️ 未实测）"],
    ["executeProcessChain", "W", "POST /rspc/{id}?action=execute", "执行（⚠️ 未实测）"],
    ["stopProcessChain", "W", "POST /rspc/{id}?action=stop", "停止（⚠️ 未实测）"],
    ["parseProcessChainMetaData", "L", "—", "解析 rspc JSON 元数据"],
    ["parseProcessChainDetails", "L", "—", "解析 rspc JSON 详情"],
  ],
  "transport.ts": [
    ["transportCheck", "R", "POST /sap/bc/adt/cts/transportchecks", "录制检查（非变更探针）"],
    ["createTransport", "W", "POST /sap/bc/adt/cts/transports", "新建工作台请求"],
    ["resolveTransportForWrite", "W", "check→(create)→TR", "写前 TR 解析编排"],
    ["isTransportRequiredError", "L", "—", "TransportRequiredError 判定"],
  ],
  "abapClass.ts": [
    ["getAbapClassMetadata", "R", "GET /sap/bc/adt/oo/classes/{n}", "类元数据"],
    ["getAbapClassSource", "R", "GET /sap/bc/adt/oo/classes/{n}/source/main", "类源码（例程读）"],
    ["getAbapClassObjectStructure", "R", "GET /sap/bc/adt/oo/classes/{n}", "类结构"],
    ["lockAbapClass", "W", "POST /oo/classes/{n}?_action=LOCK", "类锁定"],
    ["unlockAbapClass", "W", "POST /oo/classes/{n}?_action=UNLOCK", "类解锁"],
    ["updateAbapClassSource", "W", "PUT /oo/classes/{n}/source/main", "保存类源码"],
    ["activateAbapClass", "W", "POST /sap/bc/adt/activation", "类激活（非 BW modeling）"],
    ["saveAndActivateAbapClassSource", "W", "lock→PUT→activate→unlock", "类源码保存编排"],
  ],
  "reporting.ts": [
    ["queryProviderPreview", "R", "POST /sap/bw/modeling/comp/reporting", "BICS 提供者预览（会话状态）"],
    ["getReportingInitialView", "R", "POST /sap/bw/modeling/comp/reporting", "BICS 初始视图（会话状态）"],
    ["updateReportingView", "R", "POST /sap/bw/modeling/comp/reporting", "BICS 视图增量更新（仅会话状态，非持久）"],
    ["toReportingCompId", "L", "—", "对象名 → BICS comp id"],
    ["buildQuerySelectorXml", "L", "—", "query selector XML 构建"],
    ["remapReportingState", "L", "—", "视图状态 id 重映射"],
    ["flattenReportingResultSet", "L", "—", "结果集扁平化"],
    ["parseQueryView", "L", "—", "视图响应解析"],
  ],
}

const MODULE_FACADES = {
  adso: "AdsoDomain",
  transformation: "TrfnDomain",
  dtp: "DtpDomain",
  datasource: "DataSourceDomain",
  replication: "DataSourceDomain",
  ddic: "DdicDomain",
  infoobject: "InfoObjectDomain",
  processchain: "ProcessChainDomain",
  search: "RepositoryDomain",
  dataflow: "RepositoryDomain",
  reporting: "QueryDomain",
  repository: "RepositoryDomain",
  systemInfo: "SystemDomain",
  transport: "TransportDomain",
}

// 门面方法 → api 函数（类继承目标的 R/W/L）
const FACADE_TARGETS = {
  AdsoDomain: { details: "getADSODetails", xml: "getADSOXml", versions: "getADSOVersions", check: "checkADSO", saveAndActivate: "saveAndActivateADSO", addField: "@addADSOFieldToXml 编排", addKey: "addADSOKey", create: "createADSOFull", validateInfoArea: "validateInfoArea", validateTemplate: "validateTemplateADSO", validateNewName: "validateNewADSOName", getRaw: "getADSO" },
  TrfnDomain: { details: "getTransformationDetails", xml: "getTransformationXml", versions: "getTransformationVersions", check: "checkTransformation", saveAndActivate: "saveAndActivateTransformation", create: "createTransformation", setEndRoutineFields: "@addFieldToEndRoutine 编排", switchRuntime: "switchTransformationRuntime" },
  DtpDomain: { details: "getDTPDetails", xml: "getDTPXml", versions: "getDTPVersions", check: "checkDTP", activate: "activateDTP", saveAndActivate: "saveAndActivateDTP", execute: "executeDTP" },
  DataSourceDomain: { details: "getDataSourceDetails", fields: "getDataSourceFields", xml: "getDataSourceXml", versions: "getDataSourceVersions", saveAndActivate: "saveAndActivateDataSource", mergeProposal: "mergeDataSourceProposal", replicationInfo: "getReplicationInfo", replicate: "replicateDataSource", replicateFull: "replicateDataSourceFull" },
  DdicDomain: { describe: "getDDICTableInfo", getData: "getDDICTableData", querySql: "getTableDataViaSQL", adsoDdicLinks: "getADSODDICLinks", adsoDdicTableName: "getADSODDICTableName" },
  InfoObjectDomain: { get: "getInfoObject", validateExists: "validateInfoObjectExists", validateNewName: "validateInfoObjectNewName" },
  ProcessChainDomain: { details: "getProcessChainDetails", check: "checkProcessChain", execute: "executeProcessChain", stop: "stopProcessChain", logs: "@getProcessChainLogs+Status" },
  QueryDomain: { initialView: "getReportingInitialView", updateView: "updateReportingView", preview: "queryProviderPreview" },
  RepositoryDomain: { infoproviderStructure: "getInfoproviderStructure", search: "searchBWObjects", transformationsOf: "getTransformationsOf", dtpsOf: "getDTPsOf", dataflow: "getDataflow", lineage: "getDataflowLineage" },
  SystemDomain: { info: "systemInfo", getProperty: "getSystemProperty", hasCapability: "hasCapability" },
  TransportDomain: { check: "transportCheck", create: "createTransport" },
}

// BWAdtClient 方法例外映射（其余按同名匹配 api 函数）
const CLIENT_EXCEPTIONS = {
  login: ["W", "会话", "登录（建立 stateful 会话）"],
  logout: ["W", "会话", "登出"],
  dropSession: ["W", "会话", "销毁服务端会话"],
  getInfoproviderStructure: ["R", "= getInfoproviderStructure", "InfoArea 查询树"],
  reentranceTicket: ["W", "会话", "SAP 重入票证"],
  systemInfo: ["R", "GET systeminfo", "系统信息"],
  getADSOTransformations: ["R", "= getTransformationsOf", "ADSO 关联 TRFN"],
  getADSODataTransferProcesses: ["R", "= getDTPsOf", "ADSO 关联 DTP"],
  createObject: ["W", "BWObject.create", "泛型对象创建"],
  updateObject: ["W", "BWObject.update", "泛型对象更新"],
  deleteObject: ["W", "BWObject.delete", "泛型对象删除"],
  getObject: ["L", "工厂", "BWObject 实例"],
  bwObject: ["L", "工厂", "BWObject 实例"],
  validateObjectExists: ["R", "= validateObject", "泛型存在性"],
  validateNewObjectName: ["R", "= validateObject", "泛型新名称"],
  activateObject: ["W", "POST activation", "泛型激活"],
  activateDTPWithLock: ["W", "= activateDTP", "DTP 激活（外部锁）"],
  addADSOField: ["W", "getXml→addFieldToXml→saveAndActivate", "ADSO 加字段编排"],
  addTransformationRulesAndSave: ["W", "addRule+saveAndActivate", "加规则并保存"],
  autoMapTransformationFieldsAndSave: ["W", "autoMap+saveAndActivate", "自动映射并保存"],
  switchRuntimeAndSave: ["W", "switchRuntime+saveAndActivate", "切运行时并保存"],
  setEndRoutineFields: ["W", "addFieldToEndRoutine+save", "END 例程加字段"],
  getTransformationClass: ["R", "= getAbapClassMetadata", "例程类元数据"],
  getTransformationClassSource: ["R", "= getAbapClassSource", "例程类源码"],
  lockTransformationClass: ["W", "= lockAbapClass", "例程类锁定"],
  unlockTransformationClass: ["W", "= unlockAbapClass", "例程类解锁"],
  updateTransformationClassSource: ["W", "= updateAbapClassSource", "例程类源码保存"],
  saveAndActivateTransformationClassSource: ["W", "= saveAndActivateAbapClassSource", "例程类源码保存激活"],
}

// ---------------------------------------------------------------------------
// 3. 断言：分类表 ⊇ 代码导出（100% 覆盖），并报告双向差异
// ---------------------------------------------------------------------------
let failed = false
const clsOf = {} // "file.fn" -> [cls, endpoint, desc]
for (const [file, entries] of Object.entries(T)) {
  const exported = inv.api[file] || []
  const tabled = entries.map((e) => e[0])
  const missing = exported.filter((f) => !tabled.includes(f))
  const extra = tabled.filter((f) => !exported.includes(f))
  const dup = tabled.filter((f, i) => tabled.indexOf(f) !== i)
  if (missing.length || extra.length || dup.length) {
    failed = true
    console.error(`[FAIL] ${file}: 代码多出 [${missing}] 表多出 [${extra}] 重复 [${dup}]`)
  }
  for (const [n, c, e, d] of entries) clsOf[`${file}:${n}`] = [c, e, d]
}
if (failed) process.exit(1)

// ---------------------------------------------------------------------------
// 4. 渲染
// ---------------------------------------------------------------------------
const resultsFile = process.argv.includes("--results")
  ? process.argv[process.argv.indexOf("--results") + 1]
  : undefined
const results = resultsFile && existsSync(resultsFile)
  ? JSON.parse(readFileSync(resultsFile, "utf8"))
  : {}

const CLS = { R: "读", W: "写", L: "本地" }
const apiCount = Object.values(inv.api).reduce((a, b) => a + b.length, 0)
const allEntries = Object.entries(T).flatMap(([f, es]) => es.map((e) => [f, ...e]))
const nR = allEntries.filter((e) => e[2] === "R").length
const nW = allEntries.filter((e) => e[2] === "W").length
const nL = allEntries.filter((e) => e[2] === "L").length

const out = []
out.push(`# BW-ADT-API 完整 API 参考（代码生成）

> 本文件由 \`scripts/gen-api-reference.mjs\` 从源码机械生成，生成器对"分类表 vs 代码导出"做集合断言，保证与代码 100% 一致。
> 重新生成：\`node scripts/gen-api-reference.mjs [--results .local/verify-results.json]\`。最后生成：2026-09-20。

## 分类

| 类 | 含义 | 数量 |
|---|---|---|
| **读 (R)** | 非变更：GET、搜索、validation/checkruns 探针、数据预览、BICS 会话分析 | ${nR} |
| **写 (W)** | 变更或建立会话：lock/unlock、create/update/delete/activate、编排、执行、TR 创建 | ${nW} |
| **本地 (L)** | 纯函数：XML/解析/工厂辅助，无服务器 I/O | ${nL} |

读 API 的真机验证状态见状态列（✅/⚠️/❌）与 [VERIFIED_APIS.md](./VERIFIED_APIS.md)。

> 2026-09-20：依据读验证 V1 结论（validation 端点拒绝 delete/activate action、PC/DTPA 不支持 new/exists），
> 13 个 \`validate*CanDelete/CanActivate/validateProcessChain*/validateDTPNewName\` 函数已从 API 面移除，
> \`ValidationAction\` 仅存 EXISTS/NEW。详见 VERIFIED_APIS 第 7 节。

## 总览

| 模块 | api 函数 | 门面 |
|---|---|---|
${Object.keys(inv.api).map((f) => `| ${f.replace(".ts", "")} | ${inv.api[f].length} | ${MODULE_FACADES[f.replace(".ts", "")] || "—"} |`).join("\n")}
`)

// per-module sections
const sectionTitles = {
  "common.ts": "通用（激活/检查/验证/会话恢复）",
  "bwObject.ts": "通用 BW 对象基类",
  "adso.ts": "ADSO（Advanced DataStore Object）",
  "transformation.ts": "TRFN（Transformation）",
  "dtp.ts": "DTP（Data Transfer Process）",
  "datasource.ts": "RSDS（DataSource）",
  "replication.ts": "复制（Replication）",
  "ddic.ts": "DDIC 表与数据预览",
  "search.ts": "搜索与关联",
  "dataflow.ts": "数据流与血缘（DMOD）",
  "infoobject.ts": "InfoObject",
  "repository.ts": "仓库目录（InfoObject Catalog）",
  "systemInfo.ts": "系统信息",
  "processchain.ts": "Process Chain（rspc JSON）",
  "transport.ts": "CTS 传输",
  "abapClass.ts": "ABAP 类（例程运行时类）",
  "reporting.ts": "BICS Reporting",
}
out.push(`\n## API 层（src/api/*.ts，${apiCount} 个导出函数）\n`)
for (const [file, entries] of Object.entries(T)) {
  out.push(`\n### ${sectionTitles[file] || file}（\`${file}\`）\n`)
  out.push("| 函数 | 类 | 端点/说明 | 读验证状态 |")
  out.push("|---|---|---|---|")
  for (const [n, c, e, d] of entries) {
    if (c === "R") {
      const key = `${file.replace(".ts", "")}.${n}`
      const st = results[key] || "待验证"
      out.push(`| \`${n}\` | 读 | ${e} — ${d} | ${st} |`)
    } else {
      const info = e === "—" ? d : `${e} — ${d}`
      out.push(`| \`${n}\` | ${CLS[c]} | ${info} | — |`)
    }
  }
}

// facades
out.push(`\n## 域门面（src/domains/*.ts，${Object.values(inv.domains).reduce((a, b) => a + b.length, 0)} 个方法）\n`)
out.push("> 门面是对 api 层的薄转发；类（读/写/本地）继承目标函数。\n")
for (const [cls, methods] of Object.entries(inv.domains)) {
  const targets = FACADE_TARGETS[cls] || {}
  out.push(`\n### ${cls}\n`)
  out.push("| 方法 | 类 | 目标 |")
  out.push("|---|---|---|")
  for (const m of methods) {
    const t = targets[m]
    if (!t) {
      out.push(`| \`${m}\` | ? | （生成器缺映射） |`)
      continue
    }
    const inline = t.startsWith("@")
    const apiFn = inline ? null : t
    let c = "?"
    if (apiFn) {
      for (const [f, es] of Object.entries(T)) {
        const hit = es.find((e) => e[0] === apiFn)
        if (hit) { c = CLS[hit[1]]; break }
      }
    } else {
      c = t.includes("addKey") || t.includes("编排") || t.includes("save") ? "写" : "读"
    }
    out.push(`| \`${m}\` | ${c} | → ${t} |`)
  }
}

// client
out.push("\n## BWAdtClient（src/BWAdtClient.ts）\n")
out.push("> 每个公共方法动态导入对应 api 函数转发；下表「同名转发」指方法名 = api 函数名。域门面经 `client.<domain>` 访问（如 `client.adso.details`）。\n")
const nameToModule = {}
for (const [file, entries] of Object.entries(T)) {
  for (const [n] of entries) nameToModule[n] = file.replace(".ts", "")
}
const clientRows = []
const unmatched = []
const seen = new Set()
for (const m of inv.client) {
  if (m === "get" || m === "set") continue // 属性访问器（client.adso 等）
  if (seen.has(m)) continue
  seen.add(m)
  if (CLIENT_EXCEPTIONS[m]) {
    clientRows.push([m, ...CLIENT_EXCEPTIONS[m]])
  } else if (nameToModule[m]) {
    const file = nameToModule[m] + ".ts"
    const entry = T[file].find((e) => e[0] === m)
    clientRows.push([m, CLS[entry[1]], `= ${m}`])
  } else {
    unmatched.push(m)
  }
}
if (unmatched.length) {
  console.error("[FAIL] client 方法未覆盖:", unmatched.join(", "))
  process.exit(1)
}
out.push("| 方法 | 类 | 目标 |")
out.push("|---|---|---|")
for (const [m, c, t] of clientRows) out.push(`| \`${m}\` | ${c} | ${t} |`)
out.push(`\n（属性访问器 \`client.adso\`/\`client.trfn\`/… 共 ${Object.keys(inv.domains).length} 个，返回对应域门面，不计入方法表。）\n`)

writeFileSync(resolve(root, "docs/API_REFERENCE.md"), out.join("\n") + "\n")
console.log(`OK: docs/API_REFERENCE.md 生成完毕（api ${apiCount}，门面 ${Object.values(inv.domains).reduce((a, b) => a + b.length, 0)}，client ${clientRows.length}；读 ${nR} / 写 ${nW} / 本地 ${nL}）`)
