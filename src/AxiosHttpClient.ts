import axios, {
  Axios,
  AxiosRequestConfig,
  AxiosResponseHeaders,
  AxiosHeaders,
  RawAxiosResponseHeaders,
  isAxiosError,
  AxiosResponse
} from "axios"
import { ClientOptions, HttpClient } from "."
import {
  HttpClientException,
  HttpClientOptions,
  HttpClientResponse,
  RequestMetadata,
  RequestOptions,
  ResponseHeaders
} from "./AdtHTTP"
import { hasMessage, isString } from "./utilities"

const toAxiosConfig = (
  options: RequestOptions & RequestMetadata
): AxiosRequestConfig & RequestMetadata => {
  const config: AxiosRequestConfig & RequestMetadata = {
    method: options.method || "GET",
    url: options.url,
    headers: options.headers || {},
    params: options.qs,
    httpsAgent: options.httpsAgent,
    timeout: options.timeout,
    auth: options.auth,
    data: options.body,
    adtRequestNumber: options.adtRequestNumber,
    adtStartTime: options.adtStartTime
  }
  return config
}

const convertheaders = (
  raw: RawAxiosResponseHeaders | AxiosResponseHeaders
): ResponseHeaders => {
  let headers: ResponseHeaders = {}
  if (raw instanceof AxiosHeaders) {
    for (const [key, value] of raw) {
      if (value instanceof AxiosHeaders)
        headers = { ...headers, ...convertheaders(value) }
      else headers[key] = value
    }
  }

  for (const k in Object.keys(raw)) {
    const val = raw[k]
    if (val instanceof AxiosHeaders)
      headers = { ...headers, ...convertheaders(val) }
    else headers[k] = val
  }
  return headers
}

/**
 * Normalize an axios response payload to the string body AdtHTTP expects.
 *
 * axios auto-parses JSON responses (content-type …+json, e.g. the BW/4
 * processvariant.chain payloads served under /sap/bw/modeling/rspc/*).
 * Template-stringifying such objects silently loses the payload
 * ("[object Object]"); re-serialize as JSON instead.
 */
export const responseBody = (data: unknown): string => {
  if (isString(data)) return data
  if (data == null) return ""
  return JSON.stringify(data)
}

const axiosRespToHttp = (raw: AxiosResponse): HttpClientResponse => {
  const { data, status, statusText, headers } = raw
  return {
    body: responseBody(data),
    status,
    statusText,
    headers: convertheaders(headers)
  }
}

export class AxiosHttpClient implements HttpClient {
  private axios: Axios
  constructor(private baseURL: string, private config?: ClientOptions) {
    const conf = toAxiosConfig({ ...config })
    this.axios = axios.create({ ...conf, baseURL })
  }
  async request(options: HttpClientOptions): Promise<HttpClientResponse> {
    try {
      const config = toAxiosConfig(options)
      const raw = await this.axios.request(config)
      return axiosRespToHttp(raw)
    } catch (error) {
      if (!isAxiosError(error)) {
        const message = hasMessage(error)
          ? error.message
          : "Unknown error in HTTP client"
        throw new HttpClientException(
          message,
          undefined,
          undefined,
          this.config,
          options,
          undefined,
          error
        )
      }
      const response = error.response && axiosRespToHttp(error.response)
      throw new HttpClientException(
        error.message,
        error.code,
        error.status,
        this.config,
        options,
        response,
        error
      )
    }
  }
}
