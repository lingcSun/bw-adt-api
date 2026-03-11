import * as t from "io-ts"
import { fullParse, xmlNodeAttr, xmlArray, xmlNode, orUndefined } from "../utilities"
import { AdtHTTP } from "../AdtHTTP"

// ============================================================================
// Types and Codecs for BW Search
// ============================================================================

/**
 * BW Object Type - BW 对象类型（用于搜索）
 */
export enum SearchObjectType {
  ADSO = "ADSO",           // Advanced DataStore Object
  DTPA = "DTPA",           // Data Transfer Process
  TRFN = "TRFN",           // Transformation
  INFOCUBE = "INFOCUBE",   // InfoCube
  DSO = "DSO",             // DataStore Object
  IOBJ = "IOBJ",           // InfoObject
  CHA = "CHA",             // Characteristic
  KF = "KF",               // Key Figure
  QUERY = "QUERY",         // Query
  PROCESS_CHAIN = "PROCS_CHAIN"  // Process Chain
}

/**
 * BW Object Status - BW 对象状态
 */
export enum BWObjectStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  MODIFIED = "objectVersion:A"
}

/**
 * BW Search Result - BW 搜索结果
 */
export const BWSearchResult = t.type({
  objectName: t.string,
  objectType: t.string,
  technicalObjectName: t.string,
  objectStatus: orUndefined(t.string),
  objectVersion: orUndefined(t.string),  // M=Active, A=Modified, D=Revised
  uri: orUndefined(t.string),
  title: orUndefined(t.string)
})

export type BWSearchResult = t.OutputOf<typeof BWSearchResult>

/**
 * BW Search Options - BW 搜索选项
 */
export interface BWSearchOptions {
  searchTerm: string                 // 搜索关键词
  searchInName?: boolean             // 是否在名称中搜索
  searchInDescription?: boolean      // 是否在描述中搜索
  objectType?: SearchObjectType | string // 对象类型过滤
  createdOnFrom?: string             // 创建日期起始 (ISO 8601)
  createdOnTo?: string               // 创建日期结束 (ISO 8601)
  changedOnFrom?: string             // 修改日期起始 (ISO 8601)
  changedOnTo?: string               // 修改日期结束 (ISO 8601)
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Search BW Objects - 搜索 BW 对象
 *
 * 对应请求: GET /sap/bw/modeling/repo/is/bwsearch
 *
 * @param client - ADT HTTP 客户端
 * @param options - 搜索选项
 * @returns 搜索结果列表
 */
export async function searchBWObjects(
  client: AdtHTTP,
  options: BWSearchOptions
): Promise<BWSearchResult[]> {
  const qs: Record<string, string> = {
    searchTerm: options.searchTerm,
    searchInName: options.searchInName !== false ? "true" : "false",
    searchInDescription: options.searchInDescription !== false ? "true" : "false",
    objectType: options.objectType || "",
    createdOnFrom: options.createdOnFrom || "1970-01-01T00:00:00Z",
    createdOnTo: options.createdOnTo || new Date().toISOString().split('.')[0] + "Z",
    changedOnFrom: options.changedOnFrom || "1970-01-01T00:00:00Z",
    changedOnTo: options.changedOnTo || new Date().toISOString().split('.')[0] + "Z"
  }

  const response = await client.request("/sap/bw/modeling/repo/is/bwsearch", {
    method: "GET",
    qs
  })

  return parseBWSearchResponse(response.body)
}

/**
 * Parse BW Search Response - 解析 BW 搜索响应
 * 实际响应格式: ATOM Feed with search result entries
 */
function parseBWSearchResponse(body: string): BWSearchResult[] {
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

    // Find self link
    const selfLink = links.find((link: any) => link["@_rel"] === "self")

    const attrs = bwObject ? xmlNodeAttr(bwObject) : {}

    return {
      objectName: attrs?.objectName || bwObject?.["@_objectName"] || "",
      objectType: attrs?.objectType || bwObject?.["@_objectType"] || "",
      technicalObjectName: attrs?.technicalObjectName || bwObject?.["@_technicalObjectName"] || "",
      objectStatus: attrs?.objectStatus || bwObject?.["@_objectStatus"],
      objectVersion: attrs?.objectVersion || bwObject?.["@_objectVersion"],
      uri: id || (selfLink as any)?.["@_href"] || "",
      title: title || ""
    }
  })
}

/**
 * Quick Search - 快速搜索（简化版）
 *
 * @param client - ADT HTTP 客户端
 * @param searchTerm - 搜索关键词
 * @param objectType - 可选的对象类型过滤
 * @returns 搜索结果列表
 */
export async function quickSearch(
  client: AdtHTTP,
  searchTerm: string,
  objectType?: SearchObjectType | string
): Promise<BWSearchResult[]> {
  return searchBWObjects(client, {
    searchTerm,
    objectType
  })
}

/**
 * Search by Object Type - 按对象类型搜索
 *
 * @param client - ADT HTTP 客户端
 * @param objectType - 对象类型
 * @param options - 额外的搜索选项
 * @returns 搜索结果列表
 */
export async function searchByObjectType(
  client: AdtHTTP,
  objectType: SearchObjectType | string,
  options: Partial<BWSearchOptions> = {}
): Promise<BWSearchResult[]> {
  return searchBWObjects(client, {
    searchTerm: options.searchTerm || "*",
    objectType,
    searchInName: options.searchInName,
    searchInDescription: options.searchInDescription,
    createdOnFrom: options.createdOnFrom,
    createdOnTo: options.createdOnTo,
    changedOnFrom: options.changedOnFrom,
    changedOnTo: options.changedOnTo
  })
}
