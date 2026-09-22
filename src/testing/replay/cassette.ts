/**
 * 卡带（cassette）数据格式：一段 HTTP 会话录制的请求/响应交互序列。
 *
 * 磁盘格式为 JSON：`{ "interactions": [ { "request": {...}, "response": {...} } ] }`。
 * 手写卡带（引擎合规测试用）只须给出 `request.method`/`request.url`，
 * 其余字段由 cassetteInteraction()/normalizeCassette() 兜底默认值。
 * `request.qs` 可选记录（快照/诊断参考）；回放匹配只看 method+路径，qs 不参与。
 * 旧形状卡带（缺 qs）照常回放——qs 字段缺省即不落。
 *
 * 诚实原则：卡带只用于断言「引擎遵从会话规约」；凡断言服务端真实行为的测试
 * 必须走活系统（describeLive），不得用手工卡带冒充实测证据。
 */
import { readFileSync } from "fs"
import { HttpClientOptions, ResponseHeaders } from "../../AdtHTTP"
import { hasMessage, isObject, isString } from "../../utilities"

/** 一次发出的请求的快照（headers/qs 拷贝，后续篡改不影响已捕获内容；qs 仅供诊断参考） */
export interface SentRequest {
  method: string
  url: string
  headers: Record<string, string>
  qs?: Record<string, string>
  body?: string
}

/** 卡带里录制的响应（ResponseHeaders 可含 set-cookie: string[]，JSON 可序列化） */
export interface CassetteResponse {
  status: number
  statusText: string
  headers: ResponseHeaders
  body: string
}

export interface CassetteInteraction {
  request: SentRequest
  response: CassetteResponse
}

export interface Cassette {
  interactions: CassetteInteraction[]
}

/** 手写卡带的宽松输入形状：只给 method+url 也可，其余字段兜底 */
export interface CassetteInteractionInput {
  request: {
    method: string
    url: string
    headers?: Record<string, string>
    /** 可选记录（仅供参考，不参与回放匹配——匹配仍只看 method+路径）；缺省即不落字段 */
    qs?: Record<string, string>
    body?: string
  }
  response?: {
    status?: number
    statusText?: string
    headers?: ResponseHeaders
    body?: string
  }
}

/** headers 浅拷贝 + 值为数组的一律浅拷贝数组（set-cookie 等多值头的变异隔离） */
const cloneHeaders = (headers: ResponseHeaders): ResponseHeaders => {
  const cloned: ResponseHeaders = {}
  for (const [key, value] of Object.entries(headers))
    cloned[key] = Array.isArray(value) ? [...value] : value
  return cloned
}

/**
 * 从 HttpClientOptions 抽取请求快照（`.sent` 捕获与录制共用）。
 * method 缺省记为 "GET"，与 AxiosHttpClient 的线上默认一致；其余字段原样保真。
 */
export const snapshotRequest = (options: HttpClientOptions): SentRequest => ({
  method: options.method || "GET",
  url: options.url,
  headers: { ...(options.headers || {}) },
  ...(options.qs === undefined ? {} : { qs: { ...(options.qs || {}) } }),
  ...(options.body === undefined ? {} : { body: options.body })
})

/** 从 HttpClientResponse / CassetteResponse 抽取响应快照（拷贝 headers 与 set-cookie 数组） */
export const snapshotResponse = (r: {
  status: number
  statusText: string
  headers: ResponseHeaders
  body: string
}): CassetteResponse => ({
  status: r.status,
  statusText: r.statusText,
  headers: cloneHeaders(r.headers),
  body: r.body
})

/** 把宽松输入规范成完整交互；缺 request.method/url 或形状不对则抛带说明的错误 */
export const cassetteInteraction = (
  input: CassetteInteractionInput
): CassetteInteraction => {
  if (!isObject(input) || !isObject(input.request))
    throw new Error(
      "cassette interaction: expected { request: { method, url }, response? }"
    )
  const { method, url } = input.request
  if (!isString(method) || !isString(url))
    throw new Error(
      `cassette interaction: request.method and request.url are required (got ${JSON.stringify(
        input.request
      )})`
    )
  const status = input.response?.status ?? 200
  return {
    request: {
      method,
      url,
      headers: { ...(input.request.headers || {}) },
      ...(input.request.qs === undefined ? {} : { qs: { ...(input.request.qs || {}) } }),
      ...(input.request.body === undefined ? {} : { body: input.request.body })
    },
    response: {
      status,
      statusText: input.response?.statusText ?? (status === 200 ? "OK" : ""),
      headers: input.response?.headers ? cloneHeaders(input.response.headers) : {},
      body: input.response?.body ?? ""
    }
  }
}

/** 手写卡带构造器：cassette({ request: {...}, response?: {...} }, ...) */
export const cassette = (
  ...interactions: CassetteInteractionInput[]
): Cassette => ({ interactions: interactions.map(cassetteInteraction) })

/** 校验并规范任意输入（如 JSON.parse 的产物）为 Cassette；source 仅用于错误定位 */
export const normalizeCassette = (raw: unknown, source?: string): Cassette => {
  const where = source ? ` in ${source}` : ""
  if (!isObject(raw) || Array.isArray(raw))
    throw new Error(`cassette${where}: expected an object with an interactions array`)
  const rawInteractions = (raw as { interactions?: unknown }).interactions
  if (!Array.isArray(rawInteractions))
    throw new Error(`cassette${where}: expected an object with an interactions array`)
  return {
    interactions: rawInteractions.map((item: unknown, index: number) => {
      try {
        return cassetteInteraction(item as CassetteInteractionInput)
      } catch (e) {
        throw new Error(
          `cassette${where}: interaction #${index}: ${
            hasMessage(e) ? e.message : String(e)
          }`
        )
      }
    })
  }
}

/** 从磁盘读取卡带 JSON 并规范；文件缺失/JSON 损坏/形状不对都抛带路径的错误 */
export const loadCassette = (path: string): Cassette => {
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, "utf8"))
  } catch (e) {
    throw new Error(
      `loadCassette: cannot read cassette ${path}: ${
        hasMessage(e) ? e.message : String(e)
      }`
    )
  }
  return normalizeCassette(raw, path)
}
