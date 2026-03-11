import * as t from "io-ts"
import { fullParse, xmlNodeAttr, xmlArray, xmlNode, orUndefined } from "../utilities"
import { AdtHTTP } from "../AdtHTTP"
import { ActivationResult, ActivationMessage, LockResult, activateObject, parseActivationResponse, ValidationAction, ValidationResult } from "./common"
import { BWObject, BWObjectType } from "./bwObject"
import { ADSODetails } from "./types"

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
    parentType = "AREA"
  } = options

  // 构建模板 XML (如果提供)
  const templateXml = template
    ? `  <template objectName="${template.objectName}" tlogo="${template.type}"/>`
    : ""

  // 构建 dimension XML
  const dimensionXml = `  <dimension name="GROUP1">
    <descriptions/>
  </dimension>`

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<adso:dataStore xmlns:adso="http://www.sap.com/bw/modeling/adso.ecore" xmlns:adtcore="http://www.sap.com/adt/core" schemaVersion="1.0" name="${name}" readOnly="${readOnly}" activateData="${activateData}" writeChangelog="${writeChangelog}">
  <endUserTexts label="${description}"/>
  <tlogoProperties adtcore:language="${masterLanguage}" adtcore:name="${name}" adtcore:type="ADSO" adtcore:masterLanguage="${masterLanguage}" adtcore:masterSystem="${masterSystem}" adtcore:responsible="${responsible}">
    <infoArea>${infoArea}</infoArea>
  </tlogoProperties>
${dimensionXml}
${templateXml}
</adso:dataStore>`

  const headers: Record<string, string> = {
    "Content-Type": "application/vnd.sap.bw.modeling.adso-v1_5_0+xml",
    "Accept": "application/vnd.sap.bw.modeling.adso-v1_5_0+xml",
    "Development-Class": "$TMP"
  }

  // 如果是创建新对象，添加父级信息
  if (parentName) {
    headers["parent_name"] = parentName
    headers["parent_type"] = parentType
    headers["activity_context"] = "CREA"
  }

  const response = await client.request(
    `/sap/bw/modeling/adso/${name.toLowerCase()}?lockHandle=${lockHandle}`,
    {
      method: "POST",
      headers,
      body
    }
  )

  if (response.status !== 200) {
    throw new Error(`Failed to create ADSO ${name}: ${response.status}`)
  }
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
  const objectUri = encodeURIComponent(`/sap/bw/modeling/adso/${adsoName.toLowerCase()}/${version}`)

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

  const response = await client.request(`/sap/bw/modeling/adso/${adsoId.toLowerCase()}/m`, {
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
export async function validateADSOCanDelete(
  client: AdtHTTP,
  adsoId: string
): Promise<ValidationResult> {
  const obj = new BWObject(client, BWObjectType.ADSO, adsoId)
  return obj.canDelete()
}

/**
 * Validate ADSO Can Activate - 验证 ADSO 是否可激活
 *
 * @param client - ADT HTTP 客户端
 * @param adsoId - ADSO ID
 * @returns 验证结果
 */
export async function validateADSOCanActivate(
  client: AdtHTTP,
  adsoId: string
): Promise<ValidationResult> {
  const obj = new BWObject(client, BWObjectType.ADSO, adsoId)
  return obj.canActivate()
}

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
    `/sap/bw/modeling/adso/${adsoId.toLowerCase()}/configuration`,
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
 * 对应请求: GET /sap/bw/modeling/adso/{adso_id}/sql
 *
 * @param client - ADT HTTP 客户端
 * @param adsoId - ADSO ID
 * @returns ADSO 表信息
 */
export async function getADSOTables(
  client: AdtHTTP,
  adsoId: string
): Promise<ADSOTables> {
  const response = await client.request(
    `/sap/bw/modeling/adso/${adsoId.toLowerCase()}/sql`,
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
  return obj.activate(lockHandle)
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

  const qs: Record<string, string> = {
    lockHandle
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/xml, application/vnd.sap.bw.modeling.adso-v1_5_0+xml",
    "Accept": "application/vnd.sap.bw.modeling.adso-v1_5_0+xml"
  }

  if (timestamp) {
    headers["timestamp"] = timestamp
  }

  const response = await client.request(
    `/sap/bw/modeling/adso/${adsoId.toLowerCase()}/m`,
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
 * Parse ADSO Lock Response - 解析 ADSO 锁定响应
 */
function parseADSOLockResponse(body: string): ADSOLockResult {
  const parsed = fullParse(body)
  const data = xmlNode(parsed, "asx:abap", "asx:values", "DATA")

  if (!data) {
    throw new Error("Invalid ADSO lock response format")
  }

  return {
    lockHandle: data["LOCK_HANDLE"] || "",
    corrNr: data["CORRNR"],
    corrUser: data["CORRUSER"],
    corrText: data["CORRTEXT"]
  }
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
