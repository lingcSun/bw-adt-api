/**
 * IOBJ 引用字段元素构建（2026-09-20 F11）与 TRFN 删除参数校验。
 * 引用元素的最小形态依据：真机水合样本含 infoObjectName + inlineType，
 * 但 PUT 只需 name + infoObjectName（无 inlineType），其余由服务器水合。
 */
import { buildADSOFieldElementXml, buildADSOInfoObjectElementXml } from "../api/adso"
import { AdtHTTP } from "../AdtHTTP"
import { BWObject, BWObjectType } from "../api/bwObject"

describe("buildADSOInfoObjectElementXml（F11）", () => {
  test("生成 name + infoObjectName，无 inlineType", () => {
    const xml = buildADSOInfoObjectElementXml({
      name: "ZREF1",
      infoObjectName: "0MATERIAL",
      label: "物料引用"
    })
    expect(xml).toContain('infoObjectName="0MATERIAL"')
    expect(xml).toContain('name="ZREF1"')
    expect(xml).toContain('dimension="#///CHA§"')
    expect(xml).not.toContain("<inlineType")
    expect(xml).toContain('<descriptions label="物料引用"/>')
  })

  test("完整 dimension 原样使用", () => {
    const xml = buildADSOInfoObjectElementXml({
      name: "ZREF1",
      infoObjectName: "0MATERIAL",
      dimension: "#///__CHARACTERISTIC§"
    })
    expect(xml).toContain('dimension="#///__CHARACTERISTIC§"')
  })

  test("缺 infoObjectName 抛错", () => {
    expect(() =>
      buildADSOInfoObjectElementXml({ name: "ZREF1" } as never)
    ).toThrow(/infoObjectName is required/)
  })
})

describe("buildADSOFieldElementXml 按 infoObjectName 分派", () => {
  test("带 infoObjectName 走引用分支（无 inlineType）", () => {
    const xml = buildADSOFieldElementXml({
      name: "ZREF1",
      infoObjectName: "0MATERIAL",
      dataType: "CHAR",
      length: 10
    })
    expect(xml).toContain('infoObjectName="0MATERIAL"')
    expect(xml).not.toContain("<inlineType")
  })

  test("不带 infoObjectName 走本地字段分支（有 inlineType）", () => {
    const xml = buildADSOFieldElementXml({ name: "ZF1", dataType: "CHAR", length: 5 })
    expect(xml).toContain("<inlineType")
    expect(xml).not.toContain("infoObjectName")
  })
})

describe("BWObject.delete 参数校验", () => {
  const fakeClient = {} as AdtHTTP

  test("TRFN 缺 lockHandle/transport 报错且指明 lockHandle 路径", async () => {
    const obj = new BWObject(fakeClient, BWObjectType.TRANSFORMATION, "01KMEOHXF74V6X392ZFX6AVPXYD4L7CA")
    await expect(obj.delete({})).rejects.toThrow(/requires options.lockHandle/)
  })

  test("TRFN 有 lockHandle 通过参数校验（URL 以后在请求层）", async () => {
    // 只验证校验分支：fake client 无 request，校验通过后会因 request 缺失抛 TypeError
    const obj = new BWObject(fakeClient, BWObjectType.TRANSFORMATION, "TRFN_ID")
    await expect(obj.delete({ lockHandle: "H" })).rejects.toThrow()
  })

  test("DTP 缺 lockHandle 报错（W1：DTP 纳入 lockHandle 删除模式）", async () => {
    const obj = new BWObject(fakeClient, BWObjectType.DTP, "DTP_1")
    await expect(obj.delete({})).rejects.toThrow(/requires options.lockHandle/)
    await expect(obj.delete({ lockHandle: "H" })).rejects.toThrow() // 校验通过后进入请求层（fake client 无 request）
  })
})
