import * as t from "io-ts"
import { fullParse, xmlNodeAttr, xmlArray, xmlNode, orUndefined } from "../utilities"
import { AdtHTTP } from "../AdtHTTP"
import { ActivationResult, ActivationMessage, LockResult, activateObject, parseActivationResponse, parseLockResponse, parseObjectVersions } from "./common"

// ============================================================================
// Types and Codecs for Transformation
// ============================================================================

// Re-export common types as Transformation-specific types for compatibility
export type TransformationLockResult = LockResult

/**
 * Transformation Metadata
 */
export const TransformationMetaData = t.type({
  name: t.string,
  source: t.string,      // 源对象
  target: t.string,      // 目标对象
  description: orUndefined(t.string),
  objVers: orUndefined(t.string)  // M=Active, A=Modified, D=Revised
})

export type TransformationMetaData = t.OutputOf<typeof TransformationMetaData>

/**
 * Transformation Version - 转换版本信息
 */
export const TransformationVersion = t.type({
  version: t.string,           // m=active, a=modified, d=revised
  uri: t.string,
  created: orUndefined(t.string),
  user: orUndefined(t.string),
  description: orUndefined(t.string)
})

export type TransformationVersion = t.OutputOf<typeof TransformationVersion>

/**
 * Transformation Details - 转换详细信息
 */
export const TransformationDetails = t.type({
  name: t.string,
  source: t.string,           // 源对象名称
  target: t.string,           // 目标对象名称
  description: orUndefined(t.string),
  objVers: orUndefined(t.string),  // M=Active, A=Modified, D=Revised
  sourceType: orUndefined(t.string),
  targetType: orUndefined(t.string),
  ruleCount: orUndefined(t.number),     // 规则数量
  status: orUndefined(t.string)        // 状态
})

export type TransformationDetails = t.OutputOf<typeof TransformationDetails>

// ============================================================================
// API Functions
// ============================================================================

/**
 * Lock Transformation - 锁定转换
 *
 * 对应请求: POST /sap/bw/modeling/trfn/{trfn_id}?action=lock
 *
 * @param client - ADT HTTP 客户端
 * @param trfnId - Transformation ID
 * @returns 锁定结果（包含 lockHandle）
 */
export async function lockTransformation(
  client: AdtHTTP,
  trfnId: string
): Promise<TransformationLockResult> {
  const response = await client.request(
    `/sap/bw/modeling/trfn/${trfnId}?action=lock`,
    {
      method: "POST",
      headers: {
        "Accept": "application/vnd.sap.bw.modeling.trfn-v1_0_0+xml"
      }
    }
  )

  return parseLockResponse(response.body)
}

/**
 * Unlock Transformation - 解锁转换
 *
 * 对应请求: POST /sap/bw/modeling/trfn/{trfn_id}?action=unlock
 *
 * @param client - ADT HTTP 客户端
 * @param trfnId - Transformation ID
 */
export async function unlockTransformation(
  client: AdtHTTP,
  trfnId: string
): Promise<void> {
  await client.request(
    `/sap/bw/modeling/trfn/${trfnId}?action=unlock`,
    {
      method: "POST",
      headers: {
        "Accept": "application/vnd.sap.bw.modeling.trfn-v1_0_0+xml"
      }
    }
  )
}

/**
 * Get Transformation Metadata - 获取转换元数据
 *
 * 对应请求: GET /sap/bw/modeling/trfn/{trfn_id}
 *
 * @param client - ADT HTTP 客户端
 * @param trfnId - Transformation ID
 * @param version - 版本 (m=active, a=modified, d=revised)
 * @returns Transformation 元数据
 */
export async function getTransformation(
  client: AdtHTTP,
  trfnId: string,
  version: "m" | "a" | "d" = "m"
): Promise<any> {
  const response = await client.request(`/sap/bw/modeling/trfn/${trfnId}/${version}`, {
    method: "GET",
    headers: {
      "Accept": "application/vnd.sap.bw.modeling.trfn-v1_0_0+xml"
    }
  })

  return fullParse(response.body)
}

/**
 * Get Transformation Details - 获取转换详细信息（解析后）
 *
 * @param client - ADT HTTP 客户端
 * @param trfnId - Transformation ID
 * @param version - 版本 (m=active, a=modified, d=revised)
 * @returns 转换详细信息
 */
export async function getTransformationDetails(
  client: AdtHTTP,
  trfnId: string,
  version: "m" | "a" | "d" = "m"
): Promise<TransformationDetails> {
  const raw = await getTransformation(client, trfnId, version)
  return parseTransformationDetails(raw)
}

/**
 * Get Transformation Versions - 获取转换版本历史
 *
 * 对应请求: GET /sap/bw/modeling/trfn/{trfn_id}/versions
 *
 * @param client - ADT HTTP 客户端
 * @param trfnId - Transformation ID
 * @returns 版本历史列表
 */
export async function getTransformationVersions(
  client: AdtHTTP,
  trfnId: string
): Promise<TransformationVersion[]> {
  const response = await client.request(`/sap/bw/modeling/trfn/${trfnId}/versions`, {
    method: "GET",
    headers: {
      "Accept": "application/atom+xml;type=feed"
    }
  })

  return parseTransformationVersions(response.body)
}

/**
 * Check Transformation - 检查转换一致性
 *
 * 对应请求: POST /sap/bw/modeling/activation (检查模式)
 *
 * @param client - ADT HTTP 客户端
 * @param trfnId - Transformation ID
 * @returns 检查结果
 */
export async function checkTransformation(
  client: AdtHTTP,
  trfnId: string
): Promise<ActivationResult> {
  return activateObject(
    client,
    `/sap/bw/modeling/trfn/${trfnId}/m`,
    "",
    "inactive",
    "application/vnd.sap.bw.modeling.trfn-v1_0_0+xml"
  )
}

/**
 * Update Transformation - 更新转换内容
 *
 * 对应请求: PUT /sap/bw/modeling/trfn/{trfn_id}/{version}?lockHandle={lockHandle}
 *
 * @param client - ADT HTTP 客户端
 * @param trfnId - Transformation ID
 * @param content - Transformation XML 内容
 * @param lockHandle - 锁定句柄
 * @param version - 版本 (默认 "m" = active)
 * @returns 更新结果
 */
export async function updateTransformation(
  client: AdtHTTP,
  trfnId: string,
  content: string,
  lockHandle: string,
  version: "m" | "a" | "d" = "m"
): Promise<ActivationResult> {
  const response = await client.request(
    `/sap/bw/modeling/trfn/${trfnId}/${version}?lockHandle=${lockHandle}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/vnd.sap.bw.modeling.trfn-v1_0_0+xml",
        "Accept": "application/vnd.sap.bw.modeling.trfn-v1_0_0+xml"
      },
      body: content
    }
  )

  return parseActivationResponse(response.body)
}

/**
 * Activate Transformation - 激活转换
 *
 * @param client - ADT HTTP 客户端
 * @param trfnId - Transformation ID
 * @returns 激活结果
 */
export async function activateTransformation(
  client: AdtHTTP,
  trfnId: string
): Promise<ActivationResult> {
  return activateObject(
    client,
    `/sap/bw/modeling/trfn/${trfnId}/m`,
    "",  // lockHandle 为空表示只检查不修改
    "inactive",
    "application/vnd.sap.bw.modeling.trfn-v1_0_0+xml"
  )
}

/**
 * Parse Transformation Versions Response - 解析转换版本历史响应
 */
function parseTransformationVersions(body: string): TransformationVersion[] {
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

    // Extract version from URI or link
    const selfLink = links.find((link: any) => link["@_rel"] === "self")
    let uri = (selfLink as any)?.["@_href"] || id
    // 确保 uri 是字符串
    if (uri && typeof uri !== "string") {
      uri = String(uri)
    }

    // Parse version from URI (last segment like /m, /a, /d)
    const versionMatch = uri.match(/\/([mad])$/)
    const version = versionMatch ? versionMatch[1] : "m"

    // Map version codes to descriptions
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
 * Parse Transformation Details - 解析转换详细信息
 */
function parseTransformationDetails(raw: any): TransformationDetails {
  // The raw response structure may vary, extract key information
  // This is a simplified parser - adjust based on actual response format

  const root = raw["trfn:transformation"] || raw

  return {
    name: root["trfn:name"] || root["name"] || "",
    source: root["trfn:source"] || root["source"] || "",
    target: root["trfn:target"] || root["target"] || "",
    description: root["trfn:description"] || root["description"],
    objVers: root["trfn:objVers"] || root["objVers"] || "M",
    sourceType: root["trfn:sourceType"],
    targetType: root["trfn:targetType"],
    ruleCount: root["trfn:ruleCount"],
    status: root["trfn:status"]
  }
}
