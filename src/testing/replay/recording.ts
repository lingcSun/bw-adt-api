/**
 * RecordingHttpClient：包裹真实 HttpClient 的录制代理——请求透传给 inner，
 * 同时把每对（请求快照, 响应快照）记录为卡带交互，供 saveCassette 落盘。
 *
 * - inner 抛出的异常原样上抛且不记录（卡带只录制成功的请求/响应往返）；
 * - sink 回调在每条交互记录后触发；实例自身即是可收集缓冲（interactions / toCassette）；
 * - saveCassette 是 src/testing/replay/ 唯一的磁盘写点（cassette.ts 的 loadCassette
 *   是唯一读点），供真机录制，本阶段不提供 CLI。
 */
import { writeFileSync } from "fs"
import { HttpClient, HttpClientOptions, HttpClientResponse } from "../../AdtHTTP"
import {
  Cassette,
  CassetteInteraction,
  snapshotRequest,
  snapshotResponse
} from "./cassette"

export type RecordingSink = (interaction: CassetteInteraction) => void

export class RecordingHttpClient implements HttpClient {
  private readonly recorded: CassetteInteraction[] = []

  constructor(
    private readonly inner: HttpClient,
    private readonly sink?: RecordingSink
  ) {}

  /** 已录制的交互（实例即缓冲） */
  get interactions(): readonly CassetteInteraction[] {
    return this.recorded
  }

  toCassette(): Cassette {
    return { interactions: [...this.recorded] }
  }

  async request(options: HttpClientOptions): Promise<HttpClientResponse> {
    const request = snapshotRequest(options)
    const response = await this.inner.request(options)
    const interaction: CassetteInteraction = {
      request,
      response: snapshotResponse(response)
    }
    this.recorded.push(interaction)
    this.sink?.(interaction)
    return response
  }

  /** 把已录制的交互以 JSON 卡带格式写入 path */
  saveCassette(path: string): void {
    writeFileSync(
      path,
      `${JSON.stringify(this.toCassette(), null, 2)}\n`,
      "utf8"
    )
  }
}
