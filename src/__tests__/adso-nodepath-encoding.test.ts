/**
 * V5 修复回归锁（2026-09-20）：nodepath 双重编码。
 * 事实链：qs 值走 axios params（单次 encodeURIComponent）；调用方再预编码会上线
 * 成 %252F...，服务端报「Data type "" does not exist」。Eclipse 线上形态为单次编码。
 * 本测试锁定：getADSONodePath 传给 request 的 qs 必须是原始 URI 字符串。
 */
import { getADSONodePath } from "../api/adso"
import type { AdtHTTP } from "../AdtHTTP"

const ATOM_FEED = `<?xml version="1.0"?>
<atom:feed xmlns:atom="http://www.w3.org/2005/Atom">
  <atom:entry>
    <atom:title>area</atom:title>
    <atom:id>/sap/bw/modeling/area/test</atom:id>
    <atom:content><bwModel:object objectName="TEST" objectType="AREA"/></atom:content>
    <atom:link rel="http://www.sap.com/bw/modeling/relations:children" href="/children"/>
  </atom:entry>
</atom:feed>`

describe("getADSONodePath 编码契约（V5）", () => {
  test("qs.objectUri 是原始 URI，不含 %2F 预编码", async () => {
    let captured: Record<string, unknown> | undefined
    const fake = {
      async request(_url: string, config: any) {
        captured = config
        return { body: ATOM_FEED, status: 200, statusText: "OK", headers: {} }
      }
    } as unknown as AdtHTTP

    const nodes = await getADSONodePath(fake, "ZTEST_A1", "m")

    expect(captured).toBeDefined()
    expect((captured as any).qs.objectUri).toBe("/sap/bw/modeling/adso/ztest_a1/m")
    expect((captured as any).qs.objectUri).not.toContain("%2F")
    // 解析路径仍工作
    expect(nodes).toHaveLength(1)
    expect(nodes[0].type).toBe("AREA")
  })
})
