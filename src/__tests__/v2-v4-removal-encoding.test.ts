/**
 * V2 移除锁（2026-09-21）：/sap/bc/adt/bw/objects/* 服务树本系统 404（连父路径
 * 都不存在），infoObjects/infoObjectDetails/infoObjectCatalogs 及其类型已移除。
 * 证据：docs/VERIFIED_APIS.md 第 7 节 V2。防止无意恢复。
 *
 * V4 回归锁（2026-09-21）：命名空间对象名（/NS/OBJ）必须 encodeURIComponent 后
 * 进 URL 路径段，否则 / 被当路径切开 → 404。锁 getADSODetails / BWObject.lock
 * 的线上 URL 形态；常规名编码后应与原文相同（无操作）。
 */
import * as root from "../index"
import type { AdtHTTP } from "../AdtHTTP"

describe("V2：repository 死函数已移除", () => {
  test("根导出不含已移除函数与类型", () => {
    const rec = root as unknown as Record<string, unknown>
    for (const name of ["infoObjects", "infoObjectDetails", "infoObjectCatalogs"]) {
      expect(rec[name]).toBeUndefined()
    }
  })

  test("getInfoproviderStructure 仍导出（模块保留的唯一 API）", () => {
    expect(typeof (root as Record<string, unknown>).getInfoproviderStructure).toBe("function")
  })
})

function captureClient() {
  const urls: string[] = []
  const fake = {
    async request(url: string) {
      urls.push(url)
      return {
        body: '<?xml version="1.0"?><adso:dataStore xmlns:adso="http://www.sap.com/bw/modeling/adso.ecore" name="X"/>',
        status: 200, statusText: "OK", headers: {}
      }
    }
  } as unknown as AdtHTTP
  return { fake, urls }
}

describe("V4：命名空间对象名 URL 编码", () => {
  test("getADSODetails 对 /NS/ 名发出 %2F 编码路径", async () => {
    const { fake, urls } = captureClient()
    await root.getADSODetails(fake, "/CPM/A2ICBLQ")
    expect(urls[0]).toContain("/sap/bw/modeling/adso/%2Fcpm%2Fa2icblq/m")
    expect(urls[0]).not.toContain("/adso//cpm")
  })

  test("常规名编码为无操作（线上形态不变）", async () => {
    const { fake, urls } = captureClient()
    await root.getADSODetails(fake, "ZADSO_02")
    expect(urls[0]).toBe("/sap/bw/modeling/adso/zadso_02/m")
  })

  test("BWObject.lock 对 /NS/ 名编码（buildUri 统一路径）", async () => {
    const { fake, urls } = captureClient()
    const obj = root.createBWObject(fake, root.BWObjectType.ADSO, "/CPM/A2ICBLQ")
    await obj.lock().catch(() => undefined) // lock 解析会因假 body 失败，但 URL 已捕获
    expect(urls[0]).toContain("%2Fcpm%2Fa2icblq?action=lock")
  })
})
