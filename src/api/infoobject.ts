import * as t from "io-ts"
import { orUndefined } from "../utilities"
import { AdtHTTP, session_types } from "../AdtHTTP"
import { fullParse, xmlNodeAttr, xmlArray, xmlNode } from "../utilities"
import {
  ValidationAction,
  ValidationResult,
  validateObject,
  LockResult,
  ActivationResult,
  parseActivationResponse
} from "./common"
import { BWObject, BWObjectType } from "./bwObject"

// ============================================================================
// Types and Codecs for InfoObject (BW InfoObject)
// Based on: /sap/bw/modeling/iobj (v2_1_0)
// ============================================================================

// Re-export Validation types for convenience
export { ValidationAction, ValidationResult } from "./common"

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
  attributeSIDTable: orUndefined(t.string),
  // 主数据/文本/层次 的存在性标志与附加表
  withMasterData: orUndefined(t.boolean),
  masterDataView: orUndefined(t.string),
  timeDependentMasterDataTable: orUndefined(t.string),
  withTexts: orUndefined(t.boolean),
  longTextAvailable: orUndefined(t.boolean),
  withHierarchies: orUndefined(t.boolean),
  hierarchyTable: orUndefined(t.string),
  // 单位/货币语义 —— 判定该 IOBJ 能否作为金额/数量的单位或货币字段
  unitsOfMeasureForCharacteristic: orUndefined(t.string),
  currencyAttribute: orUndefined(t.string),
  // 其他常用元数据
  displayProperties: orUndefined(t.unknown),
  runtimeProperties: orUndefined(t.unknown),
  numberRangeObjects: orUndefined(t.array(t.unknown)),
  attributeN: orUndefined(t.array(t.unknown)),
  hanaAttributeMapping: orUndefined(t.array(t.unknown))
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
    `/sap/bw/modeling/iobj/${encodeURIComponent(iobjName.toLowerCase())}/a`,
    {
      method: "GET",
      qs,
      headers: {
        "Accept": "application/vnd.sap-bw-modeling.iobj-v2_4_0+xml, " +
                 "application/vnd.sap-bw-modeling.iobj-v2_3_0+xml, " +
                 "application/vnd.sap-bw-modeling.iobj-v2_2_0+xml, " +
                 "application/vnd.sap-bw-modeling.iobj-v2_1_0+xml, " +
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
    `/sap/bw/modeling/iobj/${encodeURIComponent(iobjName.toLowerCase())}/m`,
    {
      method: "GET",
      headers: {
        "Accept": "application/vnd.sap-bw-modeling.iobj-v2_4_0+xml, " +
                 "application/vnd.sap-bw-modeling.iobj-v2_1_0+xml"
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
 *
 * `raw` 可能已经是解析后的树，也可能是原始 XML 字符串（/a 端点直接返回字符串）。
 * 两种输入都要支持，否则整个解析会静默失败（所有字段 undefined）。
 */
export function parseInfoObjectDetails(raw: any): InfoObjectDetails {
  const parsed = typeof raw === "string" ? fullParse(raw) : raw
  const root = parsed?.["iobj:infoObject"] || parsed || {}
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
  const hierarchyProps = root["hierarchyProperties"]

  /** 读 `<x status="A"/>` 形式节点的 name 属性 */
  const tableName = (node: any): string | undefined =>
    node?.["@_name"] || node?.name

  /** 属性可能是 "@_x" 也可能是裸 "x"，统一取值 */
  const attr = (node: any, key: string): string | undefined =>
    node?.[`@_${key}`] ?? node?.[key]

  /** 把 true/false（可能是布尔或字符串）安全转成 boolean */
  const bool = (v: unknown): boolean | undefined =>
    typeof v === "boolean" ? v
      : v === "true" ? true
        : v === "false" ? false
          : undefined

  /**
   * 转数字但保留 0 —— 用 `!= null` 而非真值判断。
   * （KEY 指标的 <length> 可能缺省，但 0 是合法值，不能被真值判断吞掉。）
   */
  const toNum = (v: unknown): number | undefined =>
    v === undefined || v === null || v === "" ? undefined : Number(v)

  return {
    name: attrs?.["@_name"] || root.name || "",
    technicalName: attrs?.["@_name"] || root.name || "",
    description: root.longDescription || root.shortDescription || tlogoProps["@_description"],
    infoObjectType: root.infoObjectType || attrs?.["@_xsi:type"],
    dataType: dataType || root.dataType,
    length: toNum(length) ?? toNum(root.length),
    decimals: toNum(decimals),
    shortDescription: root.shortDescription,
    longDescription: root.longDescription,
    attributeOnly: attrs?.["@_attributeOnly"] === "true",
    outputLength: toNum(attrs?.["@_outputLength"]),
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
    sidTable: tableName(root.sidTable),
    textTable: tableName(textProps?.textTable),
    masterDataTable: tableName(masterDataProps?.masterDataTable),
    attributeSIDTable: tableName(masterDataProps?.attributeSIDTable),
    // 存在性标志 + 附加表（原先被丢弃）
    withMasterData: bool(attr(masterDataProps, "withMasterData")),
    masterDataView: tableName(masterDataProps?.masterDataView),
    timeDependentMasterDataTable: tableName(masterDataProps?.timeDependentMasterDataTable),
    withTexts: bool(attr(textProps, "withTexts")),
    longTextAvailable: bool(attr(textProps, "longTextAvailable")),
    withHierarchies: bool(attr(hierarchyProps, "withHierarchies")),
    hierarchyTable: tableName(hierarchyProps?.hierarchyTable),
    // 单位/货币语义：决定该 IOBJ 能否作为金额/数量的单位字段
    unitsOfMeasureForCharacteristic: attr(root.unitsOfMeasureForCharacteristic, "status"),
    currencyAttribute: attr(root.currencyAttribute, "infoObjectType"),
    // 其他常用元数据（原样透传，供调用方自行检查）
    displayProperties: root.displayProperties,
    runtimeProperties: root.runtimeProperties,
    numberRangeObjects: xmlArray(root, "numberRangeObject"),
    attributeN: xmlArray(root, "attributeN"),
    hanaAttributeMapping: xmlArray(root, "hanaAttributeMapping")
  }
}

// ============================================================================
// Validation Functions (using BWObject base class)
// ============================================================================

/**
 * Validate InfoObject Exists - 验证 InfoObject 是否存在
 *
 * @param client - ADT HTTP 客户端
 * @param iobjName - InfoObject 名称
 * @returns 验证结果
 */
export async function validateInfoObjectExists(
  client: AdtHTTP,
  iobjName: string
): Promise<ValidationResult> {
  const obj = new BWObject(client, BWObjectType.INFO_OBJECT, iobjName)
  return obj.exists()
}

/**
 * Validate New InfoObject Name - 验证新 InfoObject 名称是否可用
 *
 * @param client - ADT HTTP 客户端
 * @param iobjName - InfoObject 名称
 * @returns 验证结果
 */
export async function validateInfoObjectNewName(
  client: AdtHTTP,
  iobjName: string
): Promise<ValidationResult> {
  const obj = new BWObject(client, BWObjectType.INFO_OBJECT, iobjName)
  return obj.isNewNameAvailable()
}

/**
 * Validate InfoObject Can Delete - 验证 InfoObject 是否可删除
 *
 * @param client - ADT HTTP 客户端
 * @param iobjName - InfoObject 名称
 * @returns 验证结果
 */

/**
 * Validate InfoObject Can Activate - 验证 InfoObject 是否可激活
 *
 * @param client - ADT HTTP 客户端
 * @param iobjName - InfoObject 名称
 * @returns 验证结果
 */

// ============================================================================
// Create InfoObject
// 依据: 2026-11-10 Eclipse BWMT 抓包 (docs/VERIFIED_APIS.md §9) +
//       2026-11-12 真机对照实验 (docs/VERIFIED_APIS.md §10)
//
// 真机已证实的骨架模型（与 §9 原解读不同，见 §10）：
//   - 创建 POST（stateful，与 lock 同会话）只落「骨架 CHA」：CHAR/5/ALPHA 默认值，
//     body 除 name 外整体被忽略（type/description/infoArea/unit 全部不生效）
//   - 类型（CHA↔KYF）与 dataType（CHAR→NUMC）创建后均不可改（PUT 被拒/静默回退）
//   - 长度/描述/InfoArea 可经 PUT /m 补写（timestamp 头，stateless 可）
//   ⇒ CHA 创建 = POST 骨架 + PUT 属性 + 激活（createInfoObjectChaFull，已真机闭环）
//   ⇒ KYF 创建阻塞：向导在创建时指定类型的机制缺报文证据（§10）
// ============================================================================

/** keyfigureType / semantics（关键指标语义）。仅 AMO 有真机证据。 */
export type InfoObjectKeyfigureType = "AMO" | "QUA" | "NUM"

/** objectSpecificDataType（关键指标专用数据类型）。仅 CURR 有真机证据。 */
export type InfoObjectKfDataType = "CURR" | "QUAN" | "DEC" | "INT4" | "FLTP" | "DF34"

/** aggregationType（聚合方式）。仅 SUM 有真机证据，其余为 BW 常规枚举。 */
export type InfoObjectAggregationType = "SUM" | "MAX" | "MIN" | "AVG" | "CNT"

/**
 * InfoObject Create Options - 创建关键指标选项
 *
 * 仅支持 KYF（关键指标）。创建骨架与 Eclipse BWMT 向导 POST 同形：
 * 语义/聚合/货币单位引用等属性直接进创建 POST body（向导是创建后编辑器 PUT 补写，
 * 见 VERIFIED_APIS §9——属性能否在 POST 一步落库由 createInfoObjectFull 回读校验）。
 */
export interface InfoObjectCreateOptions {
  /** InfoObject 技术名（如 ZK_AMOUNT） */
  name: string
  /** 描述（写 longDescription / shortDescription） */
  description: string
  /** 目标 InfoArea（如 ZBW_MDL） */
  infoArea: string
  /** 关键指标语义。默认 AMO（金额，配合 CURR）。 */
  keyfigureType?: InfoObjectKeyfigureType
  /** 关键指标数据类型。默认 CURR（交易货币金额）。 */
  objectSpecificDataType?: InfoObjectKfDataType
  /** 聚合方式。默认 SUM。 */
  aggregationType?: InfoObjectAggregationType
  /** 单位/货币 InfoObject 引用（CURR→0CURRENCY、QUAN→0UNIT 类）。缺省不写引用。 */
  unitInfoObject?: string
  /** 高精度（浮点存储）。向导创建后编辑器保存为 true；缺省不写（服务端默认）。 */
  highPrecision?: boolean
  /** 主语言。默认 ZH（会话语言，由调用方传入）。 */
  masterLanguage?: string
  /** 负责人。默认当前用户（由调用方传入）。 */
  responsible?: string
  /** 主系统。默认 BPD。 */
  masterSystem?: string
  /** 开发包。缺省 "$TMP"；真实包必须配 transport（见 createInfoObject 校验）。 */
  packageName?: string
  /** 工作台请求号（corrNr）。真实包必传。 */
  transport?: string
}

/**
 * 与 Eclipse BWMT 向导创建 POST 同形的关键指标 XML（xsi:type="Keyfigure"）。
 * 证据：2026-11-17 ZK_AMT —— POST **不带** packageRef / unitCurrency（单位经后续 PUT）；
 * Development-Class 走请求头。描述可空（向导空串）。
 */
export function buildInfoObjectXml(options: InfoObjectCreateOptions): string {
  const {
    name,
    description = "",
    infoArea,
    keyfigureType = "AMO",
    objectSpecificDataType = "CURR",
    aggregationType = "SUM",
    masterLanguage = "ZH",
    responsible = "",
    masterSystem = "BPD"
  } = options

  const esc = (v: string) =>
    v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

  // POST 阶段单位引用留空（Eclipse ZK_AMT）；PUT 再写 unitCurrencyInfoObjectRef
  return `<?xml version="1.0" encoding="UTF-8"?>
<InfoObject:infoObject xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:InfoObject="http://www.sap.com/bw/modeling/BwIobj.ecore" xmlns:adtcore="http://www.sap.com/adt/core" xsi:type="InfoObject:Keyfigure" name="${esc(name)}" shortDescriptionSet="false" keyFigureSemantic="_" keyfigureType="${esc(keyfigureType)}" objectSpecificDataType="${esc(objectSpecificDataType)}">
  <infoObjectType>KYF</infoObjectType>
  <dataElement/>
  <longDescription>${esc(description)}</longDescription>
  <shortDescription>${esc(description)}</shortDescription>
  <tlogoProperties adtcore:language="${esc(masterLanguage)}" adtcore:name="${esc(name)}" adtcore:type="IOBJ" adtcore:masterLanguage="${esc(masterLanguage)}" adtcore:masterSystem="${esc(masterSystem)}" adtcore:responsible="${esc(responsible)}">
    <infoArea>${esc(infoArea)}</infoArea>
  </tlogoProperties>
  <referencedInfoObject/>
  <semantics>${esc(keyfigureType)}</semantics>
  <aggregationType>${esc(aggregationType)}</aggregationType>
  <exceptionAggregation>
    <referencedCharacteristic/>
  </exceptionAggregation>
  <unitCurrencyInfoObjectRef/>
  <displayProperties/>
  <inventoryContext/>
  <elimination/>
  <stockCoverageProperties calculationType="B">
    <referencedStockKeyfigure/>
    <referencedDemandKeyfigure/>
    <timeGranularityOfStockCoverage/>
  </stockCoverageProperties>
</InfoObject:infoObject>`
}

/**
 * Lock InfoObject - 锁定 InfoObject
 *
 * 创建路径必须带创建上下文头（2026-11-10 抓包：parent_name/parent_type=AREA/
 * activity_context=CREA 在 lock 请求头上，无请求体）。修改路径不带头。
 */
export async function lockInfoObject(
  client: AdtHTTP,
  iobjName: string,
  createHeaders?: { parentName?: string; parentType?: string }
): Promise<LockResult> {
  const headers: Record<string, string> = {}
  if (createHeaders?.parentName) {
    headers["parent_name"] = createHeaders.parentName
    headers["parent_type"] = createHeaders.parentType || "AREA"
    headers["activity_context"] = "CREA"
  }
  const obj = new BWObject(client, BWObjectType.INFO_OBJECT, iobjName)
  return obj.lock({ headers })
}

/**
 * Unlock InfoObject - 解锁 InfoObject
 */
export async function unlockInfoObject(client: AdtHTTP, iobjName: string): Promise<void> {
  const obj = new BWObject(client, BWObjectType.INFO_OBJECT, iobjName)
  return obj.unlock()
}

/**
 * Activate InfoObject - 激活 InfoObject
 *
 * 对应请求: POST /sap/bw/modeling/activation（atom feed + checkProperties lockHandle，
 * objectUri 指向 /iobj/{name}/m —— 2026-11-10 抓包同形）。
 */
export async function activateInfoObject(
  client: AdtHTTP,
  iobjName: string,
  lockHandle: string,
  corrNr?: string
): Promise<ActivationResult> {
  const obj = new BWObject(client, BWObjectType.INFO_OBJECT, iobjName)
  return obj.activate(lockHandle, corrNr)
}

/**
 * Create InfoObject KYF - POST 创建关键指标（须已持 CREA 锁）
 *
 * 证据 2026-11-17 ZK_AMT：stateless POST + Development-Class（含 $TMP），
 * body xsi:type=Keyfigure → 类型即落 KYF（与旧 stateful「只落 CHA 骨架」对照作废）。
 * createChaFull 仍走 createInfoObjectChaSkeleton（stateful 骨架），勿混用。
 */
export async function createInfoObject(
  client: AdtHTTP,
  options: InfoObjectCreateOptions,
  lockHandle: string
): Promise<void> {
  const { name, packageName = "$TMP", transport } = options

  if (packageName && packageName !== "$TMP" && !transport) {
    throw new Error(
      `createInfoObject: packageName "${packageName}" requires a transport request number — ` +
        `without it the object would silently become a $TMP local object. ` +
        `Pass transport=<TRKORR>, or set packageName="$TMP" explicitly.`
    )
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/vnd.sap-bw-modeling.iobj-v2_1_0+xml",
    Accept: "application/vnd.sap-bw-modeling.iobj-v2_1_0+xml",
    "Development-Class": packageName || "$TMP"
  }

  const corrNr =
    transport && packageName !== "$TMP"
      ? `&corrNr=${encodeURIComponent(transport)}`
      : ""

  await client.request(
    `/sap/bw/modeling/iobj/${encodeURIComponent(name.toLowerCase())}?lockHandle=${encodeURIComponent(lockHandle)}${corrNr}`,
    {
      method: "POST",
      sessionType: session_types.stateless,
      headers,
      body: buildInfoObjectXml(options)
    }
  )
}

/**
 * @deprecated CHA 骨架专用：stateful POST（body 被忽略，落 CHA/CHAR）。
 * createChaFull 使用；真 KYF 请用 createInfoObject（stateless）。
 */
export async function createInfoObjectChaSkeleton(
  client: AdtHTTP,
  options: InfoObjectCreateOptions,
  lockHandle: string
): Promise<void> {
  const { name, packageName = "$TMP", transport } = options
  if (packageName && packageName !== "$TMP" && !transport) {
    throw new Error(
      `createInfoObjectChaSkeleton: packageName "${packageName}" requires transport=<TRKORR>.`
    )
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/vnd.sap-bw-modeling.iobj-v2_1_0+xml",
    Accept: "application/vnd.sap-bw-modeling.iobj-v2_1_0+xml"
  }
  if (packageName && packageName !== "$TMP") {
    headers["Development-Class"] = packageName
  }
  const corrNr = transport ? `&corrNr=${encodeURIComponent(transport)}` : ""
  await client.request(
    `/sap/bw/modeling/iobj/${encodeURIComponent(name.toLowerCase())}?lockHandle=${encodeURIComponent(lockHandle)}${corrNr}`,
    {
      method: "POST",
      sessionType: session_types.stateful,
      headers,
      body: buildInfoObjectXml(options)
    }
  )
}

/** createInfoObjectFull 的回读校验结果（守服务端静默归一化/丢属性）。 */
export interface InfoObjectCreateVerification {
  objectStatus?: string
  aggregationType?: string
  keyfigureType?: string
  objectSpecificDataType?: string
  unitInfoObject?: string
  highPrecision?: string
  persisted: boolean
  diffs: string[]
}

/**
 * 从 GET /m 的解析树提取创建属性做回读比对。
 * （/m 是编辑器读写端点，新建未激活对象也返回 modified 版本——2026-11-10 抓包。）
 */
function verifyCreatedInfoObject(
  parsed: any,
  options: InfoObjectCreateOptions
): InfoObjectCreateVerification {
  const root = parsed?.["iobj:infoObject"] || parsed || {}
  const tlogo = root["tlogoProperties"] || {}
  const unit = root["unitCurrencyInfoObjectRef"]
  const diffs: string[] = []

  const iobjType = root["infoObjectType"]
  if (iobjType !== "KYF") {
    diffs.push(`infoObjectType: expected KYF, got ${iobjType || "<none>"}`)
  }
  const agg = root["aggregationType"]
  const expectedAgg = options.aggregationType || "SUM"
  if (agg !== expectedAgg) {
    diffs.push(`aggregationType: sent ${expectedAgg}, got ${agg}`)
  }
  const expectedUnit = options.unitInfoObject
  const gotUnit = unit?.["@_name"]
  if (expectedUnit && gotUnit !== expectedUnit) {
    diffs.push(`unitInfoObject: sent ${expectedUnit}, got ${gotUnit || "<none>"}`)
  }
  const hp = root["highPrecision"]
  if (options.highPrecision !== undefined && String(hp) !== String(options.highPrecision)) {
    diffs.push(`highPrecision: sent ${options.highPrecision}, got ${hp}`)
  }
  if (options.description) {
    const desc = root["longDescription"]
    if (desc !== options.description) {
      diffs.push(`description: sent ${options.description}, got ${desc || "<none>"}`)
    }
  }

  return {
    objectStatus: tlogo["objectStatus"] || tlogo["@_objectStatus"],
    aggregationType: agg,
    keyfigureType: root["@_keyfigureType"] || root["keyfigureType"],
    objectSpecificDataType: root["@_objectSpecificDataType"],
    unitInfoObject: gotUnit,
    highPrecision: hp !== undefined ? String(hp) : undefined,
    persisted: diffs.length === 0,
    diffs
  }
}

/** KYF PUT 补写：单位引用 / 描述 / highPrecision（对照 ZK_AMT PUT）。 */
function patchKyfDoc(
  doc: string,
  changes: {
    description?: string
    unitInfoObject?: string
    highPrecision?: boolean
  }
): string {
  let y = doc
  if (changes.description !== undefined) {
    const d = changes.description
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
    y = y.replace(/<longDescription>[^<]*<\/longDescription>/, `<longDescription>${d}</longDescription>`)
    y = y.replace(/<shortDescription>[^<]*<\/shortDescription>/, `<shortDescription>${d}</shortDescription>`)
  }
  if (changes.unitInfoObject) {
    const u = changes.unitInfoObject.replace(/"/g, "&quot;")
    // Eclipse PUT: infoObjectType="CHA" even when target is UNI (ZC_CUR)
    const unitXml = `<unitCurrencyInfoObjectRef infoObjectType="CHA" name="${u}"/>`
    if (/<unitCurrencyInfoObjectRef\/>/.test(y)) {
      y = y.replace(/<unitCurrencyInfoObjectRef\/>/, unitXml)
    } else if (/<unitCurrencyInfoObjectRef\b[^]*?\/>/.test(y)) {
      y = y.replace(/<unitCurrencyInfoObjectRef\b[^]*?\/>/, unitXml)
    } else if (/<unitCurrencyInfoObjectRef\b[^>]*>[\s\S]*?<\/unitCurrencyInfoObjectRef>/.test(y)) {
      y = y.replace(
        /<unitCurrencyInfoObjectRef\b[^>]*>[\s\S]*?<\/unitCurrencyInfoObjectRef>/,
        unitXml
      )
    }
  }
  if (changes.highPrecision !== undefined) {
    const hp = String(changes.highPrecision)
    if (/<highPrecision>[^<]*<\/highPrecision>/.test(y)) {
      y = y.replace(/<highPrecision>[^<]*<\/highPrecision>/, `<highPrecision>${hp}</highPrecision>`)
    } else {
      y = y.replace(
        /<aggregationType>/,
        `<highPrecision>${hp}</highPrecision><aggregationType>`
      )
    }
  }
  // 最小 displayProperties（Eclipse 保存形态）
  if (/<displayProperties\/>/.test(y)) {
    y = y.replace(
      /<displayProperties\/>/,
      `<displayProperties><bexDescription>0</bexDescription><decimalPlaces>2</decimalPlaces><digitsToDisplay>0</digitsToDisplay></displayProperties>`
    )
  }
  return y
}

export interface InfoObjectCreateResult {
  lockHandle: string
  transport?: string
  activated: boolean
  activateResult?: ActivationResult
  verification: InfoObjectCreateVerification
}

/**
 * Create InfoObject Full - 创建关键指标完整流程（2026-11-17 ZK_AMT 抓包重写）
 *
 * validate → lock(CREA) → POST Keyfigure(stateless) → GET → PUT 补单位/描述/
 * highPrecision → 回读校验 →（可选激活）→ finally unlock。
 *
 * 单位引用：`unitInfoObject`（如 ZC_CUR / ZC_RWCUR / 0CURRENCY）；PUT 写入
 * `infoObjectType="CHA"`（与 Eclipse 一致，即使目标是 UNI）。
 */
export async function createInfoObjectFull(
  client: AdtHTTP,
  options: InfoObjectCreateOptions & { autoActivate?: boolean }
): Promise<InfoObjectCreateResult> {
  const {
    name,
    infoArea,
    autoActivate = true,
    packageName = "$TMP",
    transport,
    unitInfoObject,
    description,
    highPrecision = true
  } = options

  if (packageName && packageName !== "$TMP" && !transport) {
    throw new Error(
      `createInfoObjectFull: packageName "${packageName}" requires transport=<TRKORR>, ` +
        `or set packageName="$TMP".`
    )
  }

  const areaValid = await validateObject(client, "AREA", infoArea, ValidationAction.EXISTS)
  if (!areaValid.valid) {
    throw new Error(`InfoArea ${infoArea} does not exist`)
  }

  const nameValid = await validateInfoObjectNewName(client, name)
  if (!nameValid.valid) {
    throw new Error(`InfoObject name "${name}" is not available: ${nameValid.message || "rejected"}`)
  }

  const lockResult = await lockInfoObject(client, name, {
    parentName: infoArea,
    parentType: "AREA"
  })

  const CT = "application/vnd.sap-bw-modeling.iobj-v2_1_0+xml"
  const uri = `/sap/bw/modeling/iobj/${encodeURIComponent(name.toLowerCase())}/m`

  try {
    await createInfoObject(client, options, lockResult.lockHandle)

    // PUT 补单位/描述（Eclipse：创建后编辑器保存）
    const get1 = await client.request(uri, {
      method: "GET",
      sessionType: session_types.stateless,
      headers: { Accept: CT }
    })
    const rawTs = get1.headers?.["timestamp"]
    const timestamp = rawTs !== undefined ? String(rawTs) : undefined
    if (!timestamp) {
      throw new Error("createInfoObjectFull: GET /m 缺 timestamp，无法 PUT")
    }
    const patched = patchKyfDoc(String(get1.body), {
      description: description || undefined,
      unitInfoObject,
      highPrecision
    })
    await client.request(uri, {
      method: "PUT",
      sessionType: session_types.stateless,
      headers: {
        "Content-Type": `application/xml, ${CT}`,
        Accept: CT,
        timestamp,
        ...(transport && packageName !== "$TMP"
          ? { "Transport-Lock-Holder": transport }
          : {})
      },
      qs: { lockHandle: lockResult.lockHandle },
      body: patched
    })

    const get2 = await client.request(uri, {
      method: "GET",
      sessionType: session_types.stateless,
      headers: { Accept: CT }
    })
    const verification = verifyCreatedInfoObject(fullParse(String(get2.body)), {
      ...options,
      highPrecision
    })

    let activated = false
    let activateResult: ActivationResult | undefined
    if (autoActivate) {
      activateResult = await activateInfoObject(
        client,
        name,
        lockResult.lockHandle,
        transport || lockResult.corrNr
      )
      activated = !!activateResult?.success
    }

    return {
      lockHandle: lockResult.lockHandle,
      transport: transport || lockResult.corrNr,
      activated,
      activateResult,
      verification
    }
  } finally {
    await unlockInfoObject(client, name)
  }
}

// ============================================================================
// Create InfoObject CHA（特征）—— 2026-11-12 真机闭环
// 模型: POST 骨架（服务端固定落 CHA/CHAR/5/ALPHA）→ PUT /m 补写属性 → 激活
// 证据: VERIFIED_APIS §10（A~I 变体对照实验）
// ============================================================================

/**
 * InfoObject CHA Create Options - 创建特征选项
 *
 * dataType 恒为 CHAR（服务端骨架默认值；NUMC/DATE 等其它类型的指定机制
 * 与 KYF 同缺报文证据，实测 PUT 改 dataType 被服务端静默回退）。
 */
export interface InfoObjectChaCreateOptions {
  /** InfoObject 技术名（如 ZC_CUSTOMER，3-9 字符，字母开头） */
  name: string
  /** 描述（写 longDescription/shortDescription/texts） */
  description: string
  /** 目标 InfoArea（如 ZGLD_TEST） */
  infoArea: string
  /** 输出长度。服务端骨架默认 5；经 PUT /m 可改（实测 5→10 落库）。 */
  length?: number
  /** 主语言。缺省 ZH。 */
  masterLanguage?: string
  /** 负责人。缺省当前用户（由门面传入；空值会使 POST 404）。 */
  responsible?: string
  /** 主系统。默认 BPD。 */
  masterSystem?: string
  /** 开发包。缺省 "$TMP"；真实包必须配 transport（同 KYF 守卫）。 */
  packageName?: string
  /** 工作台请求号（corrNr）。真实包必传。 */
  transport?: string
  /** 创建后自动激活。默认 true。 */
  autoActivate?: boolean
}

/** InfoObject 属性修改集（PUT /m 可落库的字段，2026-11-12 实测）。 */
export interface InfoObjectPropertyChanges {
  description?: string
  /** 输出长度（同步写根属性 outputLength 与 <length> 元素） */
  length?: number
  /** InfoArea（骨架落 NODESNOTCONNECTED，创建后经 PUT 归位） */
  infoArea?: string
}

/** applyInfoObjectPropertiesUnderLock 的回读校验结果。 */
export interface InfoObjectPropertyVerification {
  persisted: boolean
  diffs: string[]
  objectStatus?: string
  infoObjectType?: string
}

/**
 * 对 GET /m 文档做定向字符串替换；返回是否全部命中。
 * （骨架文档元素形态固定，字符串手术比整树重写可靠——PUT 需要完整文档，
 * 任何缺块都会被服务端以「could not be successfully saved」拒绝或静默丢弃。）
 */
function patchInfoObjectDoc(
  doc: string,
  changes: InfoObjectPropertyChanges
): { doc: string; applied: string[]; missed: string[] } {
  let y = doc
  const applied: string[] = []
  const missed: string[] = []
  const sub = (re: RegExp, to: string, tag: string) => {
    if (re.test(y)) {
      y = y.replace(re, () => to)
      applied.push(tag)
    } else {
      missed.push(tag)
    }
  }

  if (changes.description !== undefined) {
    const d = changes.description
    sub(/<longDescription>[^<]*<\/longDescription>/, `<longDescription>${d}</longDescription>`, "longDescription")
    sub(/<shortDescription>[^<]*<\/shortDescription>/, `<shortDescription>${d}</shortDescription>`, "shortDescription")
    // texts 节点的 shortText/longText 属性同步（编辑器保存形态）
    sub(/shortText="[^"]*"/, `shortText="${d}"`, "texts.shortText")
    sub(/longText="[^"]*"/, `longText="${d}"`, "texts.longText")
  }
  if (changes.length !== undefined) {
    const n = changes.length
    sub(/outputLength="\d+"/, `outputLength="${n}"`, "outputLength")
    sub(/<length>\d+<\/length>/, `<length>${n}</length>`, "length")
  }
  if (changes.infoArea !== undefined) {
    sub(/<infoArea>[^<]*<\/infoArea>/, `<infoArea>${changes.infoArea}</infoArea>`, "infoArea")
  }
  return { doc: y, applied, missed }
}

/**
 * 从 GET /m 解析树提取创建属性做回读比对（CHA 骨架场景）。
 */
function verifyInfoObjectProperties(
  parsed: any,
  changes: InfoObjectPropertyChanges
): InfoObjectPropertyVerification {
  const root = parsed?.["iobj:infoObject"] || parsed || {}
  const tlogo = root["tlogoProperties"] || {}
  const diffs: string[] = []

  const desc = root["longDescription"]
  if (changes.description !== undefined && desc !== changes.description) {
    diffs.push(`description: sent ${changes.description}, got ${desc || "<none>"}`)
  }
  const len = root["length"] !== undefined ? String(root["length"]) : root["@_outputLength"]
  if (changes.length !== undefined && String(len) !== String(changes.length)) {
    diffs.push(`length: sent ${changes.length}, got ${len ?? "<none>"}`)
  }
  const area = tlogo["infoArea"] ?? (root["tlogoProperties"]?.infoArea)
  if (changes.infoArea !== undefined && area !== changes.infoArea) {
    diffs.push(`infoArea: sent ${changes.infoArea}, got ${area || "<none>"}`)
  }

  return {
    persisted: diffs.length === 0,
    diffs,
    objectStatus: tlogo["objectStatus"],
    infoObjectType: root["infoObjectType"]
  }
}

/**
 * Apply InfoObject Properties - PUT /m 补写属性（须已持锁）
 *
 * GET /m 取 timestamp 头与文档 → 定向替换 → PUT（timestamp 头）→ GET /m 回读校验。
 * PUT 本身 stateless 可（2026-11-12 实测）；对象必须处于锁定状态。
 */
async function applyInfoObjectPropertiesUnderLock(
  client: AdtHTTP,
  name: string,
  changes: InfoObjectPropertyChanges
): Promise<InfoObjectPropertyVerification> {
  const CT = "application/vnd.sap-bw-modeling.iobj-v2_1_0+xml"
  const uri = `/sap/bw/modeling/iobj/${encodeURIComponent(name.toLowerCase())}/m`

  const get1 = await client.request(uri, {
    method: "GET",
    sessionType: session_types.stateless,
    headers: { Accept: CT }
  })
  const rawTimestamp = get1.headers?.["timestamp"]
  const timestamp = rawTimestamp !== undefined ? String(rawTimestamp) : undefined
  if (!timestamp) {
    throw new Error("applyInfoObjectProperties: GET /m 响应缺 timestamp 头，无法构造 PUT")
  }
  const { doc } = patchInfoObjectDoc(String(get1.body), changes)

  await client.request(uri, {
    method: "PUT",
    sessionType: session_types.stateless,
    headers: { "Content-Type": CT, Accept: CT, timestamp },
    body: doc
  })

  const get2 = await client.request(uri, {
    method: "GET",
    sessionType: session_types.stateless,
    headers: { Accept: CT }
  })
  return verifyInfoObjectProperties(fullParse(get2.body), changes)
}

/** createInfoObjectChaFull 的结果。 */
export interface InfoObjectChaCreateResult {
  lockHandle: string
  transport?: string
  activated: boolean
  activateResult?: ActivationResult
  verification: InfoObjectPropertyVerification
}

/**
 * Create InfoObject CHA Full - 创建特征完整流程（2026-11-12 真机闭环）
 *
 * validate InfoArea → validate 新名 → lock（parent/CREA 头）→ POST 骨架（CHA/CHAR）→
 * PUT /m 补写属性（描述/长度/InfoArea）→ 回读校验 →（可选激活）→ finally unlock。
 *
 * 服务器固定以 CHA/CHAR/5/ALPHA 骨架落库；length 可经 PUT 修改，dataType 恒为
 * CHAR（其它类型的指定机制缺报文证据，PUT 修改会被静默回退——§10）。
 *
 * @returns lockHandle + 回读校验（persisted:false 时查看 diffs）
 */
export async function createInfoObjectChaFull(
  client: AdtHTTP,
  options: InfoObjectChaCreateOptions
): Promise<InfoObjectChaCreateResult> {
  const { name, infoArea, autoActivate = true } = options

  const areaValid = await validateObject(client, "AREA", infoArea, ValidationAction.EXISTS)
  if (!areaValid.valid) {
    throw new Error(`InfoArea ${infoArea} does not exist`)
  }

  const nameValid = await validateInfoObjectNewName(client, name)
  if (!nameValid.valid) {
    throw new Error(`InfoObject name "${name}" is not available: ${nameValid.message || "rejected"}`)
  }

  const lockResult = await lockInfoObject(client, name, {
    parentName: infoArea,
    parentType: "AREA"
  })

  try {
    // POST 骨架：stateful，body 被忽略 → CHA/CHAR（勿用 createInfoObject/stateless KYF）
    await createInfoObjectChaSkeleton(client, {
      name,
      description: options.description,
      infoArea,
      packageName: options.packageName,
      transport: options.transport,
      masterLanguage: options.masterLanguage,
      responsible: options.responsible,
      masterSystem: options.masterSystem
    }, lockResult.lockHandle)

    // PUT /m 补写属性（对象已创建，普通 lock 上下文即可）
    const verification = await applyInfoObjectPropertiesUnderLock(client, name, {
      description: options.description,
      length: options.length,
      infoArea
    })

    let activated = false
    let activateResult: ActivationResult | undefined
    if (autoActivate) {
      activateResult = await activateInfoObject(
        client,
        name,
        lockResult.lockHandle,
        lockResult.corrNr
      )
      activated = !!activateResult?.success
    }

    return {
      lockHandle: lockResult.lockHandle,
      transport: lockResult.corrNr,
      activated,
      activateResult,
      verification
    }
  } finally {
    await unlockInfoObject(client, name)
  }
}

// ============================================================================
// Create InfoObject UNI（单位/币种）—— 2026-11-17 Eclipse Communication Log ZC_RWCUR
// 模型: validate → lock(CREA) → POST Unit XML（含 unitType/referencedInfoObject）→
//       回读校验 →（可选激活）→ finally unlock
// POST 即带类型：xsi:type=InfoObject:Unit + infoObjectType=UNI + dataType=CUKY
// （与 KYF「POST 只落 CHA 骨架」不同——Unit 类型在创建 POST 即生效）
// ============================================================================

/**
 * InfoObject UNI Create Options - 创建单位/币种特征
 *
 * 依据 2026-11-17 Eclipse 向导 POST ZC_RWCUR 报文。
 */
export interface InfoObjectUnitCreateOptions {
  /** InfoObject 技术名（如 ZC_RWCUR，3-9 字符） */
  name: string
  /** 描述（longDescription / shortDescription） */
  description: string
  /** 目标 InfoArea（如 ZBW_MDL） */
  infoArea: string
  /**
   * 引用的基础单位 IOBJ。币种默认 0CURRENCY；度量可用 0UNIT。
   * POST 写入 `<referencedInfoObject name="…"/>`。
   */
  referencedInfoObject?: string
  /**
   * 单位大类。CUR = 币种（dataType CUKY）；缺省 CUR。
   * 度量类（UOM 等）缺真机证据，暂不开放其它枚举。
   */
  unitType?: "CUR"
  masterLanguage?: string
  responsible?: string
  masterSystem?: string
  packageName?: string
  transport?: string
  autoActivate?: boolean
}

/** createInfoObjectUnitFull 回读校验。 */
export interface InfoObjectUnitCreateVerification {
  persisted: boolean
  diffs: string[]
  infoObjectType?: string
  dataType?: string
  unitType?: string
  referencedInfoObject?: string
  objectStatus?: string
}

export interface InfoObjectUnitCreateResult {
  lockHandle: string
  transport?: string
  activated: boolean
  activateResult?: ActivationResult
  verification: InfoObjectUnitCreateVerification
}

/**
 * 与 Eclipse BWMT 向导创建 POST 同形的单位 XML（xsi:type="InfoObject:Unit"）。
 * 证据：2026-11-17 ZC_RWCUR POST body。
 */
export function buildInfoObjectUnitXml(options: InfoObjectUnitCreateOptions): string {
  const {
    name,
    description,
    infoArea,
    referencedInfoObject = "0CURRENCY",
    unitType = "CUR",
    masterLanguage = "ZH",
    responsible = "",
    masterSystem = "BPD",
    packageName
  } = options

  const esc = (v: string) =>
    v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

  const dataType = "CUKY"
  // Eclipse：$TMP 与真实包都写 adtcore:name（ZC_CUR → "$TMP"，ZC_RWCUR → "ZBW"）
  const pkg = packageName || "$TMP"
  const pkgAttr = ` adtcore:name="${esc(pkg)}"`

  return `<?xml version="1.0" encoding="UTF-8"?>
<InfoObject:infoObject xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:InfoObject="http://www.sap.com/bw/modeling/BwIobj.ecore" xmlns:adtcore="http://www.sap.com/adt/core" xsi:type="InfoObject:Unit" name="${esc(name)}" shortDescriptionSet="false" unitType="${esc(unitType)}">
  <infoObjectType>UNI</infoObjectType>
  <dataElement/>
  <dataType>${dataType}</dataType>
  <longDescription>${esc(description)}</longDescription>
  <shortDescription>${esc(description)}</shortDescription>
  <tlogoProperties adtcore:language="${esc(masterLanguage)}" adtcore:name="${esc(name)}" adtcore:type="IOBJ" adtcore:masterLanguage="${esc(masterLanguage)}" adtcore:masterSystem="${esc(masterSystem)}" adtcore:responsible="${esc(responsible)}">
    <adtcore:packageRef${pkgAttr}/>
    <infoArea>${esc(infoArea)}</infoArea>
  </tlogoProperties>
  <referencedInfoObject name="${esc(referencedInfoObject)}"/>
  <displayProperties/>
  <sidTable/>
</InfoObject:infoObject>`
}

/**
 * Create InfoObject Unit - POST 创建单位/币种（须已持 CREA 锁）
 *
 * POST /sap/bw/modeling/iobj/{name}?lockHandle=…[&corrNr=…]
 * Headers: Development-Class（含 $TMP）、Content-Type iobj-v2_1_0+xml
 * 会话：stateless（Eclipse ZC_RWCUR / ZC_CUR；$TMP 创建无 corrNr）
 */
export async function createInfoObjectUnit(
  client: AdtHTTP,
  options: InfoObjectUnitCreateOptions,
  lockHandle: string
): Promise<void> {
  const { name, packageName = "$TMP", transport } = options

  if (packageName && packageName !== "$TMP" && !transport) {
    throw new Error(
      `createInfoObjectUnit: packageName "${packageName}" requires a transport request number — ` +
        `without it the object would silently become a $TMP local object. ` +
        `Pass transport=<TRKORR>, or set packageName="$TMP" explicitly.`
    )
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/vnd.sap-bw-modeling.iobj-v2_1_0+xml",
    Accept: "application/vnd.sap-bw-modeling.iobj-v2_1_0+xml",
    // Eclipse $TMP 向导也会带包；缺省写 $TMP，避免服务端落到错误包上下文
    "Development-Class": packageName || "$TMP"
  }

  // $TMP 本地对象不带 corrNr（Eclipse ZC_CUR）；真实包带 transport
  const corrNr =
    transport && packageName !== "$TMP"
      ? `&corrNr=${encodeURIComponent(transport)}`
      : ""

  await client.request(
    `/sap/bw/modeling/iobj/${encodeURIComponent(name.toLowerCase())}?lockHandle=${encodeURIComponent(lockHandle)}${corrNr}`,
    {
      method: "POST",
      sessionType: session_types.stateless,
      headers,
      body: buildInfoObjectUnitXml({ ...options, packageName: packageName || "$TMP" })
    }
  )
}

function verifyCreatedUnitInfoObject(
  parsed: any,
  options: InfoObjectUnitCreateOptions
): InfoObjectUnitCreateVerification {
  const root = parsed?.["iobj:infoObject"] || parsed || {}
  const tlogo = root["tlogoProperties"] || {}
  const ref = root["referencedInfoObject"]
  const diffs: string[] = []

  const iobjType = root["infoObjectType"]
  if (iobjType !== "UNI") {
    diffs.push(`infoObjectType: expected UNI, got ${iobjType || "<none>"}`)
  }
  const dataType = root["dataType"]
  if (dataType !== "CUKY") {
    diffs.push(`dataType: expected CUKY, got ${dataType || "<none>"}`)
  }
  const unitType = root["@_unitType"]
  const expectedUnitType = options.unitType || "CUR"
  if (unitType && unitType !== expectedUnitType) {
    diffs.push(`unitType: expected ${expectedUnitType}, got ${unitType}`)
  }
  const expectedRef = options.referencedInfoObject || "0CURRENCY"
  const gotRef = ref?.["@_name"]
  if (gotRef !== expectedRef) {
    diffs.push(`referencedInfoObject: expected ${expectedRef}, got ${gotRef || "<none>"}`)
  }
  const desc = root["longDescription"]
  if (options.description && desc !== options.description) {
    diffs.push(`description: expected ${options.description}, got ${desc || "<none>"}`)
  }

  return {
    persisted: diffs.length === 0,
    diffs,
    infoObjectType: iobjType,
    dataType,
    unitType,
    referencedInfoObject: gotRef,
    objectStatus: tlogo["objectStatus"] || tlogo["@_objectStatus"]
  }
}

/**
 * Create InfoObject Unit Full - 创建币种/单位完整流程
 *
 * validate InfoArea → validate 新名 → lock(parent/CREA) → POST Unit →
 * 回读校验 →（可选激活）→ finally unlock。
 *
 * 证据：2026-11-17 Eclipse ZC_RWCUR（POST 已含类型与引用；随后编辑器 PUT 仅为补全
 * displayProperties/texts，API 创建路径不强制 PUT）。
 */
export async function createInfoObjectUnitFull(
  client: AdtHTTP,
  options: InfoObjectUnitCreateOptions
): Promise<InfoObjectUnitCreateResult> {
  const { name, infoArea, autoActivate = true, packageName = "$TMP", transport } = options

  // 非 $TMP 必须带 TR；$TMP 本地创建已由 Eclipse ZC_CUR（ZGLD_TEST）证实可行
  if (packageName && packageName !== "$TMP" && !transport) {
    throw new Error(
      `createInfoObjectUnitFull: packageName "${packageName}" requires transport=<TRKORR>, ` +
        `or set packageName="$TMP" for a local object.`
    )
  }

  const areaValid = await validateObject(client, "AREA", infoArea, ValidationAction.EXISTS)
  if (!areaValid.valid) {
    throw new Error(`InfoArea ${infoArea} does not exist`)
  }

  const nameValid = await validateInfoObjectNewName(client, name)
  if (!nameValid.valid) {
    throw new Error(`InfoObject name "${name}" is not available: ${nameValid.message || "rejected"}`)
  }

  const lockResult = await lockInfoObject(client, name, {
    parentName: infoArea,
    parentType: "AREA"
  })

  try {
    await createInfoObjectUnit(client, options, lockResult.lockHandle)

    const CT = "application/vnd.sap-bw-modeling.iobj-v2_1_0+xml"
    const get = await client.request(
      `/sap/bw/modeling/iobj/${encodeURIComponent(name.toLowerCase())}/m`,
      {
        method: "GET",
        sessionType: session_types.stateless,
        headers: { Accept: CT }
      }
    )
    const verification = verifyCreatedUnitInfoObject(fullParse(String(get.body)), options)

    let activated = false
    let activateResult: ActivationResult | undefined
    if (autoActivate) {
      activateResult = await activateInfoObject(
        client,
        name,
        lockResult.lockHandle,
        options.transport || lockResult.corrNr
      )
      activated = !!activateResult?.success
    }

    return {
      lockHandle: lockResult.lockHandle,
      transport: options.transport || lockResult.corrNr,
      activated,
      activateResult,
      verification
    }
  } finally {
    await unlockInfoObject(client, name)
  }
}

// ============================================================================
// InfoObject 读 XML / 保存激活（存量编辑）
// 证据：2026-11-17 Eclipse ZK_WSL PUT —— 改 unitCurrencyInfoObjectRef → ZC_RWCUR
// ============================================================================

/** IOBJ vendor media type（编辑器读写）。 */
export const IOBJ_CONTENT_TYPE = "application/vnd.sap-bw-modeling.iobj-v2_1_0+xml"

/**
 * Extract timestamp header from IOBJ XML (adtcore:changedAt).
 * "2026-11-17T03:05:32Z" → "20261117030532"
 */
export function extractInfoObjectTimestamp(iobjXml: string): string | undefined {
  const m = iobjXml.match(
    /adtcore:changedAt="(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/
  )
  if (!m) return undefined
  return `${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}${m[6]}`
}

/**
 * Get InfoObject raw XML for PUT updates.
 * GET /sap/bw/modeling/iobj/{name}/m
 */
export async function getInfoObjectXml(
  client: AdtHTTP,
  iobjName: string,
  forceCacheUpdate: boolean = false
): Promise<string> {
  const qs = forceCacheUpdate ? { forceCacheUpdate: "true" } : undefined
  const response = await client.request(
    `/sap/bw/modeling/iobj/${encodeURIComponent(iobjName.toLowerCase())}/m`,
    {
      method: "GET",
      qs,
      sessionType: session_types.stateless,
      headers: { Accept: IOBJ_CONTENT_TYPE }
    }
  )
  return response.body
}

export async function getInfoObjectVersions(
  client: AdtHTTP,
  iobjName: string
) {
  const obj = new BWObject(client, BWObjectType.INFO_OBJECT, iobjName)
  return obj.getVersions()
}

export async function checkInfoObject(
  client: AdtHTTP,
  iobjName: string
): Promise<ActivationResult> {
  const obj = new BWObject(client, BWObjectType.INFO_OBJECT, iobjName)
  return obj.check()
}

export interface UpdateInfoObjectOptions {
  lockHandle: string
  corrNr?: string
  timestamp?: string
}

/**
 * Update InfoObject - PUT /iobj/{name}/m?lockHandle=…
 * Headers: timestamp + optional Transport-Lock-Holder（Eclipse ZK_WSL 抓包）。
 */
export async function updateInfoObject(
  client: AdtHTTP,
  iobjName: string,
  xmlContent: string,
  options: UpdateInfoObjectOptions
): Promise<ActivationResult> {
  const { lockHandle, corrNr, timestamp } = options
  const qs: Record<string, string> = { lockHandle }
  if (corrNr) qs["corrNr"] = corrNr

  const headers: Record<string, string> = {
    "Content-Type": `application/xml, ${IOBJ_CONTENT_TYPE}`,
    Accept: IOBJ_CONTENT_TYPE
  }
  if (timestamp) headers["timestamp"] = timestamp
  if (corrNr) headers["Transport-Lock-Holder"] = corrNr

  const response = await client.request(
    `/sap/bw/modeling/iobj/${encodeURIComponent(iobjName.toLowerCase())}/m`,
    {
      method: "PUT",
      qs,
      sessionType: session_types.stateless,
      headers,
      body: xmlContent
    }
  )

  return parseActivationResponse(response.body)
}

export interface SaveAndActivateInfoObjectOptions {
  transport?: string
  createTransport?: boolean
  transportDescription?: string
  autoActivate?: boolean
  timestamp?: string
}

/**
 * Save and Activate InfoObject — lock → transport → PUT → activate → unlock.
 * 证据：2026-11-17 ZK_WSL（改单位引用 ZC_RWCUR 后激活）。
 */
export async function saveAndActivateInfoObject(
  client: AdtHTTP,
  iobjName: string,
  xmlContent: string,
  options?: SaveAndActivateInfoObjectOptions
) {
  const { withWriteSession } = await import("./writeSession")
  return withWriteSession(
    client,
    {
      lock: c => lockInfoObject(c, iobjName),
      update: (c, xml, io) =>
        updateInfoObject(c, iobjName, xml, {
          lockHandle: io.lockHandle,
          corrNr: io.corrNr,
          timestamp: io.timestamp ?? extractInfoObjectTimestamp(xml)
        }),
      activate: (c, lockHandle, corrNr) =>
        activateInfoObject(c, iobjName, lockHandle, corrNr),
      unlock: c => unlockInfoObject(c, iobjName)
    },
    {
      uri: `/sap/bw/modeling/iobj/${encodeURIComponent(iobjName.toLowerCase())}/m`,
      xml: xmlContent,
      autoActivate: options?.autoActivate,
      timestamp: options?.timestamp,
      transport: options?.transport,
      createTransport: options?.createTransport,
      transportDescription: options?.transportDescription || "API IOBJ update"
    }
  )
}
