import * as t from "io-ts"
import { fullParse, xmlArray, xmlNode, orUndefined } from "../utilities"
import { AdtHTTP } from "../AdtHTTP"

// ============================================================================
// BW Repository (repo) — InfoProvider 结构查询
//
// 本模块曾有的 infoObjects / infoObjectDetails / infoObjectCatalogs
// （GET /sap/bc/adt/bw/objects/*）已移除——该服务树整体 404（父路径亦不存在，
// 属服务未注册而非路径错误）。InfoObject 读路径见 src/api/infoobject.ts
// （/sap/bw/modeling/iobj）与 src/api/search.ts。
// ============================================================================

/**
 * Infoprovider Structure Type - InfoProvider 结构查询的类型段
 *
 * iobj_cha / iobj_kyf / iobj / adso 四值均返回 200（无内容时为空 feed，不报错）。
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
 * （建模/查询设计器左侧 InfoProvider 结构树同款端点）
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
  // qs/路径值一律传原始串（勿预编码）；area 段在 URL 路径中，encodeURIComponent 归这里管
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
