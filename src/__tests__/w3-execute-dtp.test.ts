/**
 * W3 修复回归（2026-09-21，Eclipse 抓包实证）：
 * - executeDTP → POST /sap/bw/modeling/dtpa/executerun（body executeRun@dtpId），
 *   201 + Location 头解析 runId
 * - getDTPExecuteRunResult → GET executerun/{dtpId}/{runId}?withLog=true，
 *   解析 executeRun 属性
 */
import { executeDTP, getDTPExecuteRunResult } from "../api/dtp"
import type { AdtHTTP } from "../AdtHTTP"
import { describeLive, testLive } from "./helpers/liveSystem"

const RUN_ID = "20260921024431000052000"
const LOCATION = `/sap/bw/modeling/dtpa/executerun/DTP_ET0916OM0DTEST0000000001/${RUN_ID}`

describeLive("executeDTP（executerun 端点）", () => {
  test("POST executerun 集合，201 + Location 解析 runId", async () => {
    const calls: Array<{ url: string; method: string; body?: string; headers: any }> = []
    const client = {
      async request(url: string, config: any) {
        calls.push({ url, method: config.method, body: config.body, headers: config.headers })
        return { status: 201, statusText: "Created", body: "", headers: { location: LOCATION } }
      }
    } as unknown as AdtHTTP
    const r = await executeDTP(client, "DTP_ET0916OM0DTEST0000000001")
    expect(calls[0]).toMatchObject({ url: "/sap/bw/modeling/dtpa/executerun", method: "POST" })
    expect(calls[0].body).toContain('dataTransferProcess="DTP_ET0916OM0DTEST0000000001"')
    expect(calls[0].headers["Content-Type"]).toContain("dtpa-v1_0_0+xml")
    expect(r).toMatchObject({ triggered: true, status: 201, runId: RUN_ID, location: LOCATION })
  })

  test("不再使用旧 ?action=execute 形态（本系统不支持）", async () => {
    const client = {
      async request(url: string) {
        expect(url).not.toContain("action=execute")
        return { status: 201, statusText: "Created", body: "", headers: { location: LOCATION } }
      }
    } as unknown as AdtHTTP
    await executeDTP(client, "DTP_X")
  })
})

describeLive("getDTPExecuteRunResult（轮询）", () => {
  test("GET executerun/{dtpId}/{runId}，解析 executeRun 属性", async () => {
    const calls: Array<{ url: string; qs: any }> = []
    const client = {
      async request(url: string, config: any) {
        calls.push({ url, qs: config.qs })
        return {
          status: 200, statusText: "OK",
          body: `<?xml version="1.0" encoding="utf-8"?><executeRun dataTransferProcess="DTP_ET0916OM0DTEST0000000001" requestId="${RUN_ID}"/>`,
          headers: {}
        }
      }
    } as unknown as AdtHTTP
    const r = await getDTPExecuteRunResult(client, "DTP_ET0916OM0DTEST0000000001", RUN_ID)
    expect(calls[0].url).toContain("/executerun/DTP_ET0916OM0DTEST0000000001/" + RUN_ID)
    expect(calls[0].qs).toEqual({ withLog: "true" })
    expect(r.dataTransferProcess).toBe("DTP_ET0916OM0DTEST0000000001")
    expect(r.requestId).toBe(RUN_ID)
  })

  test("withLog=false 透传", async () => {
    const client = {
      async request(_url: string, config: any) {
        expect(config.qs).toEqual({ withLog: "false" })
        return { status: 200, statusText: "OK", body: "<executeRun/>", headers: {} }
      }
    } as unknown as AdtHTTP
    await getDTPExecuteRunResult(client, "DTP_X", "R1", { withLog: false })
  })
})
