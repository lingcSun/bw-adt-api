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
// ============================================================================

/**
 * Query InfoAreas - 查询信息区域列表
 *
 * @param client - ADT HTTP 客户端
 * @param parentName - 父信息区域名称（可选，用于层级查询）
 * @returns InfoArea 列表
 */
export async function infoAreas(
  client: AdtHTTP,
  parentName?: string
): Promise<InfoArea[]> {
  const qs = parentName ? { parent: parentName } : {}
  const response = await client.request("/sap/bc/adt/bw/objects/infoarea", {
    method: "GET",
    qs
  })

  const parsed = fullParse(response.body)
  const root = xmlNode(parsed, "infoareas:collection") ||
               xmlNode(parsed, "infoarea:collection")

  if (!root) return []

  const areas = xmlArray(root, "infoarea:infoarea", "infoarea:element")
  return areas.map((area: any) => validateParseResult(InfoArea.decode({
    name: xmlNodeAttr(area)?.name || area.name,
    techName: xmlNodeAttr(area)?.techName || area.techName,
    description: area.description || xmlNodeAttr(area)?.description,
    links: area.links
  })))
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

/**
 * Create InfoArea - 创建信息区域
 *
 * @param client - ADT HTTP 客户端
 * @param name - InfoArea 名称
 * @param description - 描述
 * @param transport - 传输请求号
 * @returns 创建结果
 */
export async function createInfoArea(
  client: AdtHTTP,
  name: string,
  description: string = "",
  transport: string = ""
): Promise<void> {
  const qs: Record<string, string> = {}
  if (transport) qs["transport"] = transport

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<infoarea:create xmlns:infoarea="http://www.sap.com/bw/adt/infoarea">
  <infoarea:name>${name}</infoarea:name>
  ${description ? `<infoarea:description>${description}</infoarea:description>` : ""}
</infoarea:create>`

  await client.request("/sap/bc/adt/bw/objects/infoarea", {
    method: "POST",
    qs,
    body,
    headers: { "Content-Type": "application/xml" }
  })
}

/**
 * Create InfoObject - 创建信息对象
 *
 * @param client - ADT HTTP 客户端
 * @param options - 创建选项
 * @returns 创建结果
 */
export interface CreateInfoObjectOptions {
  name: string              // 技术名称
  infoArea: string          // 所属 InfoArea
  type: InfoObjectType      // 对象类型
  description: string       // 描述
  catalog?: string          // 所属目录
  dataType?: string         // 数据类型
  length?: number           // 长度
  transport?: string        // 传输请求号
}

export async function createInfoObject(
  client: AdtHTTP,
  options: CreateInfoObjectOptions
): Promise<void> {
  const qs: Record<string, string> = {}
  if (options.transport) qs["transport"] = options.transport

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<infoobject:create xmlns:infoobject="http://www.sap.com/bw/adt/infoobject">
  <infoobject:name>${options.name}</infoobject:name>
  <infoobject:infoarea>${options.infoArea}</infoobject:infoarea>
  <infoobject:type>${options.type}</infoobject:type>
  <infoobject:description>${options.description}</infoobject:description>
  ${options.catalog ? `<infoobject:catalog>${options.catalog}</infoobject:catalog>` : ""}
  ${options.dataType ? `<infoobject:dataType>${options.dataType}</infoobject:dataType>` : ""}
  ${options.length ? `<infoobject:length>${options.length}</infoobject:length>` : ""}
</infoobject:create>`

  await client.request("/sap/bc/adt/bw/objects/infoobject", {
    method: "POST",
    qs,
    body,
    headers: { "Content-Type": "application/xml" }
  })
}

/**
 * Delete InfoObject - 删除信息对象
 *
 * @param client - ADT HTTP 客户端
 * @param name - InfoObject 名称
 * @param transport - 传输请求号
 * @returns 删除结果
 */
export async function deleteInfoObject(
  client: AdtHTTP,
  name: string,
  transport: string
): Promise<void> {
  await client.request(`/sap/bc/adt/bw/objects/infoobject/${name}`, {
    method: "DELETE",
    qs: { transport }
  })
}

/**
 * Activate InfoObject - 激活信息对象
 *
 * @param client - ADT HTTP 客户端
 * @param name - InfoObject 名称
 * @param transport - 传输请求号
 * @returns 激活结果
 */
export async function activateInfoObject(
  client: AdtHTTP,
  name: string,
  transport: string
): Promise<void> {
  await client.request(`/sap/bc/adt/bw/objects/infoobject/${name}/activate`, {
    method: "POST",
    qs: { transport },
    headers: { "Content-Type": "application/xml" }
  })
}
