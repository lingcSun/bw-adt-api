import * as t from "io-ts"
import { fullParse, xmlNodeAttr, xmlArray, xmlNode, orUndefined } from "../utilities"
import { AdtHTTP } from "../AdtHTTP"
import { ActivationResult, ActivationMessage, LockResult, activateObject, parseActivationResponse, ValidationAction, ValidationResult } from "./common"
import { BWObject, BWObjectType } from "./bwObject"
import { ADSODetails } from "./types"
import { withWriteSession } from "./writeSession"

// ============================================================================
// Types and Codecs for ADSO (Advanced DataStore Object)
// Based on: /sap/bw/modeling/adso (v1_5_0)
// ============================================================================

// Re-export Validation types for convenience
export { ValidationAction, ValidationResult } from "./common"

/**
 * Template Type - 模板类型
 */
export enum TemplateType {
  ADSO = "ADSO",         // InfoProvider (ADSO)
  DSO = "DSO",           // DataSource
  IOBJ = "IOBJ",         // InfoObject
  ISRC = "ISRC",         // InfoSource
  NONE = ""              // 无模板（空白创建）
}

export type TemplateTypeString = "ADSO" | "DSO" | "IOBJ" | "ISRC" | ""

/**
 * ADSO Create Options - ADSO 创建选项
 */
export interface CreateADSOOptions {
  name: string                          // ADSO 技术名称
  description: string                   // 描述
  infoArea: string                      // InfoArea
  masterLanguage: string                // 主语言 (如: ZH, EN)
  responsible: string                   // 负责人用户名
  masterSystem?: string                 // 主系统 (默认: 从配置获取)
  // 模板选项 (5种创建方式)
  template?: {
    objectName: string                  // 模板对象名称
    type: TemplateTypeString            // 模板类型
  }
  // ADSO 属性
  activateData?: boolean                // 激活数据 (默认: true)
  writeChangelog?: boolean              // 写入变更日志 (默认: true)
  readOnly?: boolean                    // 只读 (默认: false)
  // 父级信息
  parentName?: string                   // 父级名称 (InfoArea)
  parentType?: string                   // 父级类型 (如: AREA)
  /**
   * 开发包. 缺省 "$TMP"（本地对象，不入传输）。
   * 传真实包（如 "ZBW"）时必须同时给 transport，否则对象会落 $TMP 而无法挂请求。
   */
  packageName?: string
  /**
   * 工作台请求号. 传入后创建请求会带上 corrNr，对象登记进该请求。
   * 只用 packageName 而不给 transport 会退化成 $TMP（服务器行为），故两者建议成对传。
   */
  transport?: string
}

/**
 * Node Path Entry - 节点路径条目
 */
export interface NodePathEntry {
  name: string
  techName: string
  type: string
  description?: string
  uri?: string
  childrenUri?: string
}

/**
 * ADSO Type - ADSO 类型
 */
export enum ADSOType {
  STANDARD = "standard",
  WRITE_OPTIMIZED = "write-optimized",
  DATA_MART = "data-mart",
  IN_MEMORY = "in-memory"
}

/**
 * ADSO Status - ADSO 状态
 */
export enum ADSOStatus {
  ACTIVE = "active",
  INACTIVE = "inactive"
}

/**
 * ADSO Lock Result - ADSO 锁定结果
 */
export const ADSOLockResult = t.type({
  lockHandle: t.string,
  corrNr: orUndefined(t.string),
  corrUser: orUndefined(t.string),
  corrText: orUndefined(t.string)
})

export type ADSOLockResult = t.OutputOf<typeof ADSOLockResult>

/**
 * ADSO Metadata - ADSO 元数据
 */
export const ADSOMetaData = t.type({
  name: t.string,
  technicalName: t.string,
  description: orUndefined(t.string),
  objVers: orUndefined(t.string),  // M=Active, D=Revised, A=Modified
  adsoType: orUndefined(t.string), // standard, write-optimized, etc.
  status: orUndefined(t.string)
})

export type ADSOMetaData = t.OutputOf<typeof ADSOMetaData>

// ADSODetails is now imported from types.ts to avoid duplication

/**
 * ADSO Version - ADSO 版本信息
 */
export const ADSOVersion = t.type({
  version: t.string,           // m=active, a=modified, d=revised
  uri: t.string,
  created: orUndefined(t.string),
  user: orUndefined(t.string),
  description: orUndefined(t.string)
})

export type ADSOVersion = t.OutputOf<typeof ADSOVersion>

/**
 * ADSO Tables - ADSO 关联的表信息
 */
export const ADSOTables = t.type({
  activeTable: orUndefined(t.string),       // 激活表
  inboundTable: orUndefined(t.string),      // 写入表
  activeDataTables: orUndefined(t.array(t.string)), // 活动数据表列表
  changelogTable: orUndefined(t.string),    // 变更日志表
})

export type ADSOTables = t.OutputOf<typeof ADSOTables>

/**
 * ADSO Configuration - ADSO 配置信息
 * 对应端点: /sap/bw/modeling/adso/{adsonm}/configuration
 */
export const ADSOConfiguration = t.type({
  name: orUndefined(t.string),
  technicalName: orUndefined(t.string),
  description: orUndefined(t.string),
  adsoType: orUndefined(t.string),
  semanticPartitioning: orUndefined(t.string),
  reportingEnabled: orUndefined(t.boolean),
  consolidationEnabled: orUndefined(t.boolean),
  inboundInterfaceEnabled: orUndefined(t.boolean)
})

export type ADSOConfiguration = t.OutputOf<typeof ADSOConfiguration>

// ============================================================================
// API Functions
// ============================================================================

/**
 * Validate Object - 验证 BW 对象
 *
 * 对应请求: POST /sap/bw/modeling/validation?objectType={type}&objectName={name}&action={action}
 *
 * @param client - ADT HTTP 客户端
 * @param objectType - 对象类型 (ADSO, AREA, DSO, IOBJ, ISRC 等)
 * @param objectName - 对象名称
 * @param action - 验证动作
 * @returns 验证结果
 */
export async function validateObject(
  client: AdtHTTP,
  objectType: string,
  objectName: string,
  action: ValidationAction
): Promise<ValidationResult> {
  const response = await client.request("/sap/bw/modeling/validation", {
    method: "POST",
    qs: {
      objectType,
      objectName: objectName.toLowerCase(),
      action
    }
  })

  // 200 OK 表示验证通过
  return {
    valid: response.status === 200,
    message: response.status === 200 ? "Validation passed" : "Validation failed"
  }
}

/**
 * Validate InfoArea - 验证 InfoArea 是否存在
 *
 * @param client - ADT HTTP 客户端
 * @param infoAreaName - InfoArea 名称
 * @returns 验证结果
 */
export async function validateInfoArea(
  client: AdtHTTP,
  infoAreaName: string
): Promise<ValidationResult> {
  return validateObject(client, "AREA", infoAreaName, ValidationAction.EXISTS)
}

/**
 * Validate Template ADSO - 验证模板 ADSO 是否存在
 *
 * @param client - ADT HTTP 客户端
 * @param templateName - 模板 ADSO 名称
 * @returns 验证结果
 */
export async function validateTemplateADSO(
  client: AdtHTTP,
  templateName: string
): Promise<ValidationResult> {
  return validateObject(client, "ADSO", templateName, ValidationAction.EXISTS)
}

/**
 * 模板 tlogo → validation objectType 映射。
 *
 * 实测 (2026-09-20, 见 docs/VERIFIED_APIS.md 第 6 节): validation 端点接受的
 * objectType 只有 ADSO / IOBJ / RSDS；tlogo 的 "DSO" 须映射为 "RSDS"，
 * "ISRC" 无对应 token（返回 undefined，调用方应跳过预检、交给服务端裁决）。
 */
export function templateValidationObjectType(
  tlogo: string | undefined
): "ADSO" | "IOBJ" | "RSDS" | undefined {
  switch (tlogo) {
    case "IOBJ":
      return "IOBJ"
    case "DSO":
      return "RSDS"
    case "ADSO":
    case "":
    case undefined:
      return "ADSO"
    default:
      return undefined
  }
}

/**
 * Validate New ADSO Name - 验证新 ADSO 名称是否可用
 *
 * @param client - ADT HTTP 客户端
 * @param adsoName - ADSO 名称
 * @returns 验证结果
 */
export async function validateNewADSOName(
  client: AdtHTTP,
  adsoName: string
): Promise<ValidationResult> {
  return validateObject(client, "ADSO", adsoName, ValidationAction.NEW)
}

/**
 * Create ADSO - 创建 ADSO
 *
 * 对应请求: POST /sap/bw/modeling/adso/{name}?lockHandle={lockHandle}
 *
 * @param client - ADT HTTP 客户端
 * @param options - 创建选项
 * @param lockHandle - 锁定句柄
 * @returns 创建结果
 */
export async function createADSO(
  client: AdtHTTP,
  options: CreateADSOOptions,
  lockHandle: string
): Promise<void> {
  const {
    name,
    description,
    infoArea,
    masterLanguage,
    responsible,
    masterSystem = "BPD",
    template,
    activateData = true,
    writeChangelog = true,
    readOnly = false,
    parentName,
    parentType = "AREA",
    packageName = "$TMP",
    transport
  } = options

  // 构建模板 XML (如果提供)
  const templateXml = template
    ? `  <template objectName="${escapeXmlAttr(template.objectName)}" tlogo="${template.type}"/>`
    : ""

  // 构建 dimension XML
  const dimensionXml = `  <dimension name="GROUP1">
    <descriptions/>
  </dimension>`

  // 非 $TMP 包必须有 transport：否则服务器会静默落回 $TMP，对象不进任何请求。
  // 显式要了真实包却没给请求号是调用方错误，宁可报错也不要静默降级
  // （实测：packageName="ZBW" 无 transport 时对象落 $TMP 且不报错）。
  if (packageName && packageName !== "$TMP" && !transport) {
    throw new Error(
      `createADSO: packageName "${packageName}" requires a transport request number — ` +
      `without it the object would silently become a $TMP local object. ` +
      `Pass transport=<TRKORR> (create one with createTransport), or set packageName="$TMP" explicitly.`
    )
  }

  const devClass = transport ? packageName : "$TMP"
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<adso:dataStore xmlns:adso="http://www.sap.com/bw/modeling/adso.ecore" xmlns:adtcore="http://www.sap.com/adt/core" schemaVersion="1.0" name="${escapeXmlAttr(name)}" readOnly="${readOnly}" activateData="${activateData}" writeChangelog="${writeChangelog}">
  <endUserTexts label="${escapeXmlAttr(description)}"/>
  <tlogoProperties adtcore:language="${masterLanguage}" adtcore:name="${escapeXmlAttr(name)}" adtcore:type="ADSO" adtcore:masterLanguage="${masterLanguage}" adtcore:masterSystem="${escapeXmlAttr(masterSystem)}" adtcore:responsible="${escapeXmlAttr(responsible)}">
    <infoArea>${escapeXmlAttr(infoArea)}</infoArea>
  </tlogoProperties>
${dimensionXml}
${templateXml}
</adso:dataStore>`

  const headers: Record<string, string> = {
    "Content-Type": "application/vnd.sap.bw.modeling.adso-v1_5_0+xml",
    "Accept": "application/vnd.sap.bw.modeling.adso-v1_5_0+xml",
    "Development-Class": devClass
  }

  // 如果是创建新对象，添加父级信息
  if (parentName) {
    headers["parent_name"] = parentName
    headers["parent_type"] = parentType
    headers["activity_context"] = "CREA"
  }

  // 非 $TMP 包时把请求号带进 URL，否则对象即使有包也不登记进请求
  const corrNr = transport ? `&corrNr=${encodeURIComponent(transport)}` : ""

  const response = await client.request(
    `/sap/bw/modeling/adso/${encodeURIComponent(name.toLowerCase())}?lockHandle=${encodeURIComponent(lockHandle)}${corrNr}`,
    {
      method: "POST",
      headers,
      body
    }
  )
}

/**
 * Get ADSO Node Path - 获取 ADSO 节点路径
 *
 * 对应请求: GET /sap/bw/modeling/repo/nodepath?objectUri={uri}
 *
 * @param client - ADT HTTP 客户端
 * @param adsoName - ADSO 名称
 * @param version - 版本 (m=active, a=modified, d=revised, 默认: m)
 * @returns 节点路径列表
 */
export async function getADSONodePath(
  client: AdtHTTP,
  adsoName: string,
  version: "m" | "a" | "d" = "m"
): Promise<NodePathEntry[]> {
  // qs 值由传输层（axios params）单次编码——这里不能预编码，否则上线双重编码
  // （%252F...），服务端报「Data type "" does not exist」（V5，2026-09-20 真机
  // 三组对照定位；Eclipse 线上形态即单次编码，nodepath 本身对 adso/iobj URI 均可用）。
  const objectUri = `/sap/bw/modeling/adso/${adsoName.toLowerCase()}/${version}`

  const response = await client.request("/sap/bw/modeling/repo/nodepath", {
    method: "GET",
    qs: { objectUri }
  })

  return parseNodePathResponse(response.body)
}

/**
 * Parse Node Path Response - 解析节点路径响应
 */
function parseNodePathResponse(body: string): NodePathEntry[] {
  const parsed = fullParse(body)
  const feed = xmlNode(parsed, "atom:feed")

  if (!feed) {
    return []
  }

  const entries = xmlArray(feed, "atom:entry")

  return entries.map((entry: any) => {
    const content = xmlNode(entry, "atom:content")
    const bwObject = xmlNode(content, "bwModel:object")
    const title = xmlNode(entry, "atom:title")
    const id = xmlNode(entry, "atom:id")
    const links = xmlArray(entry, "atom:link")

    const attrs = bwObject ? xmlNodeAttr(bwObject) : {}

    // 提取 children URL
    const childrenLink = links.find((link: any) =>
      link["@_rel"] === "http://www.sap.com/bw/modeling/relations:children"
    )

    return {
      name: title || "",
      techName: attrs?.objectName || bwObject?.["@_objectName"] || "",
      type: attrs?.objectType || bwObject?.["@_objectType"] || "",
      description: title || "",
      uri: id || "",
      childrenUri: (childrenLink as any)?.["@_href"] || ""
    }
  })
}

/**
 * Get ADSO Details - 获取 ADSO 详细信息
 *
 * 对应请求: GET /sap/bw/modeling/adso/{adso_id}/m
 *
 * @param client - ADT HTTP 客户端
 * @param adsoId - ADSO ID (技术名称)
 * @param forceCacheUpdate - 是否强制更新缓存
 * @returns ADSO 详细信息
 */
export async function getADSO(
  client: AdtHTTP,
  adsoId: string,
  forceCacheUpdate: boolean = false
): Promise<any> {
  const qs = forceCacheUpdate ? { forceCacheUpdate: "true" } : undefined

  const response = await client.request(`/sap/bw/modeling/adso/${encodeURIComponent(adsoId.toLowerCase())}/m`, {
    method: "GET",
    qs,
    headers: {
      "Accept": "application/vnd.sap.bw.modeling.adso-v1_5_0+xml"
    }
  })

  return fullParse(response.body)
}

/**
 * Get ADSO Details (Parsed) - 获取解析后的 ADSO 元数据
 *
 * @param client - ADT HTTP 客户端
 * @param adsoId - ADSO ID
 * @param forceCacheUpdate - 是否强制更新缓存
 * @returns ADSO 详细信息
 */
export async function getADSODetails(
  client: AdtHTTP,
  adsoId: string,
  forceCacheUpdate: boolean = false
): Promise<ADSODetails> {
  const raw = await getADSO(client, adsoId, forceCacheUpdate)
  return parseADSODetails(raw)
}

/**
 * Get ADSO Versions - 获取 ADSO 版本历史
 *
 * 对应请求: GET /sap/bw/modeling/adso/{adso_id}/versions
 *
 * @param client - ADT HTTP 客户端
 * @param adsoId - ADSO ID
 * @returns 版本历史列表
 */
export async function getADSOVersions(
  client: AdtHTTP,
  adsoId: string
): Promise<ADSOVersion[]> {
  const obj = new BWObject(client, BWObjectType.ADSO, adsoId)
  return obj.getVersions()
}

// ============================================================================
// Validation Functions (using BWObject base class)
// ============================================================================

/**
 * Validate ADSO Exists - 验证 ADSO 是否存在
 *
 * @param client - ADT HTTP 客户端
 * @param adsoId - ADSO ID
 * @returns 验证结果
 */
export async function validateADSOExists(
  client: AdtHTTP,
  adsoId: string
): Promise<ValidationResult> {
  const obj = new BWObject(client, BWObjectType.ADSO, adsoId)
  return obj.exists()
}

/**
 * Validate New ADSO Name - 验证新 ADSO 名称是否可用
 *
 * @param client - ADT HTTP 客户端
 * @param adsoId - ADSO ID
 * @returns 验证结果
 */
export async function validateADSONewName(
  client: AdtHTTP,
  adsoId: string
): Promise<ValidationResult> {
  const obj = new BWObject(client, BWObjectType.ADSO, adsoId)
  return obj.isNewNameAvailable()
}

/**
 * Validate ADSO Can Delete - 验证 ADSO 是否可删除
 *
 * @param client - ADT HTTP 客户端
 * @param adsoId - ADSO ID
 * @returns 验证结果
 */

/**
 * Validate ADSO Can Activate - 验证 ADSO 是否可激活
 *
 * @param client - ADT HTTP 客户端
 * @param adsoId - ADSO ID
 * @returns 验证结果
 */

/**
 * Get ADSO Configuration - 获取 ADSO 配置信息
 *
 * 对应请求: GET /sap/bw/modeling/adso/{adso_id}/configuration
 *
 * @param client - ADT HTTP 客户端
 * @param adsoId - ADSO ID
 * @returns ADSO 配置信息
 */
export async function getADSOConfiguration(
  client: AdtHTTP,
  adsoId: string
): Promise<ADSOConfiguration> {
  const response = await client.request(
    `/sap/bw/modeling/adso/${encodeURIComponent(adsoId.toLowerCase())}/configuration`,
    {
      method: "GET",
      headers: {
        "Accept": "application/vnd.sap.bw.modeling.adso-v1_5_0+xml"
      }
    }
  )

  const raw = fullParse(response.body)
  return parseADSOConfiguration(raw)
}

/**
 * Get ADSO Tables - 获取 ADSO 关联的表名
 *
 * 对应请求: GET /sap/bw/modeling/adso/{adso_id}/{version}
 *
 * 历史上该接口走 `/sql` 子路径且不带版本段，SAP 会把缺失的版本默认成 `S`
 * （saved）并以「不支持对象版本 S」HTTP 500 拒绝。所有同族只读端点
 * （getADSODDICLinks / getADSOXml）都用 `/m` 且正常，
 * 故这里改为版本化的 `/m`（active），默认 version="m"。
 *
 * @param client - ADT HTTP 客户端
 * @param adsoId - ADSO ID
 * @param version - 版本段：m=active（默认）, a=modified, d=revised
 * @returns ADSO 表信息
 */
export async function getADSOTables(
  client: AdtHTTP,
  adsoId: string,
  version: "m" | "a" | "d" = "m"
): Promise<ADSOTables> {
  const response = await client.request(
    `/sap/bw/modeling/adso/${encodeURIComponent(adsoId.toLowerCase())}/${version}`,
    {
      method: "GET",
      headers: {
        "Accept": "application/vnd.sap.bw.modeling.adso-v1_5_0+xml"
      }
    }
  )

  const raw = fullParse(response.body)
  return parseADSOTables(raw)
}

/**
 * Lock ADSO - 锁定 ADSO
 *
 * 对应请求: POST /sap/bw/modeling/adso/{adso_id}?action=lock
 *
 * @param client - ADT HTTP 客户端
 * @param adsoId - ADSO ID
 * @returns 锁定结果（包含 lockHandle）
 */
export async function lockADSO(
  client: AdtHTTP,
  adsoId: string
): Promise<LockResult> {
  const obj = new BWObject(client, BWObjectType.ADSO, adsoId)
  return obj.lock()
}

/**
 * Unlock ADSO - 解锁 ADSO
 *
 * 对应请求: POST /sap/bw/modeling/adso/{adso_id}?action=unlock
 *
 * @param client - ADT HTTP 客户端
 * @param adsoId - ADSO ID
 */
export async function unlockADSO(
  client: AdtHTTP,
  adsoId: string
): Promise<void> {
  const obj = new BWObject(client, BWObjectType.ADSO, adsoId)
  return obj.unlock()
}

/**
 * Activate ADSO - 激活 ADSO
 *
 * 对应请求: POST /sap/bw/modeling/activation
 *
 * @param client - ADT HTTP 客户端
 * @param adsoId - ADSO ID
 * @param lockHandle - 锁定句柄
 * @param corrNr - 传输请求号（可选）
 * @returns 激活结果
 */
export async function activateADSO(
  client: AdtHTTP,
  adsoId: string,
  lockHandle: string = "",
  corrNr: string = ""
): Promise<ActivationResult> {
  const obj = new BWObject(client, BWObjectType.ADSO, adsoId)
  return obj.activate(lockHandle, corrNr || undefined)
}

/**
 * Check ADSO - 检查 ADSO 一致性
 *
 * @param client - ADT HTTP 客户端
 * @param adsoId - ADSO ID
 * @returns 检查结果
 */
export async function checkADSO(
  client: AdtHTTP,
  adsoId: string
): Promise<ActivationResult> {
  const obj = new BWObject(client, BWObjectType.ADSO, adsoId)
  return obj.check()
}

/**
 * Update ADSO Options - 更新 ADSO 选项
 */
export interface UpdateADSOOptions {
  lockHandle: string
  corrNr?: string
  timestamp?: string
}

/**
 * Update ADSO - 更新 ADSO 元数据
 *
 * 对应请求: PUT /sap/bw/modeling/adso/{adso_id}/m?lockHandle=xxx
 *
 * @param client - ADT HTTP 客户端
 * @param adsoId - ADSO ID
 * @param xmlContent - ADSO XML 内容（完整的 dataStore 定义）
 * @param options - 更新选项
 * @returns 更新结果
 */
export async function updateADSO(
  client: AdtHTTP,
  adsoId: string,
  xmlContent: string,
  options: UpdateADSOOptions
): Promise<ActivationResult> {
  const { lockHandle, corrNr, timestamp } = options

  // Eclipse: PUT .../m?corrNr={tr}&lockHandle={handle}  (stateless)
  const qs: Record<string, string> = { lockHandle }
  if (corrNr) qs["corrNr"] = corrNr

  const headers: Record<string, string> = {
    "Content-Type": "application/xml, application/vnd.sap.bw.modeling.adso-v1_5_0+xml",
    "Accept": "application/vnd.sap.bw.modeling.adso-v1_5_0+xml"
  }

  if (timestamp) {
    headers["timestamp"] = timestamp
  }

  const response = await client.request(
    `/sap/bw/modeling/adso/${encodeURIComponent(adsoId.toLowerCase())}/m`,
    {
      method: "PUT",
      qs,
      headers,
      body: xmlContent
    }
  )

  // 响应是 ATOM feed 格式，包含检查结果
  return parseActivationResponse(response.body)
}

export interface SaveAndActivateADSOOptions {
  transport?: string
  /** Create a new TR when recording is required and no transport/corrNr is set. */
  createTransport?: boolean
  transportDescription?: string
  autoActivate?: boolean
  timestamp?: string
}

export interface SaveAndActivateADSOResult {
  lockHandle: string
  transport?: string
  updateResult: ActivationResult
  activated: boolean
  activateResult?: ActivationResult
}

/**
 * Save and Activate ADSO - lock → transport → PUT → activate → unlock (finally).
 * Session model: lock/unlock stateful; PUT/activation/transport stateless (no contextid).
 */
export async function saveAndActivateADSO(
  client: AdtHTTP,
  adsoId: string,
  xmlContent: string,
  options?: SaveAndActivateADSOOptions
): Promise<SaveAndActivateADSOResult> {
  return withWriteSession(client, {
    lock: c => lockADSO(c, adsoId),
    update: (c, xml, io) =>
      updateADSO(c, adsoId, xml, {
        lockHandle: io.lockHandle,
        corrNr: io.corrNr,
        timestamp: io.timestamp ?? extractADSOTimestamp(xml),
      }),
    activate: (c, lockHandle, corrNr) => activateADSO(c, adsoId, lockHandle, corrNr || ""),
    unlock: c => unlockADSO(c, adsoId),
  }, {
    uri: `/sap/bw/modeling/adso/${encodeURIComponent(adsoId.toLowerCase())}/m`,
    xml: xmlContent,
    autoActivate: options?.autoActivate,
    timestamp: options?.timestamp,
    transport: options?.transport,
    createTransport: options?.createTransport,
    transportDescription: options?.transportDescription || "API ADSO update",
  })
}

export type AddADSOKeyOptions = {
  /** inlineType 长度，默认 40（唯一实测值） */
  length?: number
  /** 加键后是否立即激活。默认 false——空白 ADSO 只有键没有字段时激活会报
   * 「需至少一个字段」；先 addKey 再 addField 的流程让 addField 负责激活。 */
  autoActivate?: boolean
} & SaveAndActivateADSOOptions

/**
 * Add ADSO Key - 给 ADSO 加键定义（addADSOKeyToXml 的写编排包装）。
 *
 * 2026-09-20 端到端实测：空白创建 → addKey(0MATERIAL, 不激活) → addField(激活)
 * → 对象激活成功。见 VERIFIED_APIS F3。
 *
 * @param client - ADT HTTP 客户端
 * @param adsoId - ADSO ID
 * @param infoObjectName - 作为键的 InfoObject 技术名
 */
export async function addADSOKey(
  client: AdtHTTP,
  adsoId: string,
  infoObjectName: string,
  options?: AddADSOKeyOptions
): Promise<SaveAndActivateADSOResult> {
  const { length, autoActivate, ...saveOptions } = options || {}
  const xml = await getADSOXml(client, adsoId, true)
  const nextXml = addADSOKeyToXml(xml, infoObjectName, { length })
  return saveAndActivateADSO(client, adsoId, nextXml, {
    ...saveOptions,
    autoActivate: autoActivate ?? false
  })
}

/**
 * Create ADSO with validation + lock/unlock (and optional activate).
 * Public create entry used by domain facade and BWAdtClient.
 */
export async function createADSOFull(
  client: AdtHTTP,
  options: CreateADSOOptions & {
    autoActivate?: boolean
    responsible?: string
  }
): Promise<ADSOLockResult> {
  const {
    name,
    infoArea,
    template,
    masterLanguage = "EN",
    responsible = options.responsible || "",
    masterSystem = "BPD",
    activateData = true,
    writeChangelog = true,
    readOnly = false,
    autoActivate = false,
    packageName = "$TMP",
    transport
  } = options

  const areaValid = await validateInfoArea(client, infoArea)
  if (!areaValid.valid) {
    throw new Error(`InfoArea ${infoArea} does not exist`)
  }

  if (template) {
    // 按 tlogo 映射 validation objectType（IOBJ/RSDS 模板按 ADSO 校验会误报不存在，
    // 见 2026-09-19 复测 F4 与 2026-09-20 实测）；ISRC 无合法 token，跳过预检。
    const validationType = templateValidationObjectType(template.type)
    if (validationType) {
      const templateValid = await validateObject(
        client,
        validationType,
        template.objectName,
        ValidationAction.EXISTS
      )
      if (!templateValid.valid) {
        throw new Error(
          `Template ${template.objectName} (type ${template.type || "ADSO"}) does not exist`
        )
      }
    }
  }

  // validateObject 在服务端拒绝时直接抛错（带服务端原文，如「长度必须在 3 个和 9 个字符之间」），
  // 只有 200 才会返回 valid:true。这里补上调用方最需要的那条约束说明，避免只有服务端原文。
  let nameValid
  try {
    nameValid = await validateNewADSOName(client, name)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(
      `ADSO name ${JSON.stringify(name)} was rejected: ${detail} ` +
      `Note: an ADSO name must be 3-9 characters excluding any /namespace/ prefix.`
    )
  }
  if (!nameValid.valid) {
    throw new Error(
      `ADSO name ${JSON.stringify(name)} is not available. ` +
      `Note: an ADSO name must be 3-9 characters excluding any /namespace/ prefix.`
    )
  }

  const lockResult = await lockADSO(client, name)

  try {
    await createADSO(
      client,
      {
        ...options,
        masterLanguage,
        responsible,
        masterSystem,
        activateData,
        writeChangelog,
        readOnly,
        parentName: infoArea,
        parentType: "AREA",
        packageName,
        transport
      },
      lockResult.lockHandle
    )

    if (autoActivate) {
      await activateADSO(client, name, lockResult.lockHandle)
    }

    return lockResult
  } finally {
    await unlockADSO(client, name)
  }
}

/**
 * Field 类型字段定义 (本地字段或 InfoObject 引用)
 *
 * 本地字段 Eclipse 特征: 无 infoObjectName / atom:link, sidDeterminationMode="N",
 * 标签放在 localProperties/descriptions/@label。
 *
 * 金额↔币种（2026-11-17 实测，ZL_FID01/ZL_FID15）：
 * - 本地 CUKY 必须带 outputLength + semanticType=currencyCode + consumptionViewProperties，
 *   否则 KYF 的 unitCurrencyElement 指向它时激活会被打回 0CURRENCY。
 * - **挂真 IOBJ**（Eclipse 搜索挂载，2026-11-17 ZL_FID01 PUT）：用 hang 骨架
 *   （keep/displayFolder/inlineType/associationType），**不要**带 atom:link /
 *   localProperties / consumptionViewProperties；UNI 默认 dim=UNI、sid=S、
 *   baseInfoObjectName=0CURRENCY；KYF 带 unitCurrencyElement、sid=N。
 */
export interface ADSOFieldDefinition {
  name: string
  /**
   * 引用的 InfoObject 技术名。给定即按 IOBJ hang 骨架生成元素
   * （2026-11-17 Eclipse ZL_FID01：ZC_RWCUR/ZK_WSL）。
   */
  infoObjectName?: string
  /**
   * 挂载 IOBJ 类型。省略时：有 unitCurrencyElement → KYF；
   * 有 baseInfoObjectName / dataType=CUKY → UNI；否则 CHA。
   */
  infoObjectType?: "CHA" | "KYF" | "UNI"
  /** UNI 挂载时的基础单位 IOBJ，默认 0CURRENCY */
  baseInfoObjectName?: string
  /** DDIC 类型, 默认 CHAR */
  dataType?: "CHAR" | "NUMC" | "DATS" | "TIMS" | "DEC" | "CUKY" | "CURR" | "QUAN" | "INT4" | "FLTP"
  length?: number
  label?: string
  /**
   * 维度短名或完整 "#///…§"。
   * 未指定时：CUKY/UNI→UNI，CURR/unitCurrency/KYF→KYF，其余→CHA / 继承。
   */
  dimension?: string
  semanticType?: string
  precision?: number
  scale?: number
  /**
   * 金额字段绑定的币种/单位字段（ADSO 内 element name）。
   * 可传 `ZC_RWCUR` 或 `#///ZC_RWCUR`；写入为 `<unitCurrencyElement>#///ZC_RWCUR</unitCurrencyElement>`。
   */
  unitCurrencyElement?: string
  /** 聚合行为；KYF/CURR 默认 SUM；UNI hang 默认 NONE */
  aggregationBehavior?: "SUM" | "MAX" | "MIN" | "NOP" | "NONE" | string
}

/** Normalize unit/currency element ref to `#///NAME` form. */
export function normalizeUnitCurrencyElement(ref: string): string {
  const trimmed = ref.trim()
  if (!trimmed) {
    throw new Error("unitCurrencyElement must be a non-empty field name")
  }
  if (trimmed.startsWith("#///")) return trimmed
  return `#///${trimmed}`
}

function defaultSemanticType(dataType: string): string {
  switch (dataType) {
    case "DATS":
    case "TIMS":
      return "date"
    case "CURR":
      return "amount"
    case "CUKY":
      return "currencyCode"
    case "QUAN":
      return "quantity"
    default:
      return "empty"
  }
}

function defaultLength(dataType: string): number {
  switch (dataType) {
    case "DATS":
      return 8
    case "TIMS":
      return 6
    case "CUKY":
      return 5
    case "INT4":
      return 10
    default:
      return 10
  }
}

function resolveInfoObjectHangType(
  field: ADSOFieldDefinition
): "CHA" | "KYF" | "UNI" {
  if (field.infoObjectType) return field.infoObjectType
  if (field.unitCurrencyElement) return "KYF"
  if (field.baseInfoObjectName || field.dataType === "CUKY") return "UNI"
  if (field.dimension) {
    const d = field.dimension.toUpperCase()
    if (d.includes("UNI")) return "UNI"
    if (d.includes("KYF")) return "KYF"
  }
  return "CHA"
}

/**
 * 构建 IOBJ hang 字段 element XML（Eclipse 搜索挂载骨架）。
 *
 * 证据 2026-11-17 ZL_FID01 PUT：
 * - UNI `ZC_RWCUR`：keep/NONE/sid=S/baseInfoObjectName=0CURRENCY + inlineType CUKY
 * - KYF `ZK_WSL`：keep/SUM/sid=N + unitCurrencyElement + inlineType CURR
 * - 均无 atom:link / localProperties / consumptionViewProperties（服务器水合）
 * CHA 仍可用极简 name+infoObjectName（2026-09 F11）。
 */
export function buildADSOInfoObjectElementXml(field: ADSOFieldDefinition): string {
  if (!field.infoObjectName) {
    throw new Error("buildADSOInfoObjectElementXml: infoObjectName is required")
  }

  const hangType = resolveInfoObjectHangType(field)
  const iobj = escapeXmlAttr(field.infoObjectName)
  const name = escapeXmlAttr(field.name)
  const label = escapeXmlAttr(field.label || field.infoObjectName)

  if (hangType === "UNI") {
    const rawDim = field.dimension || "UNI"
    const dimension = rawDim.startsWith("#") ? rawDim : `#///${rawDim}§`
    const base = escapeXmlAttr(field.baseInfoObjectName || "0CURRENCY")
    const length = field.length ?? 5
    const agg = field.aggregationBehavior || "NONE"
    return (
      `<element xsi:type="adso:AdsoElement" name="${name}" keep="false" ` +
      `aggregationBehavior="${escapeXmlAttr(agg)}" attributeHierarchyDefaultMember="" ` +
      `infoObjectName="${iobj}" displayFolder="" baseInfoObjectName="${base}" ` +
      `dimension="${dimension}" sidDeterminationMode="S">` +
      `<endUserTexts label="${label}"/>` +
      `<inlineType name="CUKY" length="${length}" precision="0" scale="0" ` +
      `semanticType="currencyCode" globalElementName="${iobj}"/>` +
      `<fixedCurrency></fixedCurrency><fixedUnit></fixedUnit>` +
      `<associationType>1</associationType></element>`
    )
  }

  if (hangType === "KYF") {
    const rawDim = field.dimension || "KYF"
    const dimension = rawDim.startsWith("#") ? rawDim : `#///${rawDim}§`
    const agg = field.aggregationBehavior || "SUM"
    const precision = field.precision ?? 17
    const scale = field.scale ?? 2
    const unitXml = field.unitCurrencyElement
      ? `<unitCurrencyElement>${escapeXmlAttr(normalizeUnitCurrencyElement(field.unitCurrencyElement))}</unitCurrencyElement>`
      : ""
    return (
      `<element xsi:type="adso:AdsoElement" name="${name}" keep="false" ` +
      `aggregationBehavior="${escapeXmlAttr(agg)}" attributeHierarchyDefaultMember="" ` +
      `infoObjectName="${iobj}" displayFolder="" dimension="${dimension}" ` +
      `sidDeterminationMode="N">` +
      `<endUserTexts label="${label}"/>` +
      `<inlineType name="CURR" precision="${precision}" scale="${scale}" ` +
      `semanticType="empty" globalElementName="${iobj}"/>` +
      `${unitXml}<associationType>1</associationType></element>`
    )
  }

  // CHA：保留 F11 极简形态（服务器水合）
  const rawDim = field.dimension || "CHA"
  const dimension = rawDim.startsWith("#") ? rawDim : `#///${rawDim}§`
  const descriptions = field.label
    ? `<descriptions label="${escapeXmlAttr(field.label)}"/>`
    : "<descriptions/>"
  return (
    `<element xsi:type="adso:AdsoElement" name="${name}" ` +
    `infoObjectName="${iobj}" dimension="${dimension}" sidDeterminationMode="N">` +
    `<localProperties xsi:type="BwCore:LocalCharacteristicProperties">${descriptions}</localProperties>` +
    `</element>`
  )
}

/**
 * 本地币种字段（CUKY）完整形态 —— 对照 ZL_FID01 RWCUR（2026-11-17）。
 * 残缺形态（semanticType=empty、无 consumptionView）会导致金额 unitCurrency 绑定激活失败。
 */
function buildLocalCurrencyElementXml(field: ADSOFieldDefinition): string {
  const length = field.length ?? 5
  const semanticType = field.semanticType ?? "currencyCode"
  const rawDim = field.dimension || "UNI"
  const dimension = rawDim.startsWith("#") ? rawDim : `#///${rawDim}§`
  const descriptions = field.label
    ? `<descriptions label="${escapeXmlAttr(field.label)}"/>`
    : ""

  return `<element xsi:type="adso:AdsoElement" name="${escapeXmlAttr(field.name)}" dimension="${dimension}" sidDeterminationMode="N" outputLength="${length}"><inlineType name="CUKY" length="${length}" semanticType="${escapeXmlAttr(semanticType)}"/><localProperties xsi:type="BwCore:LocalCharacteristicProperties">${descriptions}</localProperties><consumptionViewProperties objectType="UNI" metaObject="false" odsOnly="false" nonCumulative="true" fieldName="${escapeXmlAttr(field.name)}" sidConversionType="N"/></element>`
}

/**
 * 构建 field 类型 element XML 片段
 * 对照 AUGBL / SGTXT / ZC_MATNR 等本地字段节点；CUKY 走完整币种形态。
 *
 * dimension 入参支持两种写法:
 *   - 短名 (如 "CHA"/"__NON_KEY"): 拼成 "#///CHA§"/"#///__NON_KEY§"
 *   - 完整 (如 "#///__NON_KEY§"): 原样使用
 */
export function buildADSOFieldElementXml(field: ADSOFieldDefinition): string {
  // IOBJ 引用字段（F11）走独立构建器
  if (field.infoObjectName) {
    return buildADSOInfoObjectElementXml(field)
  }

  const dataType = field.dataType || "CHAR"

  // 本地币种：必须完整形态，否则无法作为 unitCurrencyElement 目标
  if (dataType === "CUKY" || field.semanticType === "currencyCode") {
    return buildLocalCurrencyElementXml({
      ...field,
      dataType: "CUKY",
      semanticType: field.semanticType ?? "currencyCode"
    })
  }

  const length = field.length ?? defaultLength(dataType)
  const semanticType = field.semanticType ?? defaultSemanticType(dataType)
  const defaultDim =
    dataType === "CURR" || field.unitCurrencyElement ? "KYF" : "CHA"
  const rawDim = field.dimension || defaultDim
  const dimension = rawDim.startsWith("#") ? rawDim : `#///${rawDim}§`

  let inlineAttrs = `name="${dataType}"`
  if (dataType === "CURR" || dataType === "DEC" || dataType === "QUAN" || dataType === "FLTP") {
    const precision = field.precision ?? 17
    const scale = field.scale ?? 2
    inlineAttrs += ` precision="${precision}" scale="${scale}"`
  } else {
    inlineAttrs += ` length="${length}"`
  }
  inlineAttrs += ` semanticType="${semanticType}"`

  const descriptions = field.label
    ? `<descriptions label="${escapeXmlAttr(field.label)}"/>`
    : "<descriptions/>"

  const unitXml = field.unitCurrencyElement
    ? `<unitCurrencyElement>${escapeXmlAttr(normalizeUnitCurrencyElement(field.unitCurrencyElement))}</unitCurrencyElement>`
    : ""

  const agg =
    field.aggregationBehavior ||
    (dataType === "CURR" || field.unitCurrencyElement ? "SUM" : undefined)
  const aggAttr = agg ? ` aggregationBehavior="${escapeXmlAttr(agg)}"` : ""

  return `<element xsi:type="adso:AdsoElement" name="${escapeXmlAttr(field.name)}"${aggAttr} dimension="${dimension}" sidDeterminationMode="N"><inlineType ${inlineAttrs}/>${unitXml}<localProperties xsi:type="BwCore:LocalCharacteristicProperties">${descriptions}</localProperties></element>`
}

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

/**
 * 向 ADSO XML 添加键定义（2026-09-20 实测闭环，VERIFIED_APIS F3）。
 *
 * 激活要求键 = `<keyElement>#///{iobj}</keyElement>` + 一个**同名引用元素**，
 * 且该元素必须带 `inlineType`（含 `globalElementName`）——裸引用元素（无
 * inlineType）会被服务器 500 拒绝。本函数发射与实测通过完全一致的形态。
 *
 * - 已有引用该 iobj 的 keyElement 时幂等返回原文
 * - 已有同名元素但缺 keyElement 时仅补 keyElement
 * - 否则在 </adso:dataStore> 前追加 元素 + keyElement（实测被接受的排布）
 *
 * length 仅实测过 40（0MATERIAL）；服务器是否校验长度未验证。
 */
export function addADSOKeyToXml(
  adsoXml: string,
  infoObjectName: string,
  options?: { length?: number }
): string {
  const iobj = infoObjectName.toUpperCase()
  if (!/^[A-Z0-9/]+$/.test(iobj)) {
    throw new Error(`addADSOKeyToXml: invalid InfoObject name ${JSON.stringify(infoObjectName)}`)
  }
  if (new RegExp(`<keyElement[^>]*>#///${iobj}</keyElement>`).test(adsoXml)) {
    return adsoXml
  }

  const length = options?.length ?? 40
  const keyElementXml = `  <keyElement>#///${iobj}</keyElement>\n`
  const elementXml =
    `  <element xsi:type="adso:AdsoElement" name="${iobj}" infoObjectName="${iobj}" ` +
    `dimension="#///__CHARACTERISTIC§" sidDeterminationMode="N">` +
    `<inlineType name="CHAR" globalElementName="${iobj}" length="${length}" semanticType="empty"/>` +
    `<localProperties xsi:type="BwCore:LocalCharacteristicProperties"/></element>\n`

  const closeIdx = adsoXml.lastIndexOf("</adso:dataStore>")
  if (closeIdx === -1) {
    throw new Error("Invalid ADSO XML: missing </adso:dataStore>")
  }

  if (new RegExp(`<element[^>]*\\sname="${iobj}"`).test(adsoXml)) {
    // 元素已存在，仅补 keyElement
    return adsoXml.slice(0, closeIdx) + keyElementXml + adsoXml.slice(closeIdx)
  }
  return adsoXml.slice(0, closeIdx) + elementXml + keyElementXml + adsoXml.slice(closeIdx)
}

/**
 * 向 ADSO XML 插入 field 类型字段
 *
 * 插入位置: 最后一个已有 <element> 之后 (在 <dimension>/<keyElement>/<hashElements>
 * 等结构节点之前), 保证符合 XSD 子元素顺序。
 *
 * dimension: 若 field 未指定, 自动从已有非 __KEY 的 element 继承 (如 __NON_KEY);
 * 没有可用参照时回退到 "CHA"。
 */
export function addADSOFieldToXml(adsoXml: string, field: ADSOFieldDefinition): string {
  if (new RegExp(`<element[^>]*\\sname="${field.name}"`).test(adsoXml)) {
    throw new Error(`Field "${field.name}" already exists in ADSO XML`)
  }
  // F3 fail-fast: 无键定义的 ADSO 能 PUT 但激活必报「Key definition missing」，
  // 对象卡 inactive。提前给出可操作的指引。
  if (!/<keyElement[\s>]/.test(adsoXml)) {
    throw new Error(
      `ADSO XML has no <keyElement> — activation would fail with "Key definition missing" ` +
      `and leave the object inactive. Add a key first via addADSOKeyToXml() ` +
      `(or the adso.addKey facade), then add fields.`
    )
  }

  // 未指定 dimension 时, 从已有 element 继承 (优先 __NON_KEY, 否则任取一个)。
  // CUKY/CURR/带 unitCurrency 的金额与 IOBJ-KYF 有自己的默认维度（UNI/KYF），不继承。
  let resolved = field
  const hangType = field.infoObjectName
    ? resolveInfoObjectHangType(field)
    : undefined
  const keepOwnDim =
    !!field.dimension ||
    field.dataType === "CUKY" ||
    field.dataType === "CURR" ||
    field.semanticType === "currencyCode" ||
    !!field.unitCurrencyElement ||
    hangType === "UNI" ||
    hangType === "KYF"
  if (!keepOwnDim) {
    const dims = [...adsoXml.matchAll(/<element[^>]*\sdimension="([^"]*)"/g)].map(
      (m) => m[1]
    )
    const inherited =
      dims.find((d) => d.includes("__NON_KEY")) || dims[0]
    if (inherited) resolved = { ...field, dimension: inherited }
  }

  const elementXml = buildADSOFieldElementXml(resolved)

  // 定位插入点: 最后一个 </element> 之后; 若无 element, 则回退到 keyElement/根结构之前
  const lastElementEnd = adsoXml.lastIndexOf("</element>")
  if (lastElementEnd !== -1) {
    const insertAt = lastElementEnd + "</element>".length
    return adsoXml.slice(0, insertAt) + elementXml + adsoXml.slice(insertAt)
  }

  const keyIdx = adsoXml.search(/<keyElement[\s>]/)
  if (keyIdx !== -1) {
    return adsoXml.slice(0, keyIdx) + elementXml + "\n  " + adsoXml.slice(keyIdx)
  }

  const closeIdx = adsoXml.lastIndexOf("</adso:dataStore>")
  if (closeIdx === -1) {
    throw new Error("Invalid ADSO XML: missing </adso:dataStore>")
  }
  return adsoXml.slice(0, closeIdx) + "  " + elementXml + "\n" + adsoXml.slice(closeIdx)
}

/**
 * 从 ADSO XML 移除指定字段 (field / InfoObject 通用)
 */
export function removeADSOFieldFromXml(adsoXml: string, fieldName: string): string {
  const pattern = new RegExp(
    `\\s*<element[^>]*\\sname="${fieldName}"[^>]*(?:/>|>[\\s\\S]*?</element>)`,
    "g"
  )
  const next = adsoXml.replace(pattern, "")
  if (next === adsoXml) {
    throw new Error(`Field "${fieldName}" not found in ADSO XML`)
  }
  return next
}

/**
 * 从 tlogoProperties/@adtcore:changedAt 提取 PUT 所需 timestamp 头
 * 例: 2025-06-12T09:56:38Z → 20250612095638
 */
export function extractADSOTimestamp(adsoXml: string): string | undefined {
  const m = adsoXml.match(
    /adtcore:changedAt="(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/
  )
  if (!m) return undefined
  return `${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}${m[6]}`
}

/**
 * Get ADSO Raw XML - 获取 ADSO 原始 XML 字符串 (供 PUT update 使用)
 */
export async function getADSOXml(
  client: AdtHTTP,
  adsoId: string,
  forceCacheUpdate: boolean = false
): Promise<string> {
  const qs = forceCacheUpdate ? { forceCacheUpdate: "true" } : undefined
  const response = await client.request(`/sap/bw/modeling/adso/${encodeURIComponent(adsoId.toLowerCase())}/m`, {
    method: "GET",
    qs,
    headers: {
      Accept: "application/vnd.sap.bw.modeling.adso-v1_5_0+xml"
    }
  })
  return response.body
}

// ============================================================================
// Parse Functions
// ============================================================================

/**
 * Parse ADSO Details Response - 解析 ADSO 详细信息响应
 */
function parseADSODetails(raw: any): ADSODetails {
  const root = raw["adso:adso"] || raw["adso:dataStore"] || raw
  const tlogoProps = root["tlogoProperties"] || {}

  return {
    name: root["@_name"] || tlogoProps["@_name"] || root["adso:name"] || root["name"] || "",
    technicalName: root["@_name"] || tlogoProps["@_name"] || root["adso:technicalName"] || root["technicalName"] || "",
    description: root["adso:description"] || root["description"] || 
                (root["endUserTexts"]?.["@_label"]),
    objVers: tlogoProps["objectVersion"] || root["adso:objVers"] || root["objVers"] || "M",
    adsoType: root["adso:adsoType"] || root["adsoType"],
    status: tlogoProps["objectStatus"] || root["adso:status"] || root["status"],
    infoArea: tlogoProps["infoArea"] || root["adso:infoArea"],
    isRealTime: root["@_planningMode"] === "true" || root["adso:isRealTime"] === "true",
    partitioning: root["adso:partitioning"],
    activationStatus: tlogoProps["contentState"]
  }
}

/**
 * Parse ADSO Configuration Response - 解析 ADSO 配置响应
 */
function parseADSOConfiguration(raw: any): ADSOConfiguration {
  const root = raw["adso:adso"] || raw["adso:configuration"] || raw

  return {
    name: root["adso:name"] || root["name"],
    technicalName: root["adso:technicalName"] || root["technicalName"],
    description: root["adso:description"] || root["description"],
    adsoType: root["adso:adsoType"] || root["adsoType"],
    semanticPartitioning: root["adso:semanticPartitioning"],
    reportingEnabled: root["adso:reportingEnabled"] === "true",
    consolidationEnabled: root["adso:consolidationEnabled"] === "true",
    inboundInterfaceEnabled: root["adso:inboundInterfaceEnabled"] === "true"
  }
}

/**
 * Parse ADSO Versions Response - 解析 ADSO 版本历史响应
 */
function parseADSOVersions(body: string): ADSOVersion[] {
  const parsed = fullParse(body)
  const feed = xmlNode(parsed, "atom:feed")

  if (!feed) {
    return []
  }

  const entries = xmlArray(feed, "atom:entry")

  return entries.map((entry: any) => {
    const id = xmlNode(entry, "atom:id") || ""
    const title = xmlNode(entry, "atom:title") || ""
    const updated = xmlNode(entry, "atom:updated") || ""
    const author = xmlNode(entry, "atom:author")
    const userName = author ? xmlNode(author, "atom:name") : undefined
    const links = xmlArray(entry, "atom:link")

    const selfLink = links.find((link: any) => link["@_rel"] === "self")
    let uri = (selfLink as any)?.["@_href"] || id
    // 确保 uri 是字符串
    if (uri && typeof uri !== "string") {
      uri = String(uri)
    }

    const versionMatch = uri.match(/\/([mad])$/)
    const version = versionMatch ? versionMatch[1] : "m"

    const versionMap: Record<string, string> = {
      "m": "Active",
      "a": "Modified",
      "d": "Revised"
    }

    return {
      version,
      uri,
      description: versionMap[version] || version,
      created: updated,
      user: userName
    }
  })
}

/**
 * Parse ADSO Tables Response - 解析 ADSO 表信息响应
 */
function parseADSOTables(raw: any): ADSOTables {
  const root = raw["adso:adso"] || raw["adso:dataStore"] || raw["adso:sql"] || raw

  const tablesArray = xmlArray(root, "tables")
  
  let activeTable: string | undefined
  let inboundTable: string | undefined
  let changelogTable: string | undefined
  const activeDataTables: string[] = []

  tablesArray.forEach((table: any) => {
    const tableName = table["@_tableName"] || table["tableName"] || ""
    const tableType = table["@_tableType"] || table["tableType"] || ""
    
    switch (tableType) {
      case "AT":
        activeTable = tableName
        activeDataTables.push(tableName)
        break
      case "AQ":
        inboundTable = tableName
        break
      case "CL":
        changelogTable = tableName
        break
      default:
        if (tableName) {
          activeDataTables.push(tableName)
        }
    }
  })

  return {
    activeTable,
    inboundTable,
    activeDataTables: activeDataTables.length > 0 ? activeDataTables : undefined,
    changelogTable
  }
}
