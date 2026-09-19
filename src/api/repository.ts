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
// ============================================================================

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
