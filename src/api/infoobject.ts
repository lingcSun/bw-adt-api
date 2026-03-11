import * as t from "io-ts"
import { orUndefined } from "../utilities"
import { AdtHTTP } from "../AdtHTTP"
import { fullParse, xmlNodeAttr, xmlArray, xmlNode } from "../utilities"

// ============================================================================
// Types and Codecs for InfoObject (BW InfoObject)
// Based on: /sap/bw/modeling/iobj (v2_1_0)
// ============================================================================

/**
 * InfoObject Text - InfoObject 文本描述
 */
export const InfoObjectText = t.type({
  language: orUndefined(t.string),
  shortText: orUndefined(t.string),
  longText: orUndefined(t.string)
})

export type InfoObjectText = t.OutputOf<typeof InfoObjectText>

/**
 * InfoObject TLogo Properties - InfoObject 技术属性
 */
export const InfoObjectTLogoProperties = t.type({
  name: orUndefined(t.string),
  type: orUndefined(t.string),
  description: orUndefined(t.string),
  responsible: orUndefined(t.string),
  masterLanguage: orUndefined(t.string),
  masterSystem: orUndefined(t.string),
  changedAt: orUndefined(t.string),
  changedBy: orUndefined(t.string),
  createdAt: orUndefined(t.string),
  createdBy: orUndefined(t.string),
  language: orUndefined(t.string),
  infoArea: orUndefined(t.string),
  objectVersion: orUndefined(t.string),
  objectStatus: orUndefined(t.string),
  contentState: orUndefined(t.string),
  package: orUndefined(t.string)
})

export type InfoObjectTLogoProperties = t.OutputOf<typeof InfoObjectTLogoProperties>

/**
 * InfoObject Details - InfoObject 详细信息
 */
export const InfoObjectDetails = t.type({
  name: t.string,
  technicalName: t.string,
  description: orUndefined(t.string),
  infoObjectType: orUndefined(t.string),  // CHA, KF, etc.
  dataType: orUndefined(t.string),        // CHAR, NUMC, DEC, etc.
  length: orUndefined(t.number),
  decimals: orUndefined(t.number),
  shortDescription: orUndefined(t.string),
  longDescription: orUndefined(t.string),
  attributeOnly: orUndefined(t.boolean),
  outputLength: orUndefined(t.number),
  fieldName: orUndefined(t.string),
  dataElement: orUndefined(t.string),
  infoArea: orUndefined(t.string),
  objectVersion: orUndefined(t.string),
  objectStatus: orUndefined(t.string),
  texts: orUndefined(t.array(InfoObjectText)),
  tlogoProperties: orUndefined(InfoObjectTLogoProperties),
  // DDIC 关联表
  sidTable: orUndefined(t.string),
  textTable: orUndefined(t.string),
  masterDataTable: orUndefined(t.string),
  attributeSIDTable: orUndefined(t.string)
})

export type InfoObjectDetails = t.OutputOf<typeof InfoObjectDetails>

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get InfoObject Options - 获取 InfoObject 选项
 */
export interface GetInfoObjectOptions {
  notransientinfoobject?: boolean
  lastChangedTimestampDb?: boolean
}

/**
 * Get InfoObject Details - 获取 InfoObject 详细信息
 *
 * 对应请求: GET /sap/bw/modeling/iobj/{iobj_name}/a
 *
 * @param client - ADT HTTP 客户端
 * @param iobjName - InfoObject 名称 (如 0NAME, 0CUSTOMER)
 * @param options - 查询选项
 * @returns InfoObject 详细信息
 */
export async function getInfoObject(
  client: AdtHTTP,
  iobjName: string,
  options?: GetInfoObjectOptions
): Promise<InfoObjectDetails> {
  const qs: Record<string, string> = {}
  if (options?.notransientinfoobject !== undefined) {
    qs.notransientinfoobject = options.notransientinfoobject.toString()
  }
  if (options?.lastChangedTimestampDb !== undefined) {
    qs.last_changed_timestamp_db = options.lastChangedTimestampDb.toString()
  }

  const response = await client.request(
    `/sap/bw/modeling/iobj/${iobjName.toLowerCase()}/a`,
    {
      method: "GET",
      qs,
      headers: {
        "Accept": "application/vnd.sap-bw-modeling.iobj-v2_1_0+xml, " +
                 "application/vnd.sap-bw-modeling.iobj-v2_0_0+xml, " +
                 "application/vnd.sap-bw-modeling.iobj-v1_9_0+xml, " +
                 "application/vnd.sap-bw-modeling.iobj-v1_8_0+xml, " +
                 "application/vnd.sap-bw-modeling.iobj-v1_7_0+xml, " +
                 "application/vnd.sap-bw-modeling.iobj-v1_6_0+xml, " +
                 "application/vnd.sap-bw-modeling.iobj-v1_5_0+xml, " +
                 "application/vnd.sap-bw-modeling.iobj-v1_4_0+xml, " +
                 "application/vnd.sap-bw-modeling.iobj-v1_3_0+xml, " +
                 "application/vnd.sap-bw-modeling.iobj-v1_2_0+xml, " +
                 "application/vnd.sap-bw-modeling.iobj-v1_1_0+xml, " +
                 "application/vnd.sap-bw-modeling.iobj-v1_0_0+xml"
      }
    }
  )

  return parseInfoObjectDetails(response.body)
}

/**
 * Get InfoObject Active Version - 获取 InfoObject 活跃版本
 *
 * 对应请求: GET /sap/bw/modeling/iobj/{iobj_name}/m
 *
 * @param client - ADT HTTP 客户端
 * @param iobjName - InfoObject 名称
 * @returns InfoObject 元数据
 */
export async function getInfoObjectMetadata(
  client: AdtHTTP,
  iobjName: string
): Promise<any> {
  const response = await client.request(
    `/sap/bw/modeling/iobj/${iobjName.toLowerCase()}/m`,
    {
      method: "GET",
      headers: {
        "Accept": "application/vnd.sap-bw-modeling.iobj-v2_1_0+xml"
      }
    }
  )

  return fullParse(response.body)
}

// ============================================================================
// Parse Functions
// ============================================================================

/**
 * Parse InfoObject Details Response - 解析 InfoObject 详细信息响应
 */
function parseInfoObjectDetails(raw: any): InfoObjectDetails {
  const root = raw["iobj:infoObject"] || raw
  const tlogoProps = root["tlogoProperties"] || {}
  const attrs = xmlNodeAttr(root)

  // 解析 texts 数组
  const textsArray = xmlArray(root, "texts")
  const texts: InfoObjectText[] = textsArray.map((textNode: any) => {
    const textAttrs = xmlNodeAttr(textNode)
    return {
      language: textAttrs?.["@_language"] || textAttrs?.language,
      shortText: textAttrs?.["@_shortText"] || textNode?.shortText,
      longText: textAttrs?.["@_longText"] || textNode?.longText
    }
  })

  // 解析数据类型信息
  const inlineType = root["inlineType"]
  let dataType: string | undefined
  let length: number | undefined
  let decimals: number | undefined
  if (inlineType) {
    const typeAttrs = xmlNodeAttr(inlineType)
    dataType = typeAttrs?.["@_name"] || inlineType.name
    length = typeAttrs?.["@_length"] || inlineType.length
    decimals = typeAttrs?.["@_precision"] || inlineType.precision
  }

  // 解析 DDIC 表信息
  const masterDataProps = root["masterDataProperties"]
  const textProps = root["textProperties"]

  return {
    name: attrs?.["@_name"] || root.name || "",
    technicalName: attrs?.["@_name"] || root.name || "",
    description: root.longDescription || root.shortDescription || tlogoProps["@_description"],
    infoObjectType: root.infoObjectType || attrs?.["@_xsi:type"],
    dataType: dataType || root.dataType,
    length: length ? Number(length) : root.length ? Number(root.length) : undefined,
    decimals: decimals ? Number(decimals) : undefined,
    shortDescription: root.shortDescription,
    longDescription: root.longDescription,
    attributeOnly: attrs?.["@_attributeOnly"] === "true",
    outputLength: attrs?.["@_outputLength"] ? Number(attrs?.["@_outputLength"]) : undefined,
    fieldName: attrs?.["@_fieldName"],
    dataElement: root.dataElement?.["@_name"] || root.dataElement?.name,
    infoArea: tlogoProps.infoArea,
    objectVersion: tlogoProps.objectVersion,
    objectStatus: tlogoProps.objectStatus,
    texts,
    tlogoProperties: {
      name: tlogoProps["@_name"],
      type: tlogoProps["@_type"],
      description: tlogoProps["@_description"],
      responsible: tlogoProps["@_responsible"],
      masterLanguage: tlogoProps["@_masterLanguage"],
      masterSystem: tlogoProps["@_masterSystem"],
      changedAt: tlogoProps["@_changedAt"],
      changedBy: tlogoProps["@_changedBy"],
      createdAt: tlogoProps["@_createdAt"],
      createdBy: tlogoProps["@_createdBy"],
      language: tlogoProps["@_language"],
      infoArea: tlogoProps.infoArea,
      objectVersion: tlogoProps.objectVersion,
      objectStatus: tlogoProps.objectStatus,
      contentState: tlogoProps.contentState,
      package: tlogoProps.packageRef?.["@_name"]
    },
    sidTable: root.sidTable?.["@_name"] || root.sidTable?.name,
    textTable: textProps?.textTable?.["@_name"] || textProps?.textTable?.name,
    masterDataTable: masterDataProps?.masterDataTable?.["@_name"] || masterDataProps?.masterDataTable?.name,
    attributeSIDTable: masterDataProps?.attributeSIDTable?.["@_name"] || masterDataProps?.attributeSIDTable?.name
  }
}
