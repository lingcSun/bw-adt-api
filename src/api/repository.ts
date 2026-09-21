import * as t from "io-ts"
import { fullParse, xmlNodeAttr, xmlArray, xmlNode, followUrl, orUndefined } from "../utilities"
import { AdtHTTP } from "../AdtHTTP"
import { validateParseResult } from "../AdtException"

// ============================================================================
// Types and Codecs for BW Repository Objects
// ============================================================================

/**
 * InfoArea - BW 信息区域
 * InfoArea 是 BW 中 InfoObjects 的组织单元
 */
export const InfoAreaAttributes = t.type({
  name: t.string,
  description: orUndefined(t.string),
  techName: t.string
})

export const InfoAreaLink = t.type({
  href: t.string,
  type: orUndefined(t.string),
  rel: orUndefined(t.string)
})

export const InfoArea = t.type({
  name: t.string,
  techName: t.string,
  description: orUndefined(t.string),
  links: orUndefined(t.array(InfoAreaLink))
})

export type InfoArea = t.OutputOf<typeof InfoArea>

/**
 * InfoObject Type - 信息对象类型
 */
export enum InfoObjectType {
  CHA = "CHA",      // 特征 (Characteristic)
  KF = "KF",        // 关键指标 (Key Figure)
  DTA = "DTA",      // 数据存储对象 (DataStore Object)
  ICU = "ICU",      // 单位 (Unit)
  TIM = "TIM",      // 时间特性 (Time Characteristic)
  UNIT = "UNIT",    // 单位
  TYPM = "TYPM"     // 类型 (Type)
}

/**
 * InfoObject - BW 信息对象
 */
export const InfoObjectMetaData = t.partial({
  "adtcore:type": t.string,
  "adtcore:uri": t.string,
  "bw:infoobject": t.string,
  "bw:description": t.string,
  "bw:infoareaname": t.string,
  "bw:objvers": t.string  // 对象版本: M, D, A (修改中、已删除、活动)
})

export const InfoObject = t.type({
  name: t.string,
  techName: t.string,
  infoArea: t.string,
  type: orUndefined(t.string),
  description: orUndefined(t.string),
  version: orUndefined(t.string),  // M = Active, D = Revised, A = Modified
  uri: orUndefined(t.string),
  metaData: orUndefined(InfoObjectMetaData)
})

export type InfoObject = t.OutputOf<typeof InfoObject>

/**
 * InfoObjectCatalog - 信息对象目录
 */
export const InfoObjectCatalog = t.type({
  name: t.string,
  type: orUndefined(t.string),  // CHACatalog = 特征目录, KFCatalog = 关键指标目录
  description: orUndefined(t.string),
  infoArea: t.string,
  content: orUndefined(t.array(t.string))  // 包含的 InfoObjects
})

export type InfoObjectCatalog = t.OutputOf<typeof InfoObjectCatalog>

// ============================================================================
// API Functions
//
// 注意：本模块的 /sap/bc/adt/bw/objects/* 端点均未在 docs/VERIFIED_APIS.md
// 建立证据记录，也未暴露在 BWAdtClient 上。InfoObject 的已验证读写走
// src/api/infoobject.ts（/sap/bw/modeling/iobj）。此处仅保留只读查询；
// 曾有的 infoAreas / createInfoArea / createInfoObject / deleteInfoObject /
// activateInfoObject 因未验证已移除（2026-09 审查）。
//
// getInfoproviderStructure 走 /sap/bw/modeling/repo/infoproviderstructure
// （2026-09-21 真机验证，证据见 VERIFIED_APIS 第 7 节）。
// ============================================================================

/**
 * Infoprovider Structure Type - InfoProvider 结构查询的类型段
 *
 * 实测 (2026-09-21)：iobj_cha / iobj_kyf / iobj / adso 四值均返回 200
 * （无内容的组合返回空 feed，不报错）。
 */
export type InfoproviderStructureType = "iobj_cha" | "iobj_kyf" | "iobj" | "adso"

/**
 * Infoprovider Structure Entry - InfoProvider 结构条目
 *
 * 响应为 atom:feed，每个 atom:entry 的 atom:content 内是 bwModel:object
 * （objectName/objectType/objectSubtype/objectStatus 属性），
 * atom:id 为对象 URI、atom:title 为描述。
 */
export const InfoproviderStructureEntry = t.type({
  objectName: t.string,
  objectType: orUndefined(t.string),        // 如 IOBJ
  objectSubtype: orUndefined(t.string),     // 如 CHA
  objectStatus: orUndefined(t.string),      // 如 active
  uri: orUndefined(t.string),
  title: orUndefined(t.string)              // 描述
})

export type InfoproviderStructureEntry = t.OutputOf<typeof InfoproviderStructureEntry>

/**
 * Get Infoprovider Structure - 查询 InfoArea 下可用于查询定义的对象树
 *
 * 对应请求: GET /sap/bw/modeling/repo/infoproviderstructure/area/{area}/{type}
 * （Eclipse 建模/查询设计器左侧导航同款；2026-09-21 真机验证）
 *
 * @param client - ADT HTTP 客户端
 * @param infoArea - InfoArea 技术名（大小写不敏感，进 URL 前转小写）
 * @param type - 结构类型段，默认 iobj_cha（特征）
 * @returns 结构条目列表（无内容时为空数组）
 */
export async function getInfoproviderStructure(
  client: AdtHTTP,
  infoArea: string,
  type: InfoproviderStructureType | string = "iobj_cha"
): Promise<InfoproviderStructureEntry[]> {
  // qs/路径值一律传原始串（V5 教训：不预编码）；area 段在 URL 路径中，encodeURIComponent 归这里管
  const response = await client.request(
    `/sap/bw/modeling/repo/infoproviderstructure/area/${encodeURIComponent(infoArea.toLowerCase())}/${type}`,
    {
      method: "GET",
      headers: { Accept: "application/atom+xml;type=feed" }
    }
  )
  return parseInfoproviderStructure(response.body)
}

/**
 * Parse Infoprovider Structure Response - 解析结构 feed
 */
export function parseInfoproviderStructure(body: string): InfoproviderStructureEntry[] {
  const parsed = fullParse(body)
  const feed = xmlNode(parsed, "atom:feed")
  if (!feed) return []

  return xmlArray(feed, "atom:entry").map((entry: any) => {
    const obj = xmlNode(xmlNode(entry, "atom:content"), "bwModel:object") || {}
    return {
      objectName: obj["@_objectName"] || "",
      objectType: obj["@_objectType"],
      objectSubtype: obj["@_objectSubtype"],
      objectStatus: obj["@_objectStatus"],
      uri: xmlNode(entry, "atom:id") || undefined,
      title: xmlNode(entry, "atom:title") || undefined
    }
  })
}

/**
 * Query InfoObjects - 查询信息对象列表
 *
 * @param client - ADT HTTP 客户端
 * @param options - 查询选项
 * @returns InfoObject 列表
 */
export interface InfoObjectsOptions {
  infoArea?: string
  type?: InfoObjectType
  pattern?: string     // 名称过滤模式
  version?: string     // M=Active, D=Revised, A=Modified
}

export async function infoObjects(
  client: AdtHTTP,
  options: InfoObjectsOptions = {}
): Promise<InfoObject[]> {
  const qs: Record<string, string> = {}
  if (options.infoArea) qs["infoarea"] = options.infoArea
  if (options.type) qs["type"] = options.type
  if (options.pattern) qs["pattern"] = options.pattern
  if (options.version) qs["version"] = options.version

  const response = await client.request("/sap/bc/adt/bw/objects/infoobject", {
    method: "GET",
    qs
  })

  const parsed = fullParse(response.body)
  const root = xmlNode(parsed, "infoobjects:collection") ||
               xmlNode(parsed, "infoobject:collection")

  if (!root) return []

  const objects = xmlArray(root, "infoobject:object", "infoobject:element")
  return objects.map((obj: any) => {
    const attrs = xmlNodeAttr(obj) || {}
    return validateParseResult(InfoObject.decode({
      name: attrs.name || obj.name,
      techName: attrs.techName || obj.techName,
      infoArea: attrs.infoArea || obj.infoArea || options.infoArea || "",
      type: attrs.type || obj.type,
      description: attrs.description || obj.description,
      version: attrs.objvers || obj.version,
      uri: attrs.uri || obj.uri
    }))
  })
}

/**
 * Get InfoObject Details - 获取信息对象详细信息
 *
 * @param client - ADT HTTP 客户端
 * @param infoObjectName - InfoObject 技术名称
 * @param version - 对象版本（M=Active, D=Revised, A=Modified）
 * @returns InfoObject 详细信息
 */
export async function infoObjectDetails(
  client: AdtHTTP,
  infoObjectName: string,
  version: string = "M"
): Promise<InfoObject> {
  const response = await client.request(
    `/sap/bc/adt/bw/objects/infoobject/${infoObjectName}`,
    {
      method: "GET",
      qs: { version }
    }
  )

  const parsed = fullParse(response.body)
  const root = xmlNode(parsed, "infoobject:object") ||
               xmlNode(parsed, "bw:infoobject")

  if (!root) {
    throw new Error(`InfoObject ${infoObjectName} not found`)
  }

  const attrs = xmlNodeAttr(root) || {}
  return validateParseResult(InfoObject.decode({
    name: attrs.name || root.name,
    techName: infoObjectName,
    infoArea: attrs.infoArea || root.infoArea,
    type: attrs.type || root.type,
    description: attrs.description || root.description,
    version: attrs.objvers || version,
    uri: attrs.uri
  }))
}

/**
 * Query InfoObjectCatalogs - 查询信息对象目录
 *
 * @param client - ADT HTTP 客户端
 * @param infoArea - 信息区域名称
 * @param type - 目录类型 (CHACatalog=特征目录, KFCatalog=关键指标目录)
 * @returns InfoObjectCatalog 列表
 */
export async function infoObjectCatalogs(
  client: AdtHTTP,
  infoArea: string,
  type: "CHACatalog" | "KFCatalog" = "CHACatalog"
): Promise<InfoObjectCatalog[]> {
  const response = await client.request("/sap/bc/adt/bw/objects/infocatalog", {
    method: "GET",
    qs: {
      infoarea: infoArea,
      type
    }
  })

  const parsed = fullParse(response.body)
  const root = xmlNode(parsed, "catalogs:collection") ||
               xmlNode(parsed, "catalog:collection")

  if (!root) return []

  const catalogs = xmlArray(root, "catalog:element", "catalog:catalog")
  return catalogs.map((cat: any) => {
    const attrs = xmlNodeAttr(cat) || {}
    return validateParseResult(InfoObjectCatalog.decode({
      name: attrs.name || cat.name,
      type: attrs.type || type,
      description: attrs.description || cat.description,
      infoArea: attrs.infoArea || infoArea
    }))
  })
}
