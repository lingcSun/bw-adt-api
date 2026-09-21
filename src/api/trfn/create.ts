/**
 * TRFN 创建子域 —— 8TRANSIENT 瞬态流创建（Eclipse 新建转换向导同款, 2026-09-11 实测）。
 *
 * P1B Task 3 从 src/api/transformation.ts 机械搬迁（函数体零修改）。
 * 家族内依赖方向: 本模块 → ../transformation（core 锁/存原语）与 → ./shared。
 */
import { fullParse, xmlNode } from "../../utilities"
import { AdtHTTP, session_types } from "../../AdtHTTP"
import { withFreshSessionOnServerError } from "../common"
import {
  getTransformationXml,
  lockTransformation,
  unlockTransformation,
  updateTransformation
} from "../transformation"
import { escapeXmlAttr } from "./shared"

// ============================================================================
// CREATE —— 8TRANSIENT 瞬态流 (Eclipse 新建转换向导同款, 2026-09-11 实测)
// ============================================================================

export interface CreateTransformationOptions {
  sourceObjName: string
  targetObjName: string
  sourceObjType?: string // default "ADSO"
  targetObjType?: string // default "ADSO"
  /** 目标包; 默认 "$TMP"。非 $TMP 时必须提供 transport（创建后 PUT 改包并登记请求） */
  packageName?: string
  transport?: string
  description?: string
  responsible?: string // 缺省取登录用户
  masterSystem?: string // default "BPD"
  masterLanguage?: string // default "ZH"
}

export interface CreateTransformationResult {
  trfnId: string
  /** 水合后的完整 XML（packageName 非 $TMP 时已改包并登记 transport） */
  xml: string
}

/**
 * Create Transformation —— 8TRANSIENT 瞬态流创建转换（Eclipse 新建向导同款）。
 *
 * 流程: GET 8TRANSIENT 铸 id → stateful+CREA lock → POST 极简创建体
 * （source/target 自闭合空节点，服务器按源/目标提供者水合全部元素与默认规则）
 * → unlock →（packageName 非 $TMP 时）PUT 改包并登记 transport。
 *
 * ⚠️ 创建体必须与 Eclipse 序列化逐属性对齐：createdAt/createdBy 必带、
 * packageRef 需 name/type/uri 三属性、root description 建议为空串；
 * 带segment/element 的骨架会反序列化失败。
 *
 * 对应请求:
 * - GET  /sap/bw/modeling/trfn/8TRANSIENT?GetIdOnly=true&sourceobjecttype=..&targetobjecttype=..&sourceobjectname=..&targetobjectname=..
 * - POST /sap/bw/modeling/trfn/{id}?action=lock            (stateful + activity_context:CREA)
 * - POST /sap/bw/modeling/trfn/{id}?lockHandle=..           (Development-Class 头)
 * - POST /sap/bw/modeling/trfn/{id}?action=unlock
 */
export async function createTransformation(
  client: AdtHTTP,
  options: CreateTransformationOptions
): Promise<CreateTransformationResult> {
  const CT = "application/vnd.sap.bw.modeling.trfn-v1_0_0+xml"
  const sourceType = options.sourceObjType || "ADSO"
  const targetType = options.targetObjType || "ADSO"
  const packageName = options.packageName || "$TMP"
  const masterSystem = options.masterSystem || "BPD"
  const masterLanguage = options.masterLanguage || "ZH"
  const username =
    (client as unknown as { username?: string }).username || options.responsible || ""

  // 1) 铸 id（瞬态壳，不落库）
  const transientResp = await client.request("/sap/bw/modeling/trfn/8TRANSIENT", {
    method: "GET",
    qs: {
      GetIdOnly: "true",
      sourceobjecttype: sourceType,
      targetobjecttype: targetType,
      sourceobjectname: options.sourceObjName,
      targetobjectname: options.targetObjName
    },
    headers: { Accept: CT }
  })
  const transientParsed = fullParse(transientResp.body)
  const transientRoot = transientParsed["trfn:transformation"] || transientParsed
  const trfnId = transientRoot["@_name"] || transientRoot["name"]
  if (!trfnId) {
    throw new Error(`8TRANSIENT did not return an id: ${String(transientResp.body).slice(0, 300)}`)
  }
  const idLower = trfnId.toLowerCase()

  // 2) CREA lock（stateful；5xx 时按 F7 会话中毒恢复换新会话重试一次）
  const lockResp = await withFreshSessionOnServerError(client, () =>
    client.request(`/sap/bw/modeling/trfn/${idLower}`, {
      method: "POST",
      qs: { action: "lock" },
      sessionType: session_types.stateful,
      headers: { Accept: CT, "activity_context": "CREA" }
    })
  )
  const lockParsed = fullParse(lockResp.body)
  const lockData = xmlNode(lockParsed, "asx:abap", "asx:values", "DATA")
  const lockHandle =
    (lockData as Record<string, string> | undefined)?.["LOCK_HANDLE"] ||
    String(lockResp.body || "").match(/<LOCK_HANDLE>([^<]+)/)?.[1] ||
    ""
  if (!lockHandle) throw new Error(`lock failed: ${String(lockResp.body).slice(0, 300)}`)
  const timestamp = lockResp.headers["timestamp"] as string | undefined

  try {
    // 3) POST 极简创建体（先落 $TMP；服务器水合元素与默认规则）
    const today = new Date().toISOString().slice(0, 10) + "T00:00:00Z"
    const saveXml = `<?xml version="1.0" encoding="UTF-8"?>
<trfn:transformation xmlns:adtcore="http://www.sap.com/adt/core" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:trfn="http://www.sap.com/bw/modeling/Trfn.ecore" description="" endRoutine="" expertRoutine="" name="${trfnId}" startRoutine="">
  <tlogoProperties adtcore:createdAt="${today}" adtcore:createdBy="${escapeXmlAttr(username)}" adtcore:language="${masterLanguage}" adtcore:name="${trfnId}" adtcore:type="TRFN" adtcore:version="inactive" adtcore:masterLanguage="${masterLanguage}" adtcore:masterSystem="${masterSystem}" adtcore:responsible="${escapeXmlAttr(username)}">
    <atom:link href="/sap/bw/modeling/trfn/${idLower}/m" rel="self" type="application/vnd.sap-bw-modeling.trfn+xml"/>
    <adtcore:packageRef adtcore:name="$TMP" adtcore:type="DEVC/K" adtcore:uri="/sap/bc/adt/packages/%24tmp"/>
    <objectVersion>M</objectVersion>
    <objectStatus>inactive</objectStatus>
    <contentState>NEW</contentState>
  </tlogoProperties>
  <source description="" id="0" name="${escapeXmlAttr(options.sourceObjName)}" type="${sourceType}"/>
  <target description="" id="0" name="${escapeXmlAttr(options.targetObjName)}" type="${targetType}"/>
</trfn:transformation>`
    await client.request(`/sap/bw/modeling/trfn/${idLower}`, {
      method: "POST",
      qs: { lockHandle },
      // 创建 POST 走 stateless（与 3 月实测成功日志及会话模型一致：
      // lock/unlock 才用 stateful；stateful 会话发创建体会 500）。
      sessionType: session_types.stateless,
      headers: {
        "Content-Type": CT,
        "Accept": CT,
        "Development-Class": "$TMP",
        ...(timestamp ? { timestamp } : {})
      },
      body: saveXml
    })
  } finally {
    await client.request(`/sap/bw/modeling/trfn/${idLower}`, {
      method: "POST",
      qs: { action: "unlock" },
      sessionType: session_types.stateful,
      headers: { Accept: CT }
    })
  }

  // 4) 水合读回
  let xml = await getTransformationXml(client, trfnId, "m", { forceCacheUpdate: true })

  // 5) 非 $TMP 包: PUT 改 packageRef 并登记 transport
  if (packageName !== "$TMP") {
    if (!options.transport) {
      throw new Error(`transport is required when packageName="${packageName}"`)
    }
    // 包 URI 大小写不敏感（实测 /packages/zbw 与 /packages/ZBW 均返回 200），
    // 统一小写即可，无需对 ZBW 做特判。
    const pkgUri = `/sap/bc/adt/packages/${encodeURIComponent(packageName.toLowerCase())}`
    const pkgRef = `<adtcore:packageRef adtcore:uri="${pkgUri}" adtcore:type="DEVC/K" adtcore:name="${escapeXmlAttr(packageName)}"/>`
    if (xml.includes("packageRef")) {
      xml = xml.replace(/<adtcore:packageRef[\s\S]*?\/>/, pkgRef)
    } else {
      const m = xml.match(/<tlogoProperties[^>]*>/)
      if (m) xml = xml.replace(m[0], m[0] + pkgRef)
    }
    const lock2 = await lockTransformation(client, trfnId)
    try {
      await updateTransformation(client, trfnId, xml, {
        lockHandle: lock2.lockHandle,
        corrNr: options.transport
      })
    } finally {
      await unlockTransformation(client, trfnId)
    }
  }

  return { trfnId, xml }
}
