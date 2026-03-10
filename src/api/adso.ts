import * as t from "io-ts"
import { fullParse, xmlNodeAttr, xmlArray, xmlNode, orUndefined } from "../utilities"
import { AdtHTTP } from "../AdtHTTP"
import { ActivationResult, ActivationMessage, LockResult, activateObject, parseActivationResponse } from "./common"

// ============================================================================
// Types and Codecs for ADSO (Advanced DataStore Object)
// Based on: /sap/bw/modeling/adso (v1_5_0)
// ============================================================================

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

/**
 * ADSO Details - ADSO 详细信息
 */
export const ADSODetails = t.type({
  name: t.string,
  technicalName: t.string,
  description: orUndefined(t.string),
  objVers: orUndefined(t.string),
  adsoType: orUndefined(t.string),
  status: orUndefined(t.string),
  infoArea: orUndefined(t.string),
  isRealTime: orUndefined(t.boolean),
  partitioning: orUndefined(t.string),
  activationStatus: orUndefined(t.string)
})

export type ADSODetails = t.OutputOf<typeof ADSODetails>

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
  const response = await client.request(`/sap/bw/modeling/adso/${adsoId.toLowerCase()}/versions`, {
    method: "GET",
    headers: {
      "Accept": "application/atom+xml;type=feed"
    }
  })

  return parseADSOVersions(response.body)
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
): Promise<ADSOLockResult> {
  const response = await client.request(
    `/sap/bw/modeling/adso/${adsoId.toLowerCase()}?action=lock`,
    {
      method: "POST",
      headers: {
        "Accept": "application/vnd.sap.bw.modeling.adso-v1_5_0+xml"
      }
    }
  )

  return parseADSOLockResponse(response.body)
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
  await client.request(
    `/sap/bw/modeling/adso/${adsoId.toLowerCase()}?action=unlock`,
    {
      method: "POST",
      headers: {
        "Accept": "application/vnd.sap.bw.modeling.adso-v1_5_0+xml"
      }
    }
  )
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
  return activateObject(
    client,
    `/sap/bw/modeling/adso/${adsoId.toLowerCase()}/m`,
    lockHandle,
    "inactive",
    "application/vnd.sap.bw.modeling.adso-v1_5_0+xml"
  )
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
  return activateObject(
    client,
    `/sap/bw/modeling/adso/${adsoId.toLowerCase()}/m`,
    "",
    "inactive",
    "application/vnd.sap.bw.modeling.adso-v1_5_0+xml"
  )
}

// ============================================================================
// Parse Functions
// ============================================================================

/**
 * Parse ADSO Details Response - 解析 ADSO 详细信息响应
 */
function parseADSODetails(raw: any): ADSODetails {
  const root = raw["adso:adso"] || raw

  return {
    name: root["adso:name"] || root["name"] || "",
    technicalName: root["adso:technicalName"] || root["technicalName"] || "",
    description: root["adso:description"] || root["description"],
    objVers: root["adso:objVers"] || root["objVers"] || "M",
    adsoType: root["adso:adsoType"] || root["adsoType"],
    status: root["adso:status"] || root["status"],
    infoArea: root["adso:infoArea"],
    isRealTime: root["adso:isRealTime"] === "true",
    partitioning: root["adso:partitioning"],
    activationStatus: root["adso:activationStatus"]
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
