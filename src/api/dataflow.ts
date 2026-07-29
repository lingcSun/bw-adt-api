import * as t from "io-ts"
import { fullParse, xmlArray, xmlNode, orUndefined } from "../utilities"
import { AdtHTTP } from "../AdtHTTP"

// ============================================================================
// Types and Codecs for DMOD Data Flow Model
// ============================================================================

/**
 * Dataflow Node Type - 数据流节点对应的 BW 对象类型
 */
export type DataflowNodeType =
  | "ADSO"   // Advanced DataStore Object
  | "TRFN"   // Transformation
  | "DTPA"   // Data Transfer Process
  | "IOBJ"   // InfoObject
  | "RSDS"   // DataSource
  | "LSYS"   // Source System (Logical System)
  | "ISRC"   // InfoSource
  | "CUBE"   // InfoCube
  | string   // 允许其他类型

/**
 * Dataflow Node - 数据流图中的一个节点
 *
 * - 对象节点 (ADSO/RSDS/LSYS): objectDescription 是对象自身的描述
 * - 关系节点 (TRFN/DTPA): objectDescription 是 "SOURCE -> TARGET" 格式
 */
export const DataflowNode = t.type({
  nodeId: t.string,
  objectType: t.string,
  objectName: t.string,
  objectDescription: orUndefined(t.string),
  objectStatus: orUndefined(t.string),
  objectSubType: orUndefined(t.string),
  persistent: orUndefined(t.boolean),
  exists: orUndefined(t.boolean)
})

export type DataflowNode = t.OutputOf<typeof DataflowNode>

/**
 * Parsed relation extracted from a TRFN/DTPA node's "SOURCE -> TARGET" description
 */
export interface DataflowRelation {
  /** 关系节点 (TRFN 或 DTPA) */
  type: "TRFN" | "DTPA"
  /** 关系对象的技术名称 (32位 ID) */
  name: string
  /** 原始描述,如 "ADSO ZL_FID01 -> ADSO ZL_FID40" */
  description: string
  /** 源对象类型 (如 "ADSO") */
  sourceType: string
  /** 源对象名称 (如 "ZL_FID01") */
  sourceName: string
  /** 目标对象类型 (如 "ADSO") */
  targetType: string
  /** 目标对象名称 (如 "ZL_FID40") */
  targetName: string
  /** 节点状态 (active/inactive) */
  status?: string
}

/**
 * Dataflow Model - 完整的数据流模型
 */
export interface DataflowModel {
  /** 起点对象名称 */
  rootObjectName: string
  /** 起点对象类型 */
  rootObjectType: string
  /** 所有节点 */
  nodes: DataflowNode[]
  /** 从 TRFN/DTPA 节点的 "SOURCE -> TARGET" 描述中解析出的关系列表 */
  relations: DataflowRelation[]
}

/**
 * Dataflow expansion direction - 数据流展开方向
 *
 * 注意：这里的 upstream/downstream 从**业务数据流**角度定义（数据流向），
 * 与 SAP 端点参数名 levelupwards/leveldownwards 相反：
 *
 * - "upstream" (上游)：汇入 root 的来源链（DataSource → ... → root）
 *   → SAP 端点用 leveldownwards
 *   例：查 ZL_FID40 时返回 0FI_ACDOCA_10、ZS_FID01 等数据来源
 *
 * - "downstream" (下游)：root 流出的目标链（root → ... → 消费者）
 *   → SAP 端点用 levelupwards
 *   例：查 ZL_FID01 时返回 ZL_FID40（因为 ZL_FID01 的数据流向 ZL_FID40）
 *
 * - "both" (默认)：同时向上、向下展开
 */
export type DataflowDirection = "upstream" | "downstream" | "both"

/**
 * Options for dataflow query
 */
export interface DataflowOptions {
  /**
   * 展开方向 (默认 "both")
   */
  direction?: DataflowDirection
  /**
   * 展开层数
   * - `-1` (默认): 递归展开到尽头
   * - 正整数: 只展开 N 层
   */
  levels?: number
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get Dataflow Model - 获取对象的数据流血缘图
 *
 * 对应请求: GET /sap/bw/modeling/dmod/8TRANSIENT?objecttype={type}&objectname={name}&{levelupwards|leveldownwards}={n}
 *
 * 创建一个临时 (transient) 数据流模型,从指定对象出发展开上下游关系。
 * 返回的节点中,TRFN/DTPA 节点的 description 格式为 "SOURCE -> TARGET",
 * 已自动解析为结构化的 relations 列表。
 *
 * 实测 (ZL_FID40, direction="upstream"): 40 个节点,覆盖来源链
 *   DataSource → TRFN → ADSO → ... → ZL_FID40
 *
 * @param client - ADT HTTP 客户端
 * @param objectName - 起点对象名称 (如 "ZL_FID40")
 * @param objectType - 起点对象类型 (如 "ADSO"),默认 "ADSO"
 * @param options - 展开选项 (direction, levels)
 * @returns 数据流模型 (含节点和关系)
 */
export async function getDataflow(
  client: AdtHTTP,
  objectName: string,
  objectType: string = "ADSO",
  options?: DataflowOptions
): Promise<DataflowModel> {
  const direction = options?.direction ?? "both"
  const levels = options?.levels ?? -1

  const qs: Record<string, string> = {
    objecttype: objectType,
    objectname: objectName
  }
  // 业务方向 → SAP 端点参数 (方向相反,见 DataflowDirection 注释)
  if (direction === "upstream" || direction === "both") {
    qs.leveldownwards = String(levels)
  }
  if (direction === "downstream" || direction === "both") {
    qs.levelupwards = String(levels)
  }

  const response = await client.request("/sap/bw/modeling/dmod/8TRANSIENT", {
    method: "GET",
    qs,
    headers: {
      Accept: "application/vnd.sap.bw.modeling.dmod-v1_0_0+xml"
    }
  })

  return parseDataflow(response.body, objectName, objectType)
}

/**
 * Get Dataflow Lineage - 查询从指定来源到指定目标的转换和 DTP
 *
 * 典型场景: "查来源是 ZL_FID01 的 ZL_FID40 的转换和 DTP"
 *
 * 内部调用 getDataflow 获取完整血缘图,然后过滤出 sourceName 和 targetName 同时匹配的关系。
 *
 * 实测 (source="ZL_FID01", target="ZL_FID40"): 返回 2 条关系
 *   - TRFN 0H519LNPR8FQY94PC60F48MJH87KEUT3
 *   - DTPA DTP_ET0916OM0DNHSHAP1BKTB6DJP
 *
 * @param client - ADT HTTP 客户端
 * @param targetName - 目标对象名称 (如 "ZL_FID40")
 * @param sourceName - 源对象名称 (如 "ZL_FID01")
 * @param targetType - 目标对象类型 (默认 "ADSO")
 * @param options - 展开选项
 * @returns 匹配的关系列表 (TRFN + DTPA)
 */
export async function getDataflowLineage(
  client: AdtHTTP,
  targetName: string,
  sourceName: string,
  targetType: string = "ADSO",
  options?: DataflowOptions
): Promise<DataflowRelation[]> {
  const model = await getDataflow(client, targetName, targetType, options)
  const srcUpper = sourceName.toUpperCase()
  const tgtUpper = targetName.toUpperCase()
  return model.relations.filter(
    r => r.sourceName.toUpperCase() === srcUpper && r.targetName.toUpperCase() === tgtUpper
  )
}

// ============================================================================
// Parsing helpers
// ============================================================================

/**
 * Parse dataflow XML response
 */
function parseDataflow(
  body: string,
  rootObjectName: string,
  rootObjectType: string
): DataflowModel {
  const parsed = fullParse(body)
  const df = xmlNode(parsed, "dmod:dataflow")

  if (!df) {
    throw new Error("Invalid dataflow response: no dmod:dataflow root element")
  }

  const rawNodes = xmlArray(df, "node")
  const nodes: DataflowNode[] = rawNodes.map((n: any) => ({
    nodeId: n["@_nodeID"] || "",
    objectType: n["@_objectType"] || "",
    objectName: n["@_objectName"] || "",
    objectDescription: n["@_objectDescription"],
    objectStatus: n["@_objectStatus"],
    objectSubType: n["@_objectSubType"],
    persistent: n["@_persistent"] === "true",
    exists: n["@_exists"] === "true"
  }))

  // 从 TRFN/DTPA 节点的 "SOURCE -> TARGET" 描述中解析关系
  const relations: DataflowRelation[] = []
  for (const n of rawNodes as any[]) {
    const type = n["@_objectType"]
    if (type !== "TRFN" && type !== "DTPA") continue
    const rel = parseRelation(n)
    if (rel) relations.push(rel)
  }

  return {
    rootObjectName,
    rootObjectType,
    nodes,
    relations
  }
}

/**
 * Parse a TRFN/DTPA node into a structured relation.
 *
 * Description format examples:
 *   "ADSO ZL_FID01 -> ADSO ZL_FID40"
 *   "RSDS 2LIS_13_VDITM S4QCLNT700 -> ADSO ZS_SDD04"
 *   "D:ADSO ZS_FID01 -> ADSO ZL_FID01"
 *   "ZTEST:ADSO ZS_FID01 -> ADSO ZL_FID01 测试"
 */
function parseRelation(node: any): DataflowRelation | null {
  const type = node["@_objectType"] as "TRFN" | "DTPA"
  const name = node["@_objectName"] || ""
  const description = node["@_objectDescription"] || ""
  const status = node["@_objectStatus"]

  // 按 " -> " (或 "->") 分割源和目标
  // 注意 description 可能带前缀 "D:" / "ZTEST:" 等,先去掉箭头前的前缀
  const arrowIdx = description.indexOf("->")
  if (arrowIdx < 0) return null

  const leftRaw = description.slice(0, arrowIdx).trim()
  const rightRaw = description.slice(arrowIdx + 2).trim()

  const { type: sourceType, name: sourceName } = parseObjectRef(leftRaw)
  const { type: targetType, name: targetName } = parseObjectRef(rightRaw)

  return {
    type,
    name,
    description,
    sourceType,
    sourceName,
    targetType,
    targetName,
    status
  }
}

/**
 * Parse an object reference like "ADSO ZL_FID01" or "RSDS 2LIS_13_VDITM S4QCLNT700".
 *
 * 格式: [prefix:]TYPE NAME [extra]
 * - 第一个 token 是类型 (可能带 "D:" / "ZTEST:" 前缀,需去除)
 * - 第二个 token 是对象名
 * - 后续 token (如 source system) 忽略,只取类型和名
 */
function parseObjectRef(ref: string): { type: string; name: string } {
  // 去掉前缀 (如 "D:", "ZTEST:", "F:", "ZD:", "D_")
  let cleaned = ref
  const colonIdx = cleaned.indexOf(":")
  if (colonIdx > 0 && colonIdx < 10) {
    // 短前缀,可能是 "D:" 这种修饰符
    cleaned = cleaned.slice(colonIdx + 1).trim()
  }

  const tokens = cleaned.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return { type: "", name: "" }

  // 第一个 token 是类型,第二个是名称
  // 但有些名称含空格后的附加信息 (如 source system),只取前两个
  const type = tokens[0] || ""
  const name = tokens[1] || ""
  return { type, name }
}
