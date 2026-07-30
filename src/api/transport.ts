import { JSON2AbapXML, parse, xmlArray } from "../utilities"
import { AdtHTTP } from "../AdtHTTP"
import { adtException } from "../AdtException"

// ============================================================================
// Types for CTS (Change and Transport System)
// ============================================================================

/**
 * Transport Request Header - 传输请求头信息
 */
export interface TransportHeader {
  /** 传输请求号 (如 "BPDK903265") */
  TRKORR: string
  /** 请求类型 */
  TRFUNCTION: string
  /** 状态 */
  TRSTATUS: string
  /** 目标系统 */
  TARSYSTEM: string
  /** 负责人 */
  AS4USER: string
  /** 描述 */
  AS4TEXT: string
}

/**
 * CTS Message - CTS 返回的消息
 */
export interface CtsMessage {
  SEVERITY: string
  TEXT: string
  ARBGB: string
  MSGNR: number
  VARIABLES: string[]
}

/**
 * Transport Check Result - transportchecks 端点返回的结果
 */
export interface TransportInfo {
  /** 程序 ID */
  PGMID: string
  /** 对象类型 */
  OBJECT: string
  /** 对象名 */
  OBJECTNAME: string
  /** 操作 (I=插入, D=删除, U=更新) */
  OPERATION: string
  /** 开发包 */
  DEVCLASS: string
  /** 是否需要记录 (X=需要) */
  RECORDING: string
  /** 结果 */
  RESULT: string
  /** 可用的传输请求列表 */
  TRANSPORTS: TransportHeader[]
  /** 消息列表 */
  MESSAGES: CtsMessage[]
}

// ============================================================================
// Constants
// ============================================================================

const CTS_CHECK_HEADERS = {
  Accept:
    "application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.transport.service.checkData",
  "Content-Type":
    "application/vnd.sap.as+xml; charset=UTF-8; dataname=com.sap.adt.transport.service.checkData"
}

const CTS_CREATE_HEADERS = {
  Accept: "text/plain",
  "Content-Type":
    "application/vnd.sap.as+xml; charset=UTF-8; dataname=com.sap.adt.CreateCorrectionRequest"
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Transport Check - 检查对象保存/修改是否需要传输请求
 *
 * 对应请求: POST /sap/bc/adt/cts/transportchecks
 *
 * Eclipse 在保存对象前调用此接口,判断:
 * - 对象是否需要传输请求 (RECORDING)
 * - 有哪些可用的传输请求 (TRANSPORTS)
 *
 * 实测请求体 (ABAP XML 格式):
 *   <asx:abap><asx:values><DATA><URI>...</URI><DEVCLASS>...</DEVCLASS><OPERATION>I</OPERATION></DATA></asx:values></asx:abap>
 *
 * @param client - ADT HTTP 客户端
 * @param objectUri - 对象 URI (如 "/sap/bw/modeling/dtpa/dtp_xxx/m")
 * @param devclass - 开发包 (可选,空字符串表示从对象推断)
 * @param operation - 操作类型 (默认 "I"=插入)
 * @returns 传输检查信息
 */
export async function transportCheck(
  client: AdtHTTP,
  objectUri: string,
  devclass: string = "",
  operation: string = "I"
): Promise<TransportInfo> {
  const body = JSON2AbapXML({ DEVCLASS: devclass, OPERATION: operation, URI: objectUri })

  const response = await client.request("/sap/bc/adt/cts/transportchecks", {
    method: "POST",
    body,
    headers: CTS_CHECK_HEADERS
  })

  return parseTransportCheck(response.body)
}

/**
 * Create Transport - 新建传输请求
 *
 * 对应请求: POST /sap/bc/adt/cts/transports
 *
 * Eclipse 在 TR 对话框中点击"新建"时调用此接口。
 * 返回新建的传输请求号。
 *
 * 实测 (Eclipse 日志 15:40:58):
 *   POST /sap/bc/adt/cts/transports
 *   返回 text/plain,格式为 "包名/请求号" (从中提取请求号)
 *
 * @param client - ADT HTTP 客户端
 * @param refUri - 参考对象 URI (用于确定包和对象)
 * @param description - 传输请求描述
 * @param devclass - 开发包 (可选)
 * @param operation - 操作类型 (默认 "I")
 * @returns 新建的传输请求号 (如 "BPDK903265")
 */
export async function createTransport(
  client: AdtHTTP,
  refUri: string,
  description: string,
  devclass: string = "",
  operation: string = "I"
): Promise<string> {
  const body = JSON2AbapXML({
    DEVCLASS: devclass,
    REQUEST_TEXT: description,
    REF: refUri,
    OPERATION: operation
  })

  const response = await client.request("/sap/bc/adt/cts/transports", {
    method: "POST",
    body,
    headers: CTS_CREATE_HEADERS
  })

  // 返回格式: "包名/请求号" 或纯请求号,取最后一段
  const transport = response.body?.split("/").pop()?.trim()
  return transport || ""
}

/**
 * Thrown when a write needs a transport request but the caller has not chosen
 * an existing TR (`transport`) nor opted to create one (`createTransport: true`).
 */
export class TransportRequiredError extends Error {
  readonly code = "TRANSPORT_REQUIRED"
  readonly objectUri: string
  readonly transports: TransportHeader[]
  readonly check: TransportInfo

  constructor(objectUri: string, check: TransportInfo) {
    const list = (check.TRANSPORTS || [])
      .map(t => `${t.TRKORR}${t.AS4TEXT ? ` (${t.AS4TEXT})` : ""}`)
      .join(", ")
    super(
      `Transport required for ${objectUri}. ` +
        `Pass options.transport to use an existing request` +
        (list ? ` (available: ${list})` : "") +
        `, or set options.createTransport=true to create a new one.`
    )
    this.name = "TransportRequiredError"
    this.objectUri = objectUri
    this.transports = check.TRANSPORTS || []
    this.check = check
  }
}

export function isTransportRequiredError(e: unknown): e is TransportRequiredError {
  return e instanceof TransportRequiredError
}

/**
 * Resolve transport number for a locked write (shared by saveAndActivate*).
 *
 * Priority:
 * 1. Explicit `transport` (caller chose an existing TR)
 * 2. Lock `corrNr` (object already bound to a TR)
 * 3. If RECORDING=X:
 *    - `createTransport: true` → create a new TR
 *    - otherwise → throw TransportRequiredError with available TRANSPORTS for the caller to choose
 */
export async function resolveTransportForWrite(
  client: AdtHTTP,
  objectUri: string,
  options?: {
    transport?: string
    lockCorrNr?: string
    /** When true and a TR is required, create a new request. Default false — caller must choose. */
    createTransport?: boolean
    transportDescription?: string
  }
): Promise<string | undefined> {
  let transport = options?.transport || options?.lockCorrNr
  if (transport) return transport

  const check = await transportCheck(client, objectUri)
  if (check.RECORDING !== "X") return undefined

  if (options?.createTransport) {
    return createTransport(
      client,
      objectUri,
      options?.transportDescription || "API update"
    )
  }

  throw new TransportRequiredError(objectUri, check)
}

// ============================================================================
// Parsing helpers
// ============================================================================

/**
 * Parse transportchecks response - 解析传输检查响应
 */
function parseTransportCheck(body: string): TransportInfo {
  const parsed = parse(body)
  const data = parsed["asx:abap"]?.["asx:values"]?.DATA

  if (!data) {
    throw adtException("Invalid transport check response: no DATA element")
  }

  // 解析消息
  let messages: CtsMessage[] = []
  if (data.MESSAGES) {
    messages = xmlArray(data.MESSAGES, "CTS_MESSAGE").map((m: any) => {
      let variables: string[] = []
      if (m.VARIABLES) {
        variables = xmlArray(m, "VARIABLES", "CTS_VARIABLE").map(
          (v: any) => v.VARIABLE || ""
        )
      }
      return {
        SEVERITY: m.SEVERITY || "",
        TEXT: m.TEXT || "",
        ARBGB: m.ARBGB || "",
        MSGNR: Number(m.MSGNR) || 0,
        VARIABLES: variables
      }
    })
    // 严重级别 E/A/X 的消息视为错误
    const errorMsg = messages.find(m => /[EAX]/.test(m.SEVERITY))
    if (errorMsg) throw adtException(errorMsg.TEXT)
  }

  // 解析可用传输请求列表
  const transports = extractTransports(data.REQUESTS)

  return {
    PGMID: data.PGMID || "",
    OBJECT: data.OBJECT || "",
    OBJECTNAME: data.OBJECTNAME || "",
    OPERATION: data.OPERATION || "",
    DEVCLASS: data.DEVCLASS || "",
    RECORDING: data.RECORDING || "",
    RESULT: data.RESULT || "",
    TRANSPORTS: transports,
    MESSAGES: messages
  }
}

function extractTransports(raw: any): TransportHeader[] {
  if (!raw) return []
  return xmlArray(raw, "CTS_REQUEST").map((x: any) => {
    const h = x.REQ_HEADER || {}
    return {
      TRKORR: h.TRKORR || "",
      TRFUNCTION: h.TRFUNCTION || "",
      TRSTATUS: h.TRSTATUS || "",
      TARSYSTEM: h.TARSYSTEM || "",
      AS4USER: h.AS4USER || "",
      AS4TEXT: h.AS4TEXT || ""
    }
  })
}
