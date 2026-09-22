/**
 * ReplayHttpClient：按卡带 FIFO 回放 HTTP 交互的 HttpClient 实现，全程零网络。
 *
 * 匹配规则（URL 归一化，见 normalizeUrlPath/urlMatches）：
 * - method 大小写不敏感；请求缺省 method 视为 "GET"（与 AxiosHttpClient 线上默认一致）；
 * - 两侧 URL 去掉 #fragment 与 ?query，去掉 scheme://authority（含协议相对 //host），
 *   相对路径补前导 "/"，不做百分号解码（两侧须用与线上一致的编码）；
 * - 卡带 url 须是请求 url 的「按路径段前缀」：路径相等，或请求路径以卡带路径 + "/" 开头。
 *
 * 语义：
 * - `.sent` 捕获每一个经过的请求（含失配/耗尽的），headers/body 为快照；
 * - 匹配成功才前进游标；失配不消耗交互（修正请求后同一条仍可消费）；
 * - 失配/耗尽抛 HttpClientException，诊断同时给出期望的下一条交互与实际请求。
 */
import {
  HttpClient,
  HttpClientException,
  HttpClientOptions,
  HttpClientResponse
} from "../../AdtHTTP"
import {
  Cassette,
  CassetteInteraction,
  SentRequest,
  snapshotRequest,
  snapshotResponse
} from "./cassette"

export const CASSETTE_MISMATCH = "CASSETTE_MISMATCH"
export const CASSETTE_EXHAUSTED = "CASSETTE_EXHAUSTED"

/**
 * URL 归一化：只保留路径部分。规则见文件头注释；"/"（根路径）匹配一切请求路径，
 * 可用作通配前缀。
 */
export const normalizeUrlPath = (url: string): string => {
  let path = url.split("#")[0].split("?")[0]
  const scheme = /^[a-z][a-z0-9+.-]*:\/\//i.exec(path)
  if (scheme) {
    const rest = path.slice(scheme[0].length)
    const firstSlash = rest.indexOf("/")
    path = firstSlash >= 0 ? rest.slice(firstSlash) : "/"
  } else if (path.startsWith("//")) {
    const firstSlash = path.indexOf("/", 2)
    path = firstSlash >= 0 ? path.slice(firstSlash) : "/"
  }
  return path.startsWith("/") ? path : `/${path}`
}

/** 卡带 url 是否按路径段前缀匹配请求 url */
export const urlMatches = (expectedUrl: string, actualUrl: string): boolean => {
  const expected = normalizeUrlPath(expectedUrl)
  const actual = normalizeUrlPath(actualUrl)
  return actual === expected || actual.startsWith(`${expected}/`)
}

const effectiveMethod = (r: { method?: string }): string =>
  (r.method || "GET").toUpperCase()

/** 卡带交互的请求是否匹配实际请求：method 相等（忽略大小写）+ URL 按段前缀 */
export const requestMatches = (
  expected: SentRequest,
  actual: HttpClientOptions
): boolean =>
  effectiveMethod(expected) === effectiveMethod(actual) &&
  urlMatches(expected.url, actual.url)

const describeOptions = (options: HttpClientOptions): string =>
  `${options.method || "GET"} ${options.url}`

const describeExpected = (interaction: CassetteInteraction): string =>
  `${interaction.request.method.toUpperCase()} ${interaction.request.url}`

export class ReplayHttpClient implements HttpClient {
  private cursor = 0
  private readonly captured: SentRequest[] = []

  constructor(private readonly tape: Cassette) {}

  /** 捕获的每一次请求（含未匹配上的），headers/body 为快照 */
  get sent(): readonly SentRequest[] {
    return this.captured
  }

  /** 尚未消费的交互数 */
  get remaining(): number {
    return this.tape.interactions.length - this.cursor
  }

  async request(options: HttpClientOptions): Promise<HttpClientResponse> {
    this.captured.push(snapshotRequest(options))
    const total = this.tape.interactions.length
    const expected = this.tape.interactions[this.cursor]
    if (!expected)
      throw new HttpClientException(
        `Cassette exhausted: all ${total} interaction(s) consumed, ` +
          `got unexpected request ${describeOptions(options)}`,
        CASSETTE_EXHAUSTED,
        undefined,
        undefined,
        options
      )
    if (!requestMatches(expected.request, options))
      throw new HttpClientException(
        `Cassette mismatch at interaction ${this.cursor + 1}/${total}: ` +
          `expected ${describeExpected(expected)}, got ${describeOptions(options)}`,
        CASSETTE_MISMATCH,
        undefined,
        undefined,
        options
      )
    this.cursor++
    return snapshotResponse(expected.response)
  }
}
