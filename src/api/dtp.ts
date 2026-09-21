import * as t from "io-ts"
import { fullParse, xmlNodeAttr, xmlArray, xmlNode, orUndefined } from "../utilities"
import { AdtHTTP, session_types } from "../AdtHTTP"
import { ActivationResult, LockResult, ValidationAction, ValidationResult } from "./common"
import { BWObject, BWObjectType, createBWObject } from "./bwObject"
import { DTPDetails } from "./types"
import { withWriteSession } from "./writeSession"

// ============================================================================
// Types and Codecs for DTP (Data Transfer Process)
// ============================================================================

// Re-export Validation types for convenience
export { ValidationAction, ValidationResult } from "./common"

/**
 * DTP Type - DTP 类型
 */
export enum DTPType {
  LOAD = "DTP_LOAD",           // 加载 DTP
  EXECUTE = "DTP_EXECUTE"     // 执行 DTP
}

/**
 * DTP Status - DTP 状态
 */
export enum DTPStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  EXISTING = "objectStatus:existing",
  REVISED = "objectStatus:revised"
}

/**
 * DTP Lock Result - DTP 锁定结果
 */
export const DTPLockResult = t.type({
  lockHandle: t.string,
  corrNr: orUndefined(t.string),
  corrUser: orUndefined(t.string),
  corrText: orUndefined(t.string)
})

export type DTPLockResult = t.OutputOf<typeof DTPLockResult>

/**
 * DTP Metadata - DTP 元数据
 */
export const DTPMetaData = t.type({
  name: t.string,
  source: t.string,           // 源对象
  target: t.string,           // 目标对象
  description: orUndefined(t.string),
  objVers: orUndefined(t.string),  // M=Active, D=Revised, A=Modified
  dtpType: orUndefined(t.string),    // LOAD 或 EXECUTE
  status: orUndefined(t.string)
})

export type DTPMetaData = t.OutputOf<typeof DTPMetaData>

// DTPDetails is now imported from types.ts to avoid duplication

/**
 * DTP Version - DTP 版本信息
 */
export const DTPVersion = t.type({
  version: t.string,           // m=active, a=modified, d=revised
  uri: t.string,
  created: orUndefined(t.string),
  user: orUndefined(t.string),
  description: orUndefined(t.string)
})

export type DTPVersion = t.OutputOf<typeof DTPVersion>

/**
 * DTP Execution Result - DTP 执行触发结果
 *
 * Eclipse 抓包（2026-09-21，用户 10:44 日志）+ 真机复验：POST executerun
 * 返回 201 Created，无响应体，运行 ID 在 Location 头：
 * `/sap/bw/modeling/dtpa/executerun/{dtpId}/{runId}`（runId 形如 20260921024431000052000）。
 * 执行是异步的——加载结果用 getDTPExecuteRunResult 轮询。
 */
export interface DTPExecutionResult {
  /** 服务端是否接受了执行触发（实测 201 Created） */
  triggered: boolean
  /** 运行标识（Location 头末段；用于 getDTPExecuteRunResult 轮询） */
  runId?: string
  /** 完整 Location 头 */
  location?: string
  /** HTTP 状态码（实测 201） */
  status: number
  /** 服务端原始响应体（实测为空） */
  raw: string
}

/**
 * DTP Execute Run Result - 执行运行状态（轮询）
 *
 * Eclipse 抓包（2026-09-21，用户 10:45 日志）：GET executerun/{dtpId}/{runId}
 * 返回 200 + `<executeRun dataTransferProcess=… requestId=…/>`；withLog=true
 * 时完成后可携带日志子节点（完成态的子节点形态未采样，解析只取已证实的属性，
 * 其余经 raw 透传，不虚构）。
 */
export interface DTPExecuteRunResult {
  dataTransferProcess?: string
  requestId?: string
  /** 原始 XML（日志/状态子节点形态待后续证据再解析） */
  raw: string
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get DTP Details - 获取 DTP 详细信息
 *
 * 对应请求: GET /sap/bw/modeling/dtpa/{dtp_id}/m
 *
 * @param client - ADT HTTP 客户端
 * @param dtpId - DTP ID (格式: DTP_*)
 * @param forceCacheUpdate - 是否强制更新缓存
 * @returns DTP 详细信息
 */
export async function getDTP(
  client: AdtHTTP,
  dtpId: string,
  forceCacheUpdate: boolean = false
): Promise<any> {
  const qs = forceCacheUpdate ? { forceCacheUpdate: "true" } : undefined

  const response = await client.request(`/sap/bw/modeling/dtpa/${dtpId.toLowerCase()}/m`, {
    method: "GET",
    qs,
    headers: {
      "Accept": "application/vnd.sap.bw.modeling.dtpa-v1_0_0+xml"
    }
  })

  return fullParse(response.body)
}

/**
 * Get DTP Raw XML - 获取 DTP 原始 XML 字符串（供 PUT update 使用）
 *
 * 对应请求: GET /sap/bw/modeling/dtpa/{dtp_id}/m
 *
 * 与 getDTP 命中同一个端点，但不做 fullParse，直接返回原始 XML 字符串。
 * 对称于 getADSOXml / getTransformationXml，便于写入文件做字符串处理。
 *
 * @param client - ADT HTTP 客户端
 * @param dtpId - DTP ID (格式: DTP_*)
 * @param forceCacheUpdate - 是否强制更新缓存
 * @returns DTP 原始 XML 字符串
 */
export async function getDTPXml(
  client: AdtHTTP,
  dtpId: string,
  forceCacheUpdate: boolean = false
): Promise<string> {
  const qs = forceCacheUpdate ? { forceCacheUpdate: "true" } : undefined

  const response = await client.request(`/sap/bw/modeling/dtpa/${dtpId.toLowerCase()}/m`, {
    method: "GET",
    qs,
    headers: {
      "Accept": "application/vnd.sap.bw.modeling.dtpa-v1_0_0+xml"
    }
  })

  return response.body
}

/**
 * Get DTP Metadata (Parsed) - 获取解析后的 DTP 元数据
 *
 * @param client - ADT HTTP 客户端
 * @param dtpId - DTP ID
 * @param forceCacheUpdate - 是否强制更新缓存
 * @returns DTP 详细信息
 */
export async function getDTPDetails(
  client: AdtHTTP,
  dtpId: string,
  forceCacheUpdate: boolean = false
): Promise<DTPDetails> {
  const raw = await getDTP(client, dtpId, forceCacheUpdate)
  return parseDTPDetails(raw)
}

/**
 * Get DTP Versions - 获取 DTP 版本历史
 *
 * 对应请求: GET /sap/bw/modeling/dtpa/{dtp_id}/versions
 *
 * @param client - ADT HTTP 客户端
 * @param dtpId - DTP ID
 * @returns 版本历史列表
 */
export async function getDTPVersions(
  client: AdtHTTP,
  dtpId: string
): Promise<DTPVersion[]> {
  const obj = new BWObject(client, BWObjectType.DTP, dtpId)
  return obj.getVersions()
}

// ============================================================================
// Validation Functions (using BWObject base class)
// ============================================================================

/**
 * Validate DTP Exists - 验证 DTP 是否存在
 *
 * @param client - ADT HTTP 客户端
 * @param dtpId - DTP ID
 * @returns 验证结果
 */
export async function validateDTPExists(
  client: AdtHTTP,
  dtpId: string
): Promise<ValidationResult> {
  const obj = new BWObject(client, BWObjectType.DTP, dtpId)
  return obj.exists()
}

/**
 * Validate New DTP Name - 验证新 DTP 名称是否可用
 *
 * @param client - ADT HTTP 客户端
 * @param dtpId - DTP ID
 * @returns 验证结果
 */

/**
 * Validate DTP Can Delete - 验证 DTP 是否可删除
 *
 * @param client - ADT HTTP 客户端
 * @param dtpId - DTP ID
 * @returns 验证结果
 */

/**
 * Validate DTP Can Activate - 验证 DTP 是否可激活
 *
 * @param client - ADT HTTP 客户端
 * @param dtpId - DTP ID
 * @returns 验证结果
 */

/**
 * Lock DTP - 锁定 DTP
 *
 * 对应请求: POST /sap/bw/modeling/dtpa/{dtp_id}?action=lock
 *
 * @param client - ADT HTTP 客户端
 * @param dtpId - DTP ID
 * @returns 锁定结果（包含 lockHandle）
 */
export async function lockDTP(
  client: AdtHTTP,
  dtpId: string
): Promise<LockResult> {
  const obj = new BWObject(client, BWObjectType.DTP, dtpId)
  return obj.lock()
}

/**
 * Unlock DTP - 解锁 DTP
 *
 * 对应请求: POST /sap/bw/modeling/dtpa/{dtp_id}?action=unlock
 *
 * @param client - ADT HTTP 客户端
 * @param dtpId - DTP ID
 */
export async function unlockDTP(
  client: AdtHTTP,
  dtpId: string
): Promise<void> {
  const obj = new BWObject(client, BWObjectType.DTP, dtpId)
  return obj.unlock()
}

/**
 * Activate DTP - 激活 DTP
 *
 * 对应请求: POST /sap/bw/modeling/activation
 *
 * @param client - ADT HTTP 客户端
 * @param dtpId - DTP ID
 * @param lockHandle - 锁定句柄
 * @param corrNr - 传输请求号（可选）
 * @returns 激活结果
 */
export async function activateDTP(
  client: AdtHTTP,
  dtpId: string,
  lockHandle: string = "",
  corrNr: string = ""
): Promise<any> {
  const qs: Record<string, string> = {}
  if (corrNr) qs["corrNr"] = corrNr

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:bwModel="http://www.sap.com/bw/modeling">
  <atom:entry>
    <atom:content type="application/vnd.sap.bw.modeling.dtpa-v1_0_0+xml">
      <bwModel:checkProperties version="inactive" modelContent="" lockHandle="${lockHandle}"></bwModel:checkProperties>
    </atom:content>
    <atom:link href="/sap/bw/modeling/dtpa/${dtpId.toLowerCase()}/m" type="application/*" rel="self"></atom:link>
  </atom:entry>
</atom:feed>`

  const response = await client.request("/sap/bw/modeling/activation", {
    method: "POST",
    qs,
    headers: {
      "Content-Type": "application/atom+xml;type=entry"
    },
    body
  })

  return fullParse(response.body)
}

/**
 * Check DTP - 检查 DTP 一致性（只读，不激活）
 *
 * 通过 BWObject.check() 用 version="active" 做纯检查，
 * 不再别名 activateDTP（旧实现导致 check 误触发激活）。
 *
 * @param client - ADT HTTP 客户端
 * @param dtpId - DTP ID
 * @returns 检查结果
 */
export async function checkDTP(
  client: AdtHTTP,
  dtpId: string
): Promise<ActivationResult> {
  const obj = new BWObject(client, BWObjectType.DTP, dtpId)
  return obj.check()
}

/**
 * Execute DTP - 触发 DTP 执行（异步）
 *
 * 对应请求: POST /sap/bw/modeling/dtpa/{dtp_id}?action=execute
 *
 * 注意：本方法只代表"触发成功"，加载结果（成败、记录数）需通过 DTP 监控或
 * 日志确认，不要把 triggered 当作加载成功。
 *
 * @param client - ADT HTTP 客户端
 * @param dtpId - DTP ID
 * @returns 触发结果（含原始响应体）
 */
export async function executeDTP(
  client: AdtHTTP,
  dtpId: string
): Promise<DTPExecutionResult> {
  // W3 修复（2026-09-21）：旧形态 `POST /dtpa/{id}?action=execute` 本系统报
  // 「内部错误：不支持 URI」。Eclipse 抓包实证真实端点为 executerun 集合 POST
  // （body 带 dtpId，201 + Location 头返回运行 ID），见 VERIFIED_APIS 第 8 节。
  const CT = "application/vnd.sap.bw.modeling.dtpa-v1_0_0+xml"
  const response = await client.request("/sap/bw/modeling/dtpa/executerun", {
    method: "POST",
    sessionType: session_types.stateless,
    headers: { "Content-Type": CT, "Accept": CT },
    body: `<?xml version="1.0" encoding="UTF-8"?><executeRun dataTransferProcess="${dtpId}"></executeRun>`
  })

  const location = response.headers["location"] || response.headers["Location"]
  const loc = location ? String(location) : undefined
  return {
    triggered: response.status === 201,
    runId: loc ? loc.split("/").pop() : undefined,
    location: loc,
    status: response.status,
    raw: response.body
  }
}

/**
 * Get DTP Execute Run Result - 轮询 DTP 执行运行状态
 *
 * 对应请求: GET /sap/bw/modeling/dtpa/executerun/{dtp_id}/{run_id}[?withLog=true]
 * （Eclipse 抓包 2026-09-21；runId 来自 executeDTP 返回值）
 *
 * @param client - ADT HTTP 客户端
 * @param dtpId - DTP ID
 * @param runId - 运行标识（executeDTP().runId）
 * @param options.withLog - 请求携带日志（默认 true，与 Eclipse 一致）
 */
export async function getDTPExecuteRunResult(
  client: AdtHTTP,
  dtpId: string,
  runId: string,
  options?: { withLog?: boolean }
): Promise<DTPExecuteRunResult> {
  const CT = "application/vnd.sap.bw.modeling.dtpa-v1_0_0+xml"
  const response = await client.request(
    `/sap/bw/modeling/dtpa/executerun/${encodeURIComponent(dtpId)}/${encodeURIComponent(runId)}`,
    {
      method: "GET",
      qs: { withLog: options?.withLog === false ? "false" : "true" },
      headers: { Accept: CT }
    }
  )
  const m = String(response.body || "").match(/<executeRun\b[^>]*>/)
  const attrs = m ? m[0] : ""
  const attr = (name: string) =>
    (attrs.match(new RegExp(`${name}="([^"]*)"`)) || [])[1]
  return {
    dataTransferProcess: attr("dataTransferProcess"),
    requestId: attr("requestId"),
    raw: response.body
  }
}

/**
 * Update DTP XML via BWObject PUT (stateless; caller must already hold lock).
 */
export async function updateDTP(
  client: AdtHTTP,
  dtpId: string,
  xmlContent: string,
  options: { lockHandle: string; transport?: string }
): Promise<void> {
  const obj = createBWObject(client, BWObjectType.DTP, dtpId)
  await obj.update(xmlContent, {
    lockHandle: options.lockHandle,
    transport: options.transport,
    activate: false
  })
}

export interface SaveAndActivateDTPOptions {
  transport?: string
  createTransport?: boolean
  transportDescription?: string
  autoActivate?: boolean
}

export interface SaveAndActivateDTPResult {
  lockHandle: string
  transport?: string
  activated: boolean
  activateResult?: ActivationResult
}

/**
 * Save and Activate DTP - lock → transport → PUT → activate → unlock.
 * Session model: lock/unlock stateful; PUT/activation/transport stateless (no contextid).
 */
export async function saveAndActivateDTP(
  client: AdtHTTP,
  dtpId: string,
  xmlContent: string,
  options?: SaveAndActivateDTPOptions
): Promise<SaveAndActivateDTPResult> {
  const { updateResult, ...rest } = await withWriteSession(client, {
    lock: c => lockDTP(c, dtpId),
    update: (c, xml, io) =>
      updateDTP(c, dtpId, xml, { lockHandle: io.lockHandle, transport: io.corrNr }),
    activate: (c, lockHandle, corrNr) => activateDTP(c, dtpId, lockHandle, corrNr || ""),
    unlock: c => unlockDTP(c, dtpId),
  }, {
    uri: `/sap/bw/modeling/dtpa/${dtpId.toLowerCase()}/m`,
    xml: xmlContent,
    autoActivate: options?.autoActivate,
    transport: options?.transport,
    createTransport: options?.createTransport,
    transportDescription: options?.transportDescription || "API update",
  })
  return rest
}

// ============================================================================
// Parse Functions
// ============================================================================

/**
 * Parse DTP Details Response - 解析 DTP 详细信息响应
 */
function parseDTPDetails(raw: any): DTPDetails {
  // 根节点: dtpa:dataTransferProcess
  const root = raw["dtpa:dataTransferProcess"] || raw

  // source / target 是子元素,类型/名称/描述在属性上
  const sourceNode = root["source"] || {}
  const targetNode = root["target"] || {}

  // generalInformation.tlogoProperties 含 version/status 信息
  const tlogo = root["generalInformation"]?.["tlogoProperties"] || {}

  return {
    name: root["@_name"] || "",
    technicalName: root["@_name"] || "",
    description: root["@_description"],
    source: sourceNode["@_name"] || "",
    sourceType: sourceNode["@_tlogo"] || sourceNode["@_type"],
    target: targetNode["@_name"] || "",
    targetType: targetNode["@_tlogo"] || targetNode["@_type"],
    objVers: tlogo["@_version"] || tlogo["objectVersion"] || "M",
    status: tlogo["@_version"] === "active" ? "active" : tlogo["objectStatus"],
    dtpType: root["@_type"],
    deltaRequest: undefined,
    realTimeLoad: undefined
  }
}

// ============================================================================
// CREATE —— 通用对象 POST 流 (CREA lock + collection POST, 2026-09-11 实测)
// ============================================================================

export interface CreateDTPOptions {
  /** DTP id; 缺省自动生成（DTP_ET0916OM0D + 16 位随机大写字母数字，总长 30） */
  id?: string
  /** 源对象名（ADSO） */
  sourceName: string
  /** 目标对象名（ADSO） */
  targetName: string
  /** 绑定的转换 TRFN id */
  transformId: string
  /** 抽取模式: F=全量(默认) / D=增量 */
  extractionMode?: "F" | "D"
  /** 目标包; 默认 "$TMP"。非 $TMP 时建议提供 transport */
  packageName?: string
  transport?: string
  /**
   * ⚠️ 不生效（2026-09-21 W2 实测）：服务端忽略根元素描述，DTP 真实描述是
   * `overview/object@description` 派生字段（源→目标自动生成，PUT 亦不持久）。
   * 参数仅为签名兼容保留。可编辑配置见 extractionSettings（如 packageSize）。
   */
  description?: string
  responsible?: string
  masterSystem?: string // default "BPD"
}

/** 生成 DTP id（DTP_ET0916OM0D 前缀为本系统实例惯用，总长 30） */
export function generateDtpId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let suffix = ""
  for (let i = 0; i < 16; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)]
  }
  return `DTP_ET0916OM0D${suffix}`
}

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * Create DTP —— 通用对象 POST 流创建 DTP（CREA lock → collection POST）。
 *
 * body 为极简模型（root + tlogoProperties + extractionSettings + overview TRFN
 * 绑定 + source/target 带 dataStoreObject 子节点）；保存后服务器水合 filter
 * 全字段、programFlow 等。创建后 DTP 为 inactive，配置（filter/模式）完成后
 * 再用 saveAndActivateDTP / activateDTP 激活。
 *
 * 对应请求: POST /sap/bw/modeling/dtpa/{dtp_id}?lockHandle=..[&transport=..]
 */
export async function createDTP(
  client: AdtHTTP,
  options: CreateDTPOptions
): Promise<{ dtpId: string; xml: string }> {
  const CT = "application/vnd.sap.bw.modeling.dtpa-v1_0_0+xml"
  const dtpId = options.id || generateDtpId()
  if (!/^DTP_[A-Z0-9]{26}$/.test(dtpId)) {
    throw new Error(`DTP id must match DTP_ + 26 uppercase alnum chars, got: ${dtpId} (len ${dtpId.length})`)
  }
  const packageName = options.packageName || "$TMP"
  // 显式要了真实包却没给请求号是调用方错误：对象会落 $TMP 且不报错（与 createADSO 同类坑）。
  if (packageName !== "$TMP" && !options.transport) {
    throw new Error(
      `createDTP: packageName "${packageName}" requires a transport request number — ` +
      `without it the object would silently become a $TMP local object. ` +
      `Pass transport=<TRKORR> (create one with createTransport), or set packageName="$TMP" explicitly.`
    )
  }
  // W2 预检（2026-09-21 实测）：引用的 TRFN 必须处于 active 版本——未激活或已删除时
  // 服务端只报模糊的 "could not be successfully created"，提前给出可操作报错。
  {
    let trfnXml: string
    try {
      const resp = await client.request(
        `/sap/bw/modeling/trfn/${encodeURIComponent(options.transformId.toLowerCase())}/m`,
        { method: "GET", headers: { Accept: "application/vnd.sap.bw.modeling.trfn-v1_0_0+xml" } }
      )
      trfnXml = resp.body
    } catch (e) {
      throw new Error(
        `createDTP: referenced transformation ${options.transformId} could not be read ` +
        `(${String((e as Error).message).slice(0, 80)}). ` +
        `Create it with createTransformation() and pass its id.`
      )
    }
    if (/<objectStatus>\s*inactive\s*<\/objectStatus>/.test(trfnXml)) {
      throw new Error(
        `createDTP: referenced transformation ${options.transformId} is INACTIVE — ` +
        `the server only accepts DTP creation against an active transformation ` +
        `(otherwise it fails with a cryptic "could not be successfully created"). ` +
        `Activate it first via saveAndActivateTransformation().`
      )
    }
  }

  const pkgUri = packageName === "$TMP"
    ? "/sap/bc/adt/packages/%24tmp"
    : `/sap/bc/adt/packages/${encodeURIComponent(packageName.toLowerCase())}`
  const extractionMode = options.extractionMode || "F"
  const description = escapeXmlAttr(options.description || `ADSO ${options.sourceName} -> ADSO ${options.targetName}`)
  const responsible = escapeXmlAttr(options.responsible || (client as unknown as { username?: string }).username || "")
  const masterSystem = options.masterSystem || "BPD"

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<dtpa:dataTransferProcess name="${dtpId}" description="${description}" type="_" xmlns:dtpa="http://www.sap.com/bw/modeling/DataTransferProcess.ecore" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:adtcore="http://www.sap.com/adt/core" xmlns:atom="http://www.w3.org/2005/Atom"><generalInformation><tlogoProperties adtcore:responsible="${responsible}" adtcore:masterLanguage="ZH" adtcore:masterSystem="${masterSystem}" adtcore:name="${dtpId}" adtcore:type="DTPA" adtcore:language="ZH"><atom:link href="/sap/bw/modeling/dtpa/${dtpId.toLowerCase()}/m" rel="self" type="application/vnd.sap.bw.modeling.dtpa+xml"/><adtcore:packageRef adtcore:uri="${pkgUri}" adtcore:type="DEVC/K" adtcore:name="${escapeXmlAttr(packageName)}"/></tlogoProperties></generalInformation><extractionSettings extractionMode="${extractionMode}" allowedExtractionModes="${extractionMode === "F" ? "1" : "0"}" packageSize="100000" parallelExtraction="true" deltaSettingStatus="${extractionMode === "F" ? "0" : "3"}"/><overview><object name="${escapeXmlAttr(options.transformId)}" tlogo="TRFN"/></overview><source type="ADSO" name="${escapeXmlAttr(options.sourceName)}" tlogo="ADSO" reference="adso:DataStore ${escapeXmlAttr(options.sourceName)}.adso#//"><dataStoreObject/></source><target type="ADSO" name="${escapeXmlAttr(options.targetName)}" tlogo="ADSO" reference="adso:DataStore ${escapeXmlAttr(options.targetName)}.adso#//"><dataStoreObject triggerDatabaseMerge="true"/></target></dtpa:dataTransferProcess>`

  const obj = new BWObject(client, BWObjectType.DTP, dtpId)
  const lock = await obj.lock({ headers: { "activity_context": "CREA" } })
  try {
    await client.request(`/sap/bw/modeling/dtpa/${dtpId.toLowerCase()}/m`, {
      method: "POST",
      qs: {
        lockHandle: lock.lockHandle,
        ...(options.transport ? { transport: options.transport } : {})
      },
      headers: {
        "Content-Type": CT,
        "Accept": CT
      },
      body
    })
  } finally {
    await obj.unlock()
  }

  const xml = await getDTPXml(client, dtpId)
  return { dtpId, xml }
}
