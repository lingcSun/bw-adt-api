import * as t from "io-ts"
import { fullParse, xmlNodeAttr, xmlArray, xmlNode, orUndefined } from "../utilities"
import { AdtHTTP } from "../AdtHTTP"
import { ActivationResult, LockResult, ValidationAction, ValidationResult } from "./common"
import { BWObject, BWObjectType } from "./bwObject"
import { DTPDetails } from "./types"

// ============================================================================
// Types and Codecs for DTP (Data Transfer Process)
// ============================================================================

// Re-export Validation types for convenience
export { ValidationAction, ValidationResult } from "./common"

/**
 * DTP Type - DTP 类型
 */
export enum DTPType {
  LOAD = "DTP_LOAD",           // 加载 DTP
  EXECUTE = "DTP_EXECUTE"     // 执行 DTP
}

/**
 * DTP Status - DTP 状态
 */
export enum DTPStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  EXISTING = "objectStatus:existing",
  REVISED = "objectStatus:revised"
}

/**
 * DTP Lock Result - DTP 锁定结果
 */
export const DTPLockResult = t.type({
  lockHandle: t.string,
  corrNr: orUndefined(t.string),
  corrUser: orUndefined(t.string),
  corrText: orUndefined(t.string)
})

export type DTPLockResult = t.OutputOf<typeof DTPLockResult>

/**
 * DTP Metadata - DTP 元数据
 */
export const DTPMetaData = t.type({
  name: t.string,
  source: t.string,           // 源对象
  target: t.string,           // 目标对象
  description: orUndefined(t.string),
  objVers: orUndefined(t.string),  // M=Active, D=Revised, A=Modified
  dtpType: orUndefined(t.string),    // LOAD 或 EXECUTE
  status: orUndefined(t.string)
})

export type DTPMetaData = t.OutputOf<typeof DTPMetaData>

// DTPDetails is now imported from types.ts to avoid duplication

/**
 * DTP Version - DTP 版本信息
 */
export const DTPVersion = t.type({
  version: t.string,           // m=active, a=modified, d=revised
  uri: t.string,
  created: orUndefined(t.string),
  user: orUndefined(t.string),
  description: orUndefined(t.string)
})

export type DTPVersion = t.OutputOf<typeof DTPVersion>

/**
 * DTP Execution Result - DTP 执行结果
 */
export const DTPExecutionResult = t.type({
  success: t.boolean,
  requestID: orUndefined(t.string),
  message: orUndefined(t.string),
  recordsProcessed: orUndefined(t.number),
  startTime: orUndefined(t.string),
  endTime: orUndefined(t.string)
})

export type DTPExecutionResult = t.OutputOf<typeof DTPExecutionResult>

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get DTP Details - 获取 DTP 详细信息
 *
 * 对应请求: GET /sap/bw/modeling/dtpa/{dtp_id}/m
 *
 * @param client - ADT HTTP 客户端
 * @param dtpId - DTP ID (格式: DTP_*)
 * @param forceCacheUpdate - 是否强制更新缓存
 * @returns DTP 详细信息
 */
export async function getDTP(
  client: AdtHTTP,
  dtpId: string,
  forceCacheUpdate: boolean = false
): Promise<any> {
  const qs = forceCacheUpdate ? { forceCacheUpdate: "true" } : undefined

  const response = await client.request(`/sap/bw/modeling/dtpa/${dtpId.toLowerCase()}/m`, {
    method: "GET",
    qs,
    headers: {
      "Accept": "application/vnd.sap.bw.modeling.dtpa-v1_0_0+xml"
    }
  })

  return fullParse(response.body)
}

/**
 * Get DTP Metadata (Parsed) - 获取解析后的 DTP 元数据
 *
 * @param client - ADT HTTP 客户端
 * @param dtpId - DTP ID
 * @param forceCacheUpdate - 是否强制更新缓存
 * @returns DTP 详细信息
 */
export async function getDTPDetails(
  client: AdtHTTP,
  dtpId: string,
  forceCacheUpdate: boolean = false
): Promise<DTPDetails> {
  const raw = await getDTP(client, dtpId, forceCacheUpdate)
  return parseDTPDetails(raw)
}

/**
 * Get DTP Versions - 获取 DTP 版本历史
 *
 * 对应请求: GET /sap/bw/modeling/dtpa/{dtp_id}/versions
 *
 * @param client - ADT HTTP 客户端
 * @param dtpId - DTP ID
 * @returns 版本历史列表
 */
export async function getDTPVersions(
  client: AdtHTTP,
  dtpId: string
): Promise<DTPVersion[]> {
  const obj = new BWObject(client, BWObjectType.DTP, dtpId)
  return obj.getVersions()
}

// ============================================================================
// Validation Functions (using BWObject base class)
// ============================================================================

/**
 * Validate DTP Exists - 验证 DTP 是否存在
 *
 * @param client - ADT HTTP 客户端
 * @param dtpId - DTP ID
 * @returns 验证结果
 */
export async function validateDTPExists(
  client: AdtHTTP,
  dtpId: string
): Promise<ValidationResult> {
  const obj = new BWObject(client, BWObjectType.DTP, dtpId)
  return obj.exists()
}

/**
 * Validate New DTP Name - 验证新 DTP 名称是否可用
 *
 * @param client - ADT HTTP 客户端
 * @param dtpId - DTP ID
 * @returns 验证结果
 */
export async function validateDTPNewName(
  client: AdtHTTP,
  dtpId: string
): Promise<ValidationResult> {
  const obj = new BWObject(client, BWObjectType.DTP, dtpId)
  return obj.isNewNameAvailable()
}

/**
 * Validate DTP Can Delete - 验证 DTP 是否可删除
 *
 * @param client - ADT HTTP 客户端
 * @param dtpId - DTP ID
 * @returns 验证结果
 */
export async function validateDTPCanDelete(
  client: AdtHTTP,
  dtpId: string
): Promise<ValidationResult> {
  const obj = new BWObject(client, BWObjectType.DTP, dtpId)
  return obj.canDelete()
}

/**
 * Validate DTP Can Activate - 验证 DTP 是否可激活
 *
 * @param client - ADT HTTP 客户端
 * @param dtpId - DTP ID
 * @returns 验证结果
 */
export async function validateDTPCanActivate(
  client: AdtHTTP,
  dtpId: string
): Promise<ValidationResult> {
  const obj = new BWObject(client, BWObjectType.DTP, dtpId)
  return obj.canActivate()
}

/**
 * Lock DTP - 锁定 DTP
 *
 * 对应请求: POST /sap/bw/modeling/dtpa/{dtp_id}?action=lock
 *
 * @param client - ADT HTTP 客户端
 * @param dtpId - DTP ID
 * @returns 锁定结果（包含 lockHandle）
 */
export async function lockDTP(
  client: AdtHTTP,
  dtpId: string
): Promise<LockResult> {
  const obj = new BWObject(client, BWObjectType.DTP, dtpId)
  return obj.lock()
}

/**
 * Unlock DTP - 解锁 DTP
 *
 * 对应请求: POST /sap/bw/modeling/dtpa/{dtp_id}?action=unlock
 *
 * @param client - ADT HTTP 客户端
 * @param dtpId - DTP ID
 */
export async function unlockDTP(
  client: AdtHTTP,
  dtpId: string
): Promise<void> {
  const obj = new BWObject(client, BWObjectType.DTP, dtpId)
  return obj.unlock()
}

/**
 * Activate DTP - 激活 DTP
 *
 * 对应请求: POST /sap/bw/modeling/activation
 *
 * @param client - ADT HTTP 客户端
 * @param dtpId - DTP ID
 * @param lockHandle - 锁定句柄
 * @param corrNr - 传输请求号（可选）
 * @returns 激活结果
 */
export async function activateDTP(
  client: AdtHTTP,
  dtpId: string,
  lockHandle: string = "",
  corrNr: string = ""
): Promise<any> {
  const qs: Record<string, string> = {}
  if (corrNr) qs["corrNr"] = corrNr

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:bwModel="http://www.sap.com/bw/modeling">
  <atom:entry>
    <atom:content type="application/vnd.sap.bw.modeling.dtpa-v1_0_0+xml">
      <bwModel:checkProperties version="inactive" modelContent="" lockHandle="${lockHandle}"></bwModel:checkProperties>
    </atom:content>
    <atom:link href="/sap/bw/modeling/dtpa/${dtpId.toLowerCase()}/m" type="application/*" rel="self"></atom:link>
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

  return fullParse(response.body)
}

/**
 * Check DTP - 检查 DTP 一致性
 *
 * @param client - ADT HTTP 客户端
 * @param dtpId - DTP ID
 * @returns 检查结果
 */
export async function checkDTP(
  client: AdtHTTP,
  dtpId: string
): Promise<any> {
  return activateDTP(client, dtpId, "", "")
}

/**
 * Execute DTP - 执行 DTP
 *
 * 对应请求: POST /sap/bw/modeling/dtpa/{dtp_id}?action=execute
 *
 * @param client - ADT HTTP 客户端
 * @param dtpId - DTP ID
 * @returns 执行结果
 */
export async function executeDTP(
  client: AdtHTTP,
  dtpId: string
): Promise<DTPExecutionResult> {
  const response = await client.request(
    `/sap/bw/modeling/dtpa/${dtpId.toLowerCase()}?action=execute`,
    {
      method: "POST",
      headers: {
        "Accept": "application/vnd.sap.bw.modeling.dtpa-v1_0_0+xml"
      }
    }
  )

  return parseDTPExecutionResponse(response.body)
}

// ============================================================================
// Parse Functions
// ============================================================================

/**
 * Parse DTP Details Response - 解析 DTP 详细信息响应
 */
function parseDTPDetails(raw: any): DTPDetails {
  const root = raw["dtp:dtp"] || raw

  return {
    name: root["dtp:name"] || root["name"] || "",
    technicalName: root["dtp:technicalName"] || root["technicalName"] || "",
    source: root["dtp:source"] || root["source"] || "",
    target: root["dtp:target"] || root["target"] || "",
    description: root["dtp:description"] || root["description"],
    objVers: root["dtp:objVers"] || root["objVers"] || "M",
    dtpType: root["dtp:dtpType"] || root["dtpType"],
    status: root["dtp:status"] || root["status"],
    sourceType: root["dtp:sourceType"],
    targetType: root["dtp:targetType"],
    deltaRequest: root["dtp:deltaRequest"] === "true",
    realTimeLoad: root["dtp:realTimeLoad"] === "true"
  }
}

/**
 * Parse DTP Versions Response - 解析 DTP 版本历史响应
 */
function parseDTPVersions(body: string): DTPVersion[] {
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
 * Parse DTP Lock Response - 解析 DTP 锁定响应
 */
function parseDTPLockResponse(body: string): DTPLockResult {
  const parsed = fullParse(body)
  const data = xmlNode(parsed, "asx:abap", "asx:values", "DATA")

  if (!data) {
    throw new Error("Invalid DTP lock response format")
  }

  return {
    lockHandle: data["LOCK_HANDLE"] || "",
    corrNr: data["CORRNR"],
    corrUser: data["CORRUSER"],
    corrText: data["CORRTEXT"]
  }
}

/**
 * Parse DTP Execution Response - 解析 DTP 执行响应
 */
function parseDTPExecutionResponse(body: string): DTPExecutionResult {
  const parsed = fullParse(body)
  // 根据实际响应格式解析
  return {
    success: true,
    requestID: parsed["requestID"] || "",
    message: parsed["message"] || "",
    recordsProcessed: parsed["recordsProcessed"],
    startTime: parsed["startTime"],
    endTime: parsed["endTime"]
  }
}
