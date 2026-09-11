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
    `/sap/bw/modeling/adso/${adsoId.toLowerCase()}/${version}`,
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
  const { resolveTransportForWrite } = await import("./transport")

  const adsoUri = `/sap/bw/modeling/adso/${adsoId.toLowerCase()}/m`
  const autoActivate = options?.autoActivate ?? true
  const timestamp = options?.timestamp ?? extractADSOTimestamp(xmlContent)

  const lockResult = await lockADSO(client, adsoId)

  try {
    const transport = await resolveTransportForWrite(client, adsoUri, {
      transport: options?.transport,
      lockCorrNr: lockResult.corrNr,
      createTransport: options?.createTransport,
      transportDescription: options?.transportDescription || "API ADSO update"
    })

    const updateResult = await updateADSO(client, adsoId, xmlContent, {
      lockHandle: lockResult.lockHandle,
      corrNr: transport,
      timestamp
    })

    let activateResult
    if (autoActivate) {
      activateResult = await activateADSO(
        client,
        adsoId,
        lockResult.lockHandle,
        transport || ""
      )
    }

    return {
      lockHandle: lockResult.lockHandle,
      transport,
      updateResult,
      activated: autoActivate,
      activateResult
    }
  } finally {
    await unlockADSO(client, adsoId)
  }
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
    autoActivate = false
  } = options

  const areaValid = await validateInfoArea(client, infoArea)
  if (!areaValid.valid) {
    throw new Error(`InfoArea ${infoArea} does not exist`)
  }

  if (template) {
    const templateValid = await validateTemplateADSO(client, template.objectName)
    if (!templateValid.valid) {
      throw new Error(`Template ${template.objectName} does not exist`)
    }
  }

  const nameValid = await validateNewADSOName(client, name)
  if (!nameValid.valid) {
    throw new Error(`ADSO name ${name} is not available`)
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
        parentType: "AREA"
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
 * Field 类型字段定义 (本地字段, 非 InfoObject)
 *
 * Eclipse 特征: 无 infoObjectName / atom:link, sidDeterminationMode="N",
 * 标签放在 localProperties/descriptions/@label。
 */
export interface ADSOFieldDefinition {
  name: string
  /** DDIC 类型, 默认 CHAR */
  dataType?: "CHAR" | "NUMC" | "DATS" | "TIMS" | "DEC" | "CUKY" | "CURR" | "QUAN" | "INT4" | "FLTP"
  length?: number
  label?: string
  /** 维度短名, 默认 CHA → dimension="#///CHA§" */
  dimension?: string
  semanticType?: string
  precision?: number
  scale?: number
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

/**
 * 构建 field 类型 element XML 片段
 * 对照 AUGBL / SGTXT / ZC_MATNR 等本地字段节点
 *
 * dimension 入参支持两种写法:
 *   - 短名 (如 "CHA"/"__NON_KEY"): 拼成 "#///CHA§"/"#///__NON_KEY§"
 *   - 完整 (如 "#///__NON_KEY§"): 原样使用
 */
export function buildADSOFieldElementXml(field: ADSOFieldDefinition): string {
  const dataType = field.dataType || "CHAR"
  const length = field.length ?? defaultLength(dataType)
  const semanticType = field.semanticType ?? defaultSemanticType(dataType)
  const rawDim = field.dimension || "CHA"
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

  return `<element xsi:type="adso:AdsoElement" name="${field.name}" dimension="${dimension}" sidDeterminationMode="N">
    <inlineType ${inlineAttrs}/>
    <localProperties xsi:type="BwCore:LocalCharacteristicProperties">
      ${descriptions}
    </localProperties>
  </element>`
}

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
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

  // 未指定 dimension 时, 从已有 element 继承 (优先 __NON_KEY, 否则任取一个)
  let resolved = field
  if (!field.dimension) {
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
  const response = await client.request(`/sap/bw/modeling/adso/${adsoId.toLowerCase()}/m`, {
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
