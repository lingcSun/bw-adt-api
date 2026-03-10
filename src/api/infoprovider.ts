import * as t from "io-ts"
import { fullParse, xmlNodeAttr, xmlArray, xmlNode, followUrl, orUndefined } from "../utilities"
import { AdtHTTP } from "../AdtHTTP"
import { validateParseResult } from "../AdtException"

// ============================================================================
// Types and Codecs for BW InfoProvider Objects
// ============================================================================

/**
 * InfoProvider Type - 信息提供者类型
 */
export enum InfoProviderType {
  INFOCUBE = "INFOCUBE",           // InfoCube
  DSO = "DSO",                     // DataStore Object
  ADSO = "ADSO",                   // Advanced DataStore Object
  INFOOBJECT = "INFOOBJECT",       // InfoObject (作为 provider)
  AGGREGATE = "AGGREGATE",         // 聚合
  HYBRIDPROVIDER = "HYBRIDPROVIDER", // 混合提供者
  VIRTPROV = "VIRTPROV",           // 虚拟提供者
  OPENODSTARGET = "OPENODSTARGET", // Open ODS Target
  QUERY = "QUERY",                 // 查询
  RSPC = "RSPC",                   // Process Chain
  AREA = "AREA",                   // InfoArea
  TRFN = "TRFN",                   // Transformation
  DTPA = "DTPA"                    // Data Transfer Process
}

/**
 * InfoProvider 元数据属性
 */
export const InfoProviderAttributes = t.type({
  name: t.string,
  type: orUndefined(t.string),
  description: orUndefined(t.string),
  infoArea: orUndefined(t.string),
  objVers: orUndefined(t.string),  // M=Active, D=Revised, A=Modified
  version: orUndefined(t.string),
  technicalName: t.string
})

/**
 * InfoProvider 结构节点
 */
export interface InfoProviderNode {
  name: string
  techName: string
  type?: string
  description?: string
  isLeaf?: boolean
  children?: InfoProviderNode[]
}

/**
 * InfoProvider 完整结构
 */
export interface InfoProviderStructure {
  name: string
  techName: string
  type: string
  description?: string
  infoArea?: string
  objVers?: string
  uri?: string
  childrenUri?: string
  nodes?: InfoProviderNode[]
  metaData?: any
}

/**
 * InfoProvider 列表项
 */
export interface InfoProviderListItem {
  name: string
  techName: string
  type: string
  description?: string
  infoArea?: string
  objVers?: string
  uri?: string
}

// ============================================================================
// API Functions - 基于 /sap/bw/modeling/repo/infoproviderstructure
// ============================================================================

/**
 * Query InfoProvider Structure - 查询 InfoProvider 结构树
 *
 * 对应请求: GET /sap/bw/modeling/repo/infoproviderstructure
 *
 * @param client - ADT HTTP 客户端
 * @param options - 查询选项
 * @returns InfoProvider 结构树
 */
export interface InfoProviderStructureOptions {
  infoProvider?: string      // 特定 InfoProvider 名称
  infoArea?: string          // 按 InfoArea 过滤
  type?: InfoProviderType    // 按类型过滤
  depth?: number             // 查询深度
  includeInactive?: boolean  // 包含非活动对象
}

export async function infoProviderStructure(
  client: AdtHTTP,
  options: InfoProviderStructureOptions = {}
): Promise<InfoProviderStructure[]> {
  const qs: Record<string, string | number> = {}

  if (options.infoProvider) qs["infoprovider"] = options.infoProvider
  if (options.infoArea) qs["infoarea"] = options.infoArea
  if (options.type) qs["type"] = options.type
  if (options.depth) qs["depth"] = options.depth
  if (options.includeInactive) qs["inactive"] = "true"

  const response = await client.request("/sap/bw/modeling/repo/infoproviderstructure", {
    method: "GET",
    qs
  })

  return parseInfoProviderStructureResponse(response.body)
}

/**
 * Parse InfoProvider Structure Response - 解析结构响应
 * 实际响应格式: ATOM Feed with InfoArea entries
 */
function parseInfoProviderStructureResponse(body: string): InfoProviderStructure[] {
  const parsed = fullParse(body)

  // ATOM Feed 格式响应 (实际格式)
  const atomFeed = xmlNode(parsed, "atom:feed")
  if (atomFeed) {
    return parseAtomFeed(atomFeed)
  }

  // 可能的其他 XML 根节点格式
  const root = xmlNode(parsed, "infoprovider:structure") ||
               xmlNode(parsed, "bw:infoproviderstructure") ||
               xmlNode(parsed, "structure:collection")

  if (!root) {
    // 如果是单个 provider
    if (parsed.name || parsed["infoprovider:name"]) {
      return [parseSingleInfoProvider(parsed)]
    }
    return []
  }

  // 处理集合
  const providers = xmlArray(root, "infoprovider:element", "infoprovider:provider", "provider")
  return providers.map((p: any) => parseSingleInfoProvider(p))
}

/**
 * Parse ATOM Feed Response - 解析 ATOM Feed 格式响应
 * 对应实际响应: <atom:feed><atom:entry>...InfoArea...</atom:entry></atom:feed>
 */
function parseAtomFeed(feed: any): InfoProviderStructure[] {
  const entries = xmlArray(feed, "atom:entry")

  return entries.map((entry: any) => {
    const content = xmlNode(entry, "atom:content")
    const bwObject = xmlNode(content, "bwModel:object")
    const title = xmlNode(entry, "atom:title")
    const id = xmlNode(entry, "atom:id")
    const links = xmlArray(entry, "atom:link")

    // 提取 links 中的 children URL
    const childrenLink = links.find((link: any) =>
      link["@_rel"] === "http://www.sap.com/bw/modeling/relations:children"
    )

    // 提取 self URL
    const selfLink = links.find((link: any) => link["@_rel"] === "self")

    const attrs = bwObject ? xmlNodeAttr(bwObject) : {}

    return {
      name: title || "",
      techName: attrs?.objectName || bwObject?.["@_objectName"] || "",
      type: attrs?.objectType || bwObject?.["@_objectType"] || "AREA",
      description: title || "",
      infoArea: attrs?.objectName || bwObject?.["@_objectName"] || "",
      objVers: "M",
      uri: id || (selfLink as any)?.["@_href"] || "",
      childrenUri: (childrenLink as any)?.["@_href"] || "",
      metaData: { entry, bwObject, links }
    }
  })
}

function parseSingleInfoProvider(data: any): InfoProviderStructure {
  const attrs = xmlNodeAttr(data) || {}

  // 解析子节点
  const children = xmlArray(data, "children", "nodes", "infoprovider:children")
  const parsedChildren = children.map((child: any) => parseInfoProviderNode(child))

  return {
    name: attrs.description || attrs.name || data.description || data.name || "",
    techName: attrs.technicalName || attrs.name || data.name || "",
    type: attrs.type || data.type || "",
    description: attrs.description || data.description,
    infoArea: attrs.infoArea || data.infoArea,
    objVers: attrs.objVers || data.objVers,
    uri: attrs.uri || data.uri,
    childrenUri: attrs.childrenUri || data.childrenUri,
    nodes: parsedChildren.length > 0 ? parsedChildren : undefined,
    metaData: data
  }
}

function parseInfoProviderNode(data: any): InfoProviderNode {
  const attrs = xmlNodeAttr(data) || {}
  const children = xmlArray(data, "children", "nodes", "child")

  return {
    name: attrs.description || attrs.name || data.name || "",
    techName: attrs.technicalName || attrs.techName || data.techName || data.name || "",
    type: attrs.type || data.type,
    description: attrs.description || data.description,
    isLeaf: attrs.isLeaf === "true" || attrs.isLeaf === true || children.length === 0,
    children: children.length > 0
      ? children.map((c: any) => parseInfoProviderNode(c))
      : undefined
  }
}

/**
 * Query InfoProviders - 查询 InfoProvider 列表
 *
 * @param client - ADT HTTP 客户端
 * @param options - 查询选项
 * @returns InfoProvider 列表
 */
export async function infoProviders(
  client: AdtHTTP,
  options: InfoProviderStructureOptions = {}
): Promise<InfoProviderListItem[]> {
  const structures = await infoProviderStructure(client, options)

  return structures.map(s => ({
    name: s.name,
    techName: s.techName,
    type: s.type,
    description: s.description,
    infoArea: s.infoArea,
    objVers: s.objVers,
    uri: s.uri
  }))
}

/**
 * Get InfoProvider Details - 获取单个 InfoProvider 详细信息
 *
 * @param client - ADT HTTP 客户端
 * @param infoProviderName - InfoProvider 技术名称
 * @param options - 查询选项
 * @returns InfoProvider 结构详情
 */
export async function infoProviderDetails(
  client: AdtHTTP,
  infoProviderName: string,
  options: Omit<InfoProviderStructureOptions, "infoProvider"> = {}
): Promise<InfoProviderStructure> {
  const result = await infoProviderStructure(client, {
    ...options,
    infoProvider: infoProviderName
  })

  if (result.length === 0) {
    throw new Error(`InfoProvider ${infoProviderName} not found`)
  }

  return result[0]
}

/**
 * Create InfoProvider - 创建 InfoProvider
 *
 * @param client - ADT HTTP 客户端
 * @param options - 创建选项
 * @returns 创建结果
 */
export interface CreateInfoProviderOptions {
  name: string                  // 技术名称
  type: InfoProviderType        // 类型
  description: string           // 描述
  infoArea: string              // 信息区域
  template?: string             // 模板 InfoProvider
  transport?: string            // 传输请求号
}

export async function createInfoProvider(
  client: AdtHTTP,
  options: CreateInfoProviderOptions
): Promise<void> {
  const qs: Record<string, string> = {}
  if (options.transport) qs["transport"] = options.transport

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<infoprovider:create xmlns:infoprovider="http://www.sap.com/bw/adt/infoprovider">
  <infoprovider:name>${options.name}</infoprovider:name>
  <infoprovider:type>${options.type}</infoprovider:type>
  <infoprovider:description>${options.description}</infoprovider:description>
  <infoprovider:infoarea>${options.infoArea}</infoprovider:infoarea>
  ${options.template ? `<infoprovider:template>${options.template}</infoprovider:template>` : ""}
</infoprovider:create>`

  await client.request("/sap/bw/modeling/repo/infoprovider", {
    method: "POST",
    qs,
    body,
    headers: { "Content-Type": "application/xml" }
  })
}

/**
 * Query InfoProvider Children - 查询 InfoProvider 子节点
 *
 * 支持的子节点类型:
 * - adso: Advanced DataStore Objects
 * - trfn: Transformations
 * - dtpa: Data Transfer Processes
 *
 * 对应请求:
 * - GET /sap/bw/modeling/repo/infoproviderstructure/area/{area}/adso
 * - GET /sap/bw/modeling/repo/infoproviderstructure/adso/{adso}/trfn
 * - GET /sap/bw/modeling/repo/infoproviderstructure/adso/{adso}/dtpa
 *
 * @param client - ADT HTTP 客户端
 * @param parentPath - 父节点路径 (如: "area/ZBW_LDL_FI", "adso/ZL_FID01")
 * @param childType - 子节点类型 (adso, trfn, dtpa 等)
 * @returns 子节点列表
 */
export async function infoProviderChildren(
  client: AdtHTTP,
  parentPath: string,
  childType: "adso" | "trfn" | "dtpa" | "area" = "adso"
): Promise<InfoProviderStructure[]> {
  const path = `/sap/bw/modeling/repo/infoproviderstructure/${parentPath}/${childType}`
  const response = await client.request(path, {
    method: "GET"
  })

  return parseInfoProviderStructureResponse(response.body)
}

/**
 * Query InfoArea Children - 查询 InfoArea 下的 ADSO 列表
 *
 * 对应请求: GET /sap/bw/modeling/repo/infoproviderstructure/area/{area}/adso
 *
 * @param client - ADT HTTP 客户端
 * @param areaName - InfoArea 名称
 * @returns ADSO 列表
 */
export async function infoAreaADSOs(
  client: AdtHTTP,
  areaName: string
): Promise<InfoProviderStructure[]> {
  return infoProviderChildren(client, `area/${areaName.toLowerCase()}`, "adso")
}

/**
 * Query ADSO Transformations - 查询 ADSO 关联的 Transformations
 *
 * 对应请求: GET /sap/bw/modeling/repo/infoproviderstructure/adso/{adso}/trfn
 *
 * @param client - ADT HTTP 客户端
 * @param adsoName - ADSO 名称
 * @returns Transformation 列表
 */
export async function adsoTransformations(
  client: AdtHTTP,
  adsoName: string
): Promise<InfoProviderStructure[]> {
  return infoProviderChildren(client, `adso/${adsoName.toLowerCase()}`, "trfn")
}

/**
 * Query ADSO DTPs - 查询 ADSO 关联的 Data Transfer Processes
 *
 * 对应请求: GET /sap/bw/modeling/repo/infoproviderstructure/adso/{adso}/dtpa
 *
 * @param client - ADT HTTP 客户端
 * @param adsoName - ADSO 名称
 * @returns DTP 列表
 */
export async function adsoDTPs(
  client: AdtHTTP,
  adsoName: string
): Promise<InfoProviderStructure[]> {
  return infoProviderChildren(client, `adso/${adsoName.toLowerCase()}`, "dtpa")
}

/**
 * Delete InfoProvider - 删除 InfoProvider
 *
 * @param client - ADT HTTP 客户端
 * @param name - InfoProvider 名称
 * @param transport - 传输请求号
 * @returns 删除结果
 */
export async function deleteInfoProvider(
  client: AdtHTTP,
  name: string,
  transport: string
): Promise<void> {
  await client.request(`/sap/bw/modeling/repo/infoprovider/${name}`, {
    method: "DELETE",
    qs: { transport }
  })
}

/**
 * Activate InfoProvider - 激活 InfoProvider
 *
 * @param client - ADT HTTP 客户端
 * @param name - InfoProvider 名称
 * @param transport - 传输请求号
 * @returns 激活结果
 */
export async function activateInfoProvider(
  client: AdtHTTP,
  name: string,
  transport: string
): Promise<void> {
  await client.request(`/sap/bw/modeling/repo/infoprovider/${name}/activate`, {
    method: "POST",
    qs: { transport }
  })
}
