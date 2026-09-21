/**
 * W1/W2/W4 修复回归（2026-09-21）：
 * - W1: BWObject.delete 对 DTP 走 lockHandle 模式（服务端实测接受，同 TRFN）
 * - W2: createDTP 预检——TRFN 读不到 / inactive 时给可操作报错，不放过模糊失败
 * - W4: BWObject.create 的 parent 校验对 ADSO 用 AREA 类型（不再按 ADSO 查 InfoArea）
 */
import { BWObject, BWObjectType } from "../api/bwObject"
import { createDTP } from "../api/dtp"
import type { AdtHTTP } from "../AdtHTTP"
import { describeLive, testLive } from "./helpers/liveSystem"

const TRFN_XML = (status: string) =>
  `<?xml version="1.0"?><trfn:transformation xmlns:trfn="http://www.sap.com/bw/modeling/Trfn.ecore" name="T1">
  <tlogoProperties><objectStatus>${status}</objectStatus></tlogoProperties>
</trfn:transformation>`

const LOCK_XML = `<?xml version="1.0"?>
<asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0"><asx:values><DATA><LOCK_HANDLE>00H1</LOCK_HANDLE><IS_LOCAL>X</IS_LOCAL></DATA></asx:values></asx:abap>`

function routeClient(routes: Array<[RegExp, () => { body: string; status: number; statusText: string; headers: Record<string, string> }]>) {
  return {
    async request(url: string) {
      for (const [re, make] of routes) {
        if (re.test(url)) return make()
      }
      throw new Error("no route for " + url)
    }
  } as unknown as AdtHTTP
}

describeLive("W2：createDTP TRFN 预检", () => {
  test("TRFN inactive → 可操作报错（不放过模糊失败）", async () => {
    const client = routeClient([[/\/trfn\//, () => ({ body: TRFN_XML("inactive"), status: 200, statusText: "OK", headers: {} })]])
    await expect(
      createDTP(client, { sourceName: "ZA", targetName: "ZB", transformId: "T1" })
    ).rejects.toThrow(/is INACTIVE[\s\S]*saveAndActivateTransformation/)
  })

  test("TRFN 读不到 → 指引 createTransformation", async () => {
    const client = routeClient([[/\/trfn\//, () => { throw new Error("not found") }]] as never)
    await expect(
      createDTP(client, { sourceName: "ZA", targetName: "ZB", transformId: "T1" })
    ).rejects.toThrow(/could not be read[\s\S]*createTransformation/)
  })

  test("TRFN active → 预检放行（后续 CREA 流程由真机验证）", async () => {
    const calls: string[] = []
    const client = {
      async request(url: string) {
        calls.push(url)
        if (/\/trfn\//.test(url)) return { body: TRFN_XML("active"), status: 200, statusText: "OK", headers: {} }
        if (/action=lock/.test(url)) return { body: LOCK_XML, status: 200, statusText: "OK", headers: {} }
        if (/action=unlock/.test(url)) return { body: "", status: 200, statusText: "OK", headers: {} }
        if (/\/dtpa\//.test(url)) return { body: "<dtpa:dataTransferProcess/>", status: 200, statusText: "OK", headers: {} }
        throw new Error("no route: " + url)
      }
    } as unknown as AdtHTTP
    const r = await createDTP(client, { sourceName: "ZA", targetName: "ZB", transformId: "T1" })
    expect(r.dtpId).toMatch(/^DTP_[A-Z0-9]{26}$/)
    expect(calls.some((u) => /\/trfn\//.test(u))).toBe(true)
  })
})

describeLive("W4：create 的 parent 校验类型", () => {
  test("ADSO 的 parent 按 AREA 校验（不再按 ADSO 查 InfoArea）", async () => {
    const captured: Array<{ url: string; qs: Record<string, string> }> = []
    const client = {
      async request(url: string, config: any) {
        if (url.includes("/validation")) { captured.push({ url, qs: config.qs }); return { status: 200, statusText: "OK", body: "", headers: {} } }
        if (url.includes("action=lock")) return { body: LOCK_XML, status: 200, statusText: "OK", headers: {} }
        if (url.includes("action=unlock")) return { body: "", status: 200, statusText: "OK", headers: {} }
        return { body: "<adso:dataStore/>", status: 200, statusText: "OK", headers: {} }
      }
    } as unknown as AdtHTTP
    const obj = new BWObject(client, BWObjectType.ADSO, "ZW1TEST01")
    await obj.create("<adso:dataStore/>", { parent: "ZGLD_TEST" })
    const validations = captured.filter((c) => c.url.includes("/validation"))
    expect(validations[0].qs.objectType).toBe("AREA")
    expect(validations.some((v) => v.qs.objectType === "ADSO" && v.qs.objectName === "zgld_test")).toBe(false)
  })
})
