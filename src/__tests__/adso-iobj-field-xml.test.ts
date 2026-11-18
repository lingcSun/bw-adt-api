/**
 * IOBJ hang 字段元素构建与 TRFN 删除参数校验。
 * - CHA：极简 name+infoObjectName
 * - UNI/KYF：hang 骨架（keep/inlineType/associationType，无 atom:link）
 */
import { buildADSOFieldElementXml, buildADSOInfoObjectElementXml } from "../api/adso"
import { AdtHTTP } from "../AdtHTTP"
import { BWObject, BWObjectType } from "../api/bwObject"

describe("buildADSOInfoObjectElementXml（hang）", () => {
  test("CHA：name + infoObjectName，无 inlineType", () => {
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

  test("CHA：完整 dimension 原样使用", () => {
    const xml = buildADSOInfoObjectElementXml({
      name: "ZREF1",
      infoObjectName: "0MATERIAL",
      dimension: "#///__CHARACTERISTIC§"
    })
    expect(xml).toContain('dimension="#///__CHARACTERISTIC§"')
  })

  test("UNI hang：ZC_RWCUR 形态（sid=S、base 0CURRENCY、无 localProperties）", () => {
    const xml = buildADSOInfoObjectElementXml({
      name: "ZC_RWCUR",
      infoObjectName: "ZC_RWCUR",
      infoObjectType: "UNI",
      label: "交易币种"
    })
    expect(xml).toContain('keep="false"')
    expect(xml).toContain('aggregationBehavior="NONE"')
    expect(xml).toContain('baseInfoObjectName="0CURRENCY"')
    expect(xml).toContain('dimension="#///UNI§"')
    expect(xml).toContain('sidDeterminationMode="S"')
    expect(xml).toContain('semanticType="currencyCode"')
    expect(xml).toContain("<fixedCurrency></fixedCurrency>")
    expect(xml).toContain("<associationType>1</associationType>")
    expect(xml).not.toContain("localProperties")
    expect(xml).not.toContain("atom:link")
    expect(xml).not.toContain("consumptionViewProperties")
  })

  test("KYF hang：ZK_WSL 形态（SUM、unitCurrency、sid=N）", () => {
    const xml = buildADSOInfoObjectElementXml({
      name: "ZK_WSL",
      infoObjectName: "ZK_WSL",
      unitCurrencyElement: "ZC_RWCUR",
      label: "以交易货币计金额"
    })
    expect(xml).toContain('keep="false"')
    expect(xml).toContain('aggregationBehavior="SUM"')
    expect(xml).toContain('dimension="#///KYF§"')
    expect(xml).toContain('sidDeterminationMode="N"')
    expect(xml).toContain("<unitCurrencyElement>#///ZC_RWCUR</unitCurrencyElement>")
    expect(xml).toContain('inlineType name="CURR"')
    expect(xml).toContain('semanticType="empty"')
    expect(xml).not.toContain("localProperties")
    expect(xml).not.toContain("atom:link")
  })

  test("缺 infoObjectName 抛错", () => {
    expect(() =>
      buildADSOInfoObjectElementXml({ name: "ZREF1" } as never)
    ).toThrow(/infoObjectName is required/)
  })
})

describe("buildADSOFieldElementXml 按 infoObjectName 分派", () => {
  test("带 infoObjectName 走引用分支（CHA 无 inlineType）", () => {
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

  test("IOBJ + unitCurrencyElement 走 KYF hang", () => {
    const xml = buildADSOFieldElementXml({
      name: "ZK_WSL",
      infoObjectName: "ZK_WSL",
      unitCurrencyElement: "ZC_RWCUR"
    })
    expect(xml).toContain('infoObjectName="ZK_WSL"')
    expect(xml).toContain('dimension="#///KYF§"')
    expect(xml).toContain('aggregationBehavior="SUM"')
    expect(xml).toContain("<unitCurrencyElement>#///ZC_RWCUR</unitCurrencyElement>")
    expect(xml).toContain("<inlineType")
  })
})

describe("BWObject.delete 参数校验", () => {
  const fakeClient = {} as AdtHTTP

  test("TRFN 缺 lockHandle/transport 报错且指明 lockHandle 路径", async () => {
    const obj = new BWObject(fakeClient, BWObjectType.TRANSFORMATION, "01KMEOHXF74V6X392ZFX6AVPXYD4L7CA")
    await expect(obj.delete({})).rejects.toThrow(/requires options.lockHandle/)
  })

  test("TRFN 有 lockHandle 通过参数校验（URL 以后在请求层）", async () => {
    const obj = new BWObject(fakeClient, BWObjectType.TRANSFORMATION, "TRFN_ID")
    await expect(obj.delete({ lockHandle: "H" })).rejects.toThrow()
  })

  test("DTP 缺 lockHandle 报错（lockHandle 删除模式）", async () => {
    const obj = new BWObject(fakeClient, BWObjectType.DTP, "DTP_1")
    await expect(obj.delete({})).rejects.toThrow(/requires options.lockHandle/)
    await expect(obj.delete({ lockHandle: "H" })).rejects.toThrow()
  })
})
