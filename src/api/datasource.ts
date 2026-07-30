import { fullParse, xmlNodeAttr, xmlArray, xmlNode, orUndefined } from "../utilities"
import { AdtHTTP, session_types } from "../AdtHTTP"
import { ActivationResult, LockResult, parseLockResponse, parseActivationResponse } from "./common"
import { DataSourceDetails, DataSourceField, DataSourceVersion } from "./types"

// ============================================================================
// Constants
// ============================================================================

/**
 * RSDS Content-Type (实测, 2026-07-16 Eclipse Communication Log 响应头)
 */
export const RSDS_CONTENT_TYPE = "application/vnd.sap.bw.modeling.rsds-v1_1_0+xml"

/**
 * RSDS Accept 头 — 同时声明两个版本 (实测 Eclipse 请求头)
 */
export const RSDS_ACCEPT =
  "application/vnd.sap.bw.modeling.rsds-v1_0_0+xml, application/vnd.sap.bw.modeling.rsds-v1_1_0+xml"

/** 端点基础路径 */
const RSDS_ENDPOINT = "/sap/bw/modeling/rsds"

/**
 * 构造 RSDS 双段标识的 base URI (不含版本后缀)
 *
 * RSDS 与 ADSO/DTP 不同:URL 同时带 datasource 名和 sourceSystem 名。
 *   GET /sap/bw/modeling/rsds/{datasource}/{sourceSystem}/m
 * 大小写不敏感 (Eclipse 日志中 lock 用小写、GET 用大写均返回 200), 统一转小写。
 */
function rsdsBase(datasource: string, sourceSystem: string): string {
  return `${RSDS_ENDPOINT}/${datasource.toLowerCase()}/${sourceSystem.toLowerCase()}`
}

// ============================================================================
// Read Functions
// ============================================================================

/**
 * Get DataSource (raw) - 获取 DataSource 原始元数据 (fullParse 后的对象)
 *
 * 对应请求: GET /sap/bw/modeling/rsds/{datasource}/{sourceSystem}/m[?forceCacheUpdate=true]
 *
 * @param client - ADT HTTP 客户端
 * @param datasource - DataSource 技术名 (如 "ZBW_ZFIVTASK_STAGE_H")
 * @param sourceSystem - 源系统逻辑名 (如 "S4DCLNT300")
 * @param forceCacheUpdate - 是否强制更新缓存 (Eclipse 首次打开时为 true)
 * @returns fullParse 解析后的原始对象 (根节点 rsds:dataSource)
 */
export async function getDataSource(
  client: AdtHTTP,
  datasource: string,
  sourceSystem: string,
  forceCacheUpdate: boolean = false
): Promise<any> {
  const qs = forceCacheUpdate ? { forceCacheUpdate: "true" } : undefined

  const response = await client.request(`${rsdsBase(datasource, sourceSystem)}/m`, {
    method: "GET",
    qs,
    headers: {
      Accept: RSDS_ACCEPT
    }
  })

  return fullParse(response.body)
}

/**
 * Get DataSource XML (raw string) - 获取 DataSource 原始 XML 字符串
 *
 * 用于 PUT 写操作前读取当前内容 (与 getADSOXml / getTransformationXml 一致的模式)。
 *
 * @param client - ADT HTTP 客户端
 * @param datasource - DataSource 技术名
 * @param sourceSystem - 源系统逻辑名
 * @param forceCacheUpdate - 是否强制更新缓存
 * @returns 原始 XML 字符串
 */
export async function getDataSourceXml(
  client: AdtHTTP,
  datasource: string,
  sourceSystem: string,
  forceCacheUpdate: boolean = false
): Promise<string> {
  const qs = forceCacheUpdate ? { forceCacheUpdate: "true" } : undefined

  const response = await client.request(`${rsdsBase(datasource, sourceSystem)}/m`, {
    method: "GET",
    qs,
    headers: {
      Accept: RSDS_ACCEPT
    }
  })

  return response.body
}

/**
 * Get DataSource Details (parsed) - 获取解析后的 DataSource 详情
 *
 * @param client - ADT HTTP 客户端
 * @param datasource - DataSource 技术名
 * @param sourceSystem - 源系统逻辑名
 * @param forceCacheUpdate - 是否强制更新缓存
 * @returns 结构化的 DataSourceDetails
 */
export async function getDataSourceDetails(
  client: AdtHTTP,
  datasource: string,
  sourceSystem: string,
  forceCacheUpdate: boolean = false
): Promise<DataSourceDetails> {
  const raw = await getDataSource(client, datasource, sourceSystem, forceCacheUpdate)
  return parseDataSourceDetails(raw)
}

/**
 * Get DataSource Versions - 获取 DataSource 版本历史
 *
 * 对应请求: GET /sap/bw/modeling/rsds/{datasource}/{sourceSystem}/versions
 *
 * 注意:RSDS 版本字符在 <atom:id>A</atom:id> (非 uri 后缀), 故使用专用解析器。
 *
 * @param client - ADT HTTP 客户端
 * @param datasource - DataSource 技术名
 * @param sourceSystem - 源系统逻辑名
 * @returns 版本历史列表
 */
export async function getDataSourceVersions(
  client: AdtHTTP,
  datasource: string,
  sourceSystem: string
): Promise<DataSourceVersion[]> {
  const response = await client.request(
    `${rsdsBase(datasource, sourceSystem)}/versions`,
    {
      method: "GET",
      headers: {
        Accept: "application/atom+xml;type=feed"
      }
    }
  )
  return parseDataSourceVersions(response.body)
}

/**
 * Get DataSource Fields - 解析 DataSource 的字段列表
 *
 * 从 <segment>/<field> 节点提取字段, 便于程序化访问。
 *
 * @param client - ADT HTTP 客户端
 * @param datasource - DataSource 技术名
 * @param sourceSystem - 源系统逻辑名
 * @param forceCacheUpdate - 是否强制更新缓存
 * @returns 字段列表
 */
export async function getDataSourceFields(
  client: AdtHTTP,
  datasource: string,
  sourceSystem: string,
  forceCacheUpdate: boolean = false
): Promise<DataSourceField[]> {
  const raw = await getDataSource(client, datasource, sourceSystem, forceCacheUpdate)
  return parseDataSourceFields(raw)
}

// ============================================================================
// Write Functions (会话模型与 DTP/ADSO 一致)
// ============================================================================

/**
 * Lock DataSource - 锁定 DataSource
 *
 * 对应请求: POST /sap/bw/modeling/rsds/{datasource}/{sourceSystem}?action=lock
 * 会话: stateful (服务端通过 sap-contextid 保持持锁会话)
 *
 * @param client - ADT HTTP 客户端
 * @param datasource - DataSource 技术名
 * @param sourceSystem - 源系统逻辑名
 * @returns 锁定结果 (含 lockHandle)
 */
export async function lockDataSource(
  client: AdtHTTP,
  datasource: string,
  sourceSystem: string
): Promise<LockResult> {
  const response = await client.request(
    `${rsdsBase(datasource, sourceSystem)}?action=lock`,
    {
      method: "POST",
      sessionType: session_types.stateful,
      headers: {
        Accept: RSDS_ACCEPT
      }
    }
  )
  return parseLockResponse(response.body)
}

/**
 * Unlock DataSource - 解锁 DataSource
 *
 * 对应请求: POST /sap/bw/modeling/rsds/{datasource}/{sourceSystem}?action=unlock
 * 会话: stateful (回到持锁的 stateful 会话, AdtHTTP 自动携带 contextid)
 *
 * @param client - ADT HTTP 客户端
 * @param datasource - DataSource 技术名
 * @param sourceSystem - 源系统逻辑名
 */
export async function unlockDataSource(
  client: AdtHTTP,
  datasource: string,
  sourceSystem: string
): Promise<void> {
  await client.request(`${rsdsBase(datasource, sourceSystem)}?action=unlock`, {
    method: "POST",
    sessionType: session_types.stateful,
    headers: {
      Accept: RSDS_ACCEPT
    }
  })
}

/**
 * Update DataSource (PUT) - 保存修改后的 DataSource XML
 *
 * 对应请求: PUT /sap/bw/modeling/rsds/{datasource}/{sourceSystem}/m?lockHandle={h}
 * 会话: stateless (与 Eclipse 一致, 服务端通过 enqueue 锁表验证 lockHandle)
 *
 * 实测 (Eclipse Communication Log):
 *   - PUT 只带 lockHandle, **不带 corrNr** (与 TRFN 一致; TR 通过 Transport-Lock-Holder header 传递)
 *   - 可选 timestamp 头: 从 tlogoProperties/@adtcore:changedAt 提取 (如 "20260716011408")
 *
 * @param client - ADT HTTP 客户端
 * @param datasource - DataSource 技术名
 * @param sourceSystem - 源系统逻辑名
 * @param xmlContent - 修改后的 DataSource XML 内容
 * @param options - lockHandle / transport (TR 号) / timestamp
 */
export async function updateDataSource(
  client: AdtHTTP,
  datasource: string,
  sourceSystem: string,
  xmlContent: string,
  options: {
    lockHandle: string
    transport?: string
    timestamp?: string
    headers?: Record<string, string>
  }
): Promise<void> {
  const { lockHandle, transport, timestamp, headers = {} } = options

  const qs: Record<string, string> = { lockHandle }

  const requestHeaders: Record<string, string> = {
    "Content-Type": `application/xml, ${RSDS_CONTENT_TYPE}`,
    Accept: RSDS_ACCEPT,
    ...headers
  }
  // TR 通过 Transport-Lock-Holder header 传递 (与 TRFN setFields 一致)
  if (transport) requestHeaders["Transport-Lock-Holder"] = transport
  if (timestamp) requestHeaders["timestamp"] = timestamp

  await client.request(`${rsdsBase(datasource, sourceSystem)}/m`, {
    method: "PUT",
    qs,
    sessionType: session_types.stateless,
    headers: requestHeaders,
    body: xmlContent
  })
}

/**
 * Activate DataSource - 激活 DataSource
 *
 * 对应请求: POST /sap/bw/modeling/activation
 * 会话: stateless
 *
 * @param client - ADT HTTP 客户端
 * @param datasource - DataSource 技术名
 * @param sourceSystem - 源系统逻辑名
 * @param lockHandle - 锁定句柄
 * @param corrNr - 传输请求号 (可选)
 * @returns 激活结果
 */
export async function activateDataSource(
  client: AdtHTTP,
  datasource: string,
  sourceSystem: string,
  lockHandle: string = "",
  corrNr: string = ""
): Promise<ActivationResult> {
  const objectUri = `${rsdsBase(datasource, sourceSystem)}/m`
  const qs: Record<string, string> = {}
  if (corrNr) qs["corrNr"] = corrNr

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:bwModel="http://www.sap.com/bw/modeling">
  <atom:entry>
    <atom:content type="${RSDS_CONTENT_TYPE}">
      <bwModel:checkProperties version="inactive" modelContent="" lockHandle="${lockHandle}"></bwModel:checkProperties>
    </atom:content>
    <atom:link href="${objectUri}" type="application/*" rel="self"></atom:link>
  </atom:entry>
</atom:feed>`

  const response = await client.request("/sap/bw/modeling/activation", {
    method: "POST",
    qs,
    headers: {
      "Content-Type": "application/atom+xml;type=entry"
    },
    body
  })

  return parseActivationResponse(response.body)
}

// ============================================================================
// Helpers (XML parsing, 无网络依赖)
// ============================================================================

/**
 * Parse DataSource Details - 解析 DataSource 详情
 *
 * XML 结构:
 *   <rsds:dataSource name="..." sourceSystemName="..." type="..." applicationComponent="...">
 *     <description label="..."/>
 *     ...
 *     <adapter name="ODP" .../>
 *     <tlogoProperties adtcore:version="inactive" objectVersion="M" objectStatus="active" .../>
 *   </rsds:dataSource>
 */
export function parseDataSourceDetails(raw: any): DataSourceDetails {
  const root = raw["rsds:dataSource"] || raw

  const attrs = xmlNodeAttr(root) || {}
  const tlogo = root["tlogoProperties"] || {}
  const tlogoAttrs = xmlNodeAttr(tlogo) || {}
  const descNode = root["description"]
  const descLabel = descNode
    ? (xmlNodeAttr(descNode)?.label || descNode["@_label"])
    : undefined
  const adapter = root["adapter"]
  const adapterName = adapter
    ? (xmlNodeAttr(adapter)?.name || adapter["@_name"])
    : undefined

  return {
    name: attrs.name || root["@_name"] || "",
    technicalName: attrs.name || root["@_name"] || "",
    description: descLabel,
    type: attrs.type || root["@_type"],
    sourceSystem: attrs.sourceSystemName || root["@_sourceSystemName"],
    objectVersion: tlogoAttrs.objectVersion || tlogo["objectVersion"] || "M",
    objectStatus: tlogoAttrs.objectStatus || tlogo["objectStatus"],
    applicationComponent: attrs.applicationComponent || root["@_applicationComponent"],
    adapterType: adapterName
  }
}

/**
 * Parse DataSource Fields - 从 <segment>/<field> 提取字段列表
 */
export function parseDataSourceFields(raw: any): DataSourceField[] {
  const root = raw["rsds:dataSource"] || raw
  const segment = root["segment"]
  if (!segment) return []

  const fields = xmlArray(segment, "field")
  return fields.map((f: any) => {
    const attrs = xmlNodeAttr(f) || {}
    const inlineType = f["inlineType"] || {}
    const inlineAttrs = xmlNodeAttr(inlineType) || {}
    const props = f["fieldProperties"] || {}
    const propsAttrs = xmlNodeAttr(props) || {}
    const descNode = f["description"]
    const label = descNode
      ? (xmlNodeAttr(descNode)?.label || descNode["@_label"])
      : undefined

    return {
      name: attrs.name || f["@_name"] || "",
      dataType: inlineAttrs.name || inlineType["@_name"],
      length: inlineAttrs.length ? Number(inlineAttrs.length) : (inlineType["@_length"] ? Number(inlineType["@_length"]) : undefined),
      label,
      position: propsAttrs.position ? Number(propsAttrs.position) : undefined,
      // transfer="true" 经 fullParse (parseAttributeValue) 会变成 boolean true, 故需兼容两种类型
      transfer: propsAttrs.transfer === true || propsAttrs.transfer === "true" ||
                props["@_transfer"] === true || props["@_transfer"] === "true"
    }
  })
}

/**
 * Parse DataSource Versions - 解析 DataSource 版本历史响应
 *
 * RSDS 版本响应特征 (与 ADSO/DTP 不同):
 *   <atom:id>A</atom:id>          ← 版本字符在 id (A=Active)
 *   <atom:title>Active</atom:title>
 *   <atom:link href=".../m" rel="self"/>   ← href 指向 /m (active), 不带版本后缀
 *
 * 因此不能复用通用 parseObjectVersions (它用 uri.match(/\/[mad]$/) 提取版本, 对 RSDS 失败)。
 */
export function parseDataSourceVersions(body: string): DataSourceVersion[] {
  const parsed = fullParse(body)
  const feed = xmlNode(parsed, "atom:feed")

  if (!feed) {
    return []
  }

  const entries = xmlArray(feed, "atom:entry")

  // RSDS 版本字符 (在 <atom:id>) 使用 BW 对象版本约定 (大写):
  //   A = Active, M = Modified, D = Revised
  // 注意与 ADSO/DTP 不同: 后者的版本字符是小写 (m/a/d, 作 uri 后缀)。
  const versionMap: Record<string, string> = {
    A: "Active",
    M: "Modified",
    D: "Revised"
  }

  return entries.map((entry: any) => {
    const id = xmlNode(entry, "atom:id") || ""
    const title = xmlNode(entry, "atom:title") || ""
    const updated = xmlNode(entry, "atom:updated") || ""
    const author = xmlNode(entry, "atom:author")
    const userName = author ? xmlNode(author, "atom:name") : undefined
    const links = xmlArray(entry, "atom:link")
    const selfLink = links.find((link: any) => link["@_rel"] === "self")
    let uri = (selfLink as any)?.["@_href"] || id
    if (uri && typeof uri !== "string") {
      uri = String(uri)
    }

    // 版本字符优先从 <atom:id> 取 (单字符 A/M/D)
    let version = "M"
    const idStr = String(id)
    if (/^[AMD]$/.test(idStr)) {
      version = idStr
    } else {
      const versionMatch = idStr.match(/\/([AMDamd])$/)
      if (versionMatch) version = versionMatch[1].toUpperCase()
    }

    return {
      version,
      uri,
      description: versionMap[version] || title || version,
      // fullParse 的 parseAttributeValue 会把 "TESTUSER" 解析为数字, 统一回字符串
      created: updated === undefined ? undefined : String(updated),
      user: userName === undefined ? undefined : String(userName)
    }
  })
}

// ============================================================================
// ODP Proposal / Merge
// ============================================================================

/**
 * proposal 端点基础路径
 */
const RSDS_PROPOSAL_ENDPOINT = "/sap/bw/modeling/rsdsint/proposal"

/** proposal 请求 Content-Type (实测 Eclipse 请求头) */
export const RSDS_PROPOSAL_REQUEST_CONTENT_TYPE = "application/vnd.sap.bw.modeling.rsds+xml"

/** proposal 响应 Content-Type (实测 Eclipse 响应头) */
export const RSDS_PROPOSAL_RESPONSE_CONTENT_TYPE = "application/vnd.sap.bw.modeling.rsdsint+xml"

/**
 * Merge DataSource Proposal - 合并 ODP 提案 (改 ODP 适配器后的字段同步)
 *
 * 对应请求: POST /sap/bw/modeling/rsdsint/proposal/{datasource}/{sourceSystem}?action=merge
 * 会话: stateless
 *
 * 触发场景 (Eclipse): 修改 DataSource 的 ODP 适配器后, 向导进入对比页 (ComparisonPage)
 * 时调用此接口, 把外部 ODP 字段结构合并回 DataSource。
 *
 * **请求体**: 当前 DataSource 的完整 XML (从 getDataSourceXml 获取)。
 * **响应体**: 合并后的 DataSource 完整 XML, 结构与 GET /rsds/{ds}/{src}/m 一致,
 *   可直接用作 PUT body (无需额外转换)。
 *
 * 实测 Content-Type:
 *   请求: application/vnd.sap.bw.modeling.rsds+xml
 *   响应: application/vnd.sap.bw.modeling.rsdsint+xml
 *
 * @param client - ADT HTTP 客户端
 * @param datasource - DataSource 技术名
 * @param sourceSystem - 源系统逻辑名
 * @param dataSourceXml - 当前 DataSource XML (请求体)
 * @returns 合并后的 DataSource XML 字符串 (可直接用于 PUT update)
 */
export async function mergeDataSourceProposal(
  client: AdtHTTP,
  datasource: string,
  sourceSystem: string,
  dataSourceXml: string
): Promise<string> {
  const response = await client.request(
    `${RSDS_PROPOSAL_ENDPOINT}/${datasource}/${sourceSystem}`,
    {
      method: "POST",
      qs: { action: "merge" },
      headers: {
        "Content-Type": RSDS_PROPOSAL_REQUEST_CONTENT_TYPE,
        Accept: RSDS_PROPOSAL_RESPONSE_CONTENT_TYPE
      },
      body: dataSourceXml
    }
  )

  return response.body
}

export interface SaveAndActivateDataSourceOptions {
  transport?: string
  createTransport?: boolean
  transportDescription?: string
  autoActivate?: boolean
}

export interface SaveAndActivateDataSourceResult {
  lockHandle: string
  transport?: string
  activated: boolean
  activateResult?: ActivationResult
}

/**
 * Save and Activate DataSource - lock → transport → PUT → activate → unlock.
 * Session model: lock/unlock stateful; PUT/activation/transport stateless (no contextid).
 * RSDS transport/timestamp quirks stay in updateDataSource.
 */
export async function saveAndActivateDataSource(
  client: AdtHTTP,
  datasource: string,
  sourceSystem: string,
  xmlContent: string,
  options?: SaveAndActivateDataSourceOptions
): Promise<SaveAndActivateDataSourceResult> {
  const { resolveTransportForWrite } = await import("./transport")

  const dsUri = `/sap/bw/modeling/rsds/${datasource.toLowerCase()}/${sourceSystem.toLowerCase()}/m`
  const autoActivate = options?.autoActivate ?? true

  const lockResult = await lockDataSource(client, datasource, sourceSystem)

  try {
    const transport = await resolveTransportForWrite(client, dsUri, {
      transport: options?.transport,
      lockCorrNr: lockResult.corrNr,
      createTransport: options?.createTransport,
      transportDescription:
        options?.transportDescription || "API update DataSource"
    })

    const timestamp = extractDataSourceTimestamp(xmlContent)
    await updateDataSource(client, datasource, sourceSystem, xmlContent, {
      lockHandle: lockResult.lockHandle,
      transport,
      timestamp
    })

    let activateResult
    if (autoActivate) {
      activateResult = await activateDataSource(
        client,
        datasource,
        sourceSystem,
        lockResult.lockHandle,
        transport || ""
      )
    }

    return {
      lockHandle: lockResult.lockHandle,
      transport,
      activated: autoActivate,
      activateResult
    }
  } finally {
    await unlockDataSource(client, datasource, sourceSystem)
  }
}

/**
 * Extract DataSource Timestamp - 从 DataSource XML 提取 PUT timestamp 头
 *
 * 实测 (Eclipse 请求头 timestamp=20260716011408):
 *   tlogoProperties/@adtcore:changedAt="2026-07-16T01:14:08Z"
 *   → "20260716011408" (去 - : T Z, 取前 14 位)
 *
 * @param xml - DataSource XML 字符串
 * @returns 14 位时间戳 (如 "20260716011408"), 提取失败返回 undefined
 */
export function extractDataSourceTimestamp(xml: string): string | undefined {
  const m = xml.match(/adtcore:changedAt="([^"]+)"/)
  if (!m) return undefined
  // "2026-07-16T01:14:08Z" → "20260716011408"
  const cleaned = m[1].replace(/[-:TZ]/g, "")
  return cleaned.length >= 14 ? cleaned.slice(0, 14) : cleaned
}
