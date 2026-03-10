import * as t from "io-ts"
import { fullParse, xmlNodeAttr, xmlArray, xmlNode, orUndefined } from "../utilities"
import { AdtHTTP } from "../AdtHTTP"

// ============================================================================
// Types and Codecs for BW System Information
// ============================================================================

/**
 * Database Information
 */
export const DatabaseInfo = t.type({
  name: t.string,
  type: t.string,
  version: orUndefined(t.string),
  patchlevel: orUndefined(t.string),
  connect: orUndefined(t.partial({
    host: t.string,
    instance: t.string,
    port: t.string
  })),
  schema: orUndefined(t.string)
})

export type DatabaseInfo = t.OutputOf<typeof DatabaseInfo>

/**
 * System Property
 */
export const SystemProperty = t.type({
  name: t.string,
  value: t.string
})

export type SystemProperty = t.OutputOf<typeof SystemProperty>

/**
 * System Capabilities
 */
export const SystemCapabilities = t.type({
  properties: orUndefined(t.array(SystemProperty)),
  dbInfo: orUndefined(DatabaseInfo),
  changeability: orUndefined(t.type({
    bwChangeable: t.boolean,
    basisChangeable: t.boolean
  }))
})

export type SystemCapabilities = t.OutputOf<typeof SystemCapabilities>

// ============================================================================
// API Functions
// ============================================================================

/**
 * Query System Information - 获取 BW 系统信息和能力
 *
 * 对应请求: GET /sap/bw/modeling/repo/is/systeminfo
 *
 * @param client - ADT HTTP 客户端
 * @returns 系统能力信息
 */
export async function systemInfo(
  client: AdtHTTP
): Promise<SystemCapabilities> {
  const response = await client.request("/sap/bw/modeling/repo/is/systeminfo", {
    method: "GET"
  })

  return parseSystemInfoResponse(response.body)
}

/**
 * Parse System Info Response - 解析系统信息响应
 * 实际响应格式: ATOM Feed with multiple entries
 */
function parseSystemInfoResponse(body: string): SystemCapabilities {
  const parsed = fullParse(body)
  const feed = xmlNode(parsed, "atom:feed")

  if (!feed) {
    throw new Error("Invalid system info response format")
  }

  const entries = xmlArray(feed, "atom:entry")
  const result: SystemCapabilities = {
    properties: [],
    dbInfo: undefined,
    changeability: undefined
  }

  for (const entry of entries) {
    const content = xmlNode(entry, "atom:content")
    if (!content) continue

    // Parse dbInfo
    const dbInfoNode = xmlNode(content, "dbInfo:dbInfo")
    if (dbInfoNode) {
      const connectAttr = xmlNodeAttr(dbInfoNode?.connect) || {}
      result.dbInfo = {
        name: dbInfoNode["dbInfo:name"] || "",
        type: dbInfoNode["dbInfo:type"] || "",
        version: dbInfoNode["dbInfo:version"],
        patchlevel: dbInfoNode["dbInfo:patchlevel"],
        connect: dbInfoNode["dbInfo:connect"] ? {
          host: dbInfoNode["dbInfo:connect"]?.["@_host"],
          instance: dbInfoNode["dbInfo:connect"]?.["@_instance"],
          port: dbInfoNode["dbInfo:connect"]?.["@_port"]
        } : undefined,
        schema: dbInfoNode["dbInfo:schema"]
      }
    }

    // Parse sysInfo properties
    const sysInfoNode = xmlNode(content, "sysInfo:properties")
    if (sysInfoNode) {
      const props = xmlArray(sysInfoNode, "sysInfo:property")
      result.properties = props.map((prop: any) => ({
        name: prop["@_name"] || "",
        value: prop["@_value"] || ""
      }))
    }

    // Parse changeability info
    const chgInfoNode = xmlNode(content, "chgInfo:changeability")
    if (chgInfoNode) {
      result.changeability = {
        bwChangeable: chgInfoNode["@_bwChangeable"] === "true",
        basisChangeable: chgInfoNode["@_basisChangeable"] === "true"
      }
    }
  }

  return result
}

/**
 * Get System Property - 获取特定系统属性值
 *
 * @param client - ADT HTTP 客户端
 * @param propertyName - 属性名称
 * @returns 属性值或 undefined
 */
export async function getSystemProperty(
  client: AdtHTTP,
  propertyName: string
): Promise<string | undefined> {
  const info = await systemInfo(client)
  const prop = info.properties?.find(p => p.name === propertyName)
  return prop?.value
}

/**
 * Check System Capability - 检查系统是否支持某个功能
 *
 * 常用属性名：
 * - bw.planning_supported - 是否支持计划
 * - bw.nls_supported - 是否支持 NLS
 * - bw.transprov_supported - 是否支持转换提供者
 * - bw.hana_exit_supported - 是否支持 HANA Exit
 * - bw.processchain.enable_in_bwmt - 是否在 BWMT 中启用进程链
 *
 * @param client - ADT HTTP 客户端
 * @param capabilityName - 功能属性名称
 * @returns 是否支持
 */
export async function hasCapability(
  client: AdtHTTP,
  capabilityName: string
): Promise<boolean> {
  const value = await getSystemProperty(client, capabilityName)
  return value === "X"
}
