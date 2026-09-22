/**
 * AdsoModel——水合式 ADSO 编辑模型（P2 Task 1，离线）。
 *
 * 语义契约：
 * - hydrate 用 forceCacheUpdate=true 全新读（getADSOXml jest.mock）；
 * - 三个编辑方法（addField/removeField/addKey）只调 src/api/adso.ts 的纯变换，
 *   成功才替换工作副本并追加 op；抛错则两者皆不变、异常原样上抛；
 * - op-log 记录调用者可见意图（kind + args + summary），plan() 即 diff 预览。
 *
 * fixture XML 削自 src/__tests__/adso-field-xml.test.ts 的 SAMPLE_ADSO_XML
 * （同一批纯函数的最小可用形态：一个 element + 一个 keyElement + 闭合标签）。
 * 全部断言离线可得：不发网络请求、不读 .env、不用 describeLive。
 */
import type { AdtHTTP } from "../AdtHTTP"
import { getADSOXml } from "../api/adso"
import { AdsoModel } from "../model"

jest.mock("../api/adso", () => ({
  ...jest.requireActual("../api/adso"),
  getADSOXml: jest.fn()
}))

const mockedGetXml = getADSOXml as jest.Mock

const ADSO_ID = "ZTEST_ADSO"

const FIXTURE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<adso:dataStore xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:BwCore="http://www.sap.com/bw/modeling/BwCore.ecore" xmlns:adso="http://www.sap.com/bw/modeling/adso.ecore" name="ZTEST_ADSO">
  <element xsi:type="adso:AdsoElement" name="AUGBL" dimension="#///CHA§" sidDeterminationMode="N">
    <inlineType name="CHAR" length="10" semanticType="empty"/>
    <localProperties xsi:type="BwCore:LocalCharacteristicProperties">
      <descriptions label="清账凭证号"/>
    </localProperties>
  </element>
  <keyElement>#///0AC_LEDGER</keyElement>
</adso:dataStore>`

const h = {} as AdtHTTP

/** hydrate 一个干净模型（getADSOXml 已 mock 为返回 fixture）。 */
async function hydrated(): Promise<AdsoModel> {
  return AdsoModel.hydrate(h, ADSO_ID)
}

beforeEach(() => {
  mockedGetXml.mockReset().mockResolvedValue(FIXTURE_XML)
})

describe("AdsoModel.hydrate", () => {
  test("fresh 读（forceCacheUpdate=true），xml 即读到的 XML，ops 为空", async () => {
    const model = await hydrated()

    expect(mockedGetXml).toHaveBeenCalledTimes(1)
    expect(mockedGetXml).toHaveBeenCalledWith(h, ADSO_ID, true)
    expect(model.id).toBe(ADSO_ID)
    expect(model.xml).toBe(FIXTURE_XML)
    expect(model.ops).toEqual([])
  })
})

describe("AdsoModel.addField", () => {
  test("xml 含新字段元素，ops 记录意图（summary 含字段名），可链式", async () => {
    const model = await hydrated()
    const field = { name: "ZAPI_FLD", dataType: "CHAR" as const, length: 20 }

    const ret = model.addField(field)

    expect(ret).toBe(model)
    expect(model.xml).toContain('name="ZAPI_FLD"')
    expect(model.xml).toContain('name="AUGBL"') // 既有内容不动
    expect(model.ops).toHaveLength(1)
    expect(model.ops[0].kind).toBe("addField")
    expect(model.ops[0].summary).toContain("ZAPI_FLD")
    expect(model.ops[0].args).toEqual([field])
    expect(typeof model.ops[0].at).toBe("string")
    expect(Number.isNaN(Date.parse(model.ops[0].at))).toBe(false)
  })

  test("重复加同名字段抛错且 xml/ops 皆不变", async () => {
    const model = await hydrated()
    model.addField({ name: "ZAPI_FLD", length: 20 })
    const xmlBefore = model.xml
    const opsBefore = model.ops

    expect(() => model.addField({ name: "ZAPI_FLD", length: 1 })).toThrow(
      /already exists/
    )
    expect(model.xml).toBe(xmlBefore)
    expect(model.ops).toEqual(opsBefore)
  })
})

describe("AdsoModel.removeField", () => {
  test("移除后 xml 不再含该字段，ops 记录意图", async () => {
    const model = await hydrated()

    model.removeField("AUGBL")

    expect(model.xml).not.toContain('name="AUGBL"')
    expect(model.xml).toContain("<keyElement>")
    expect(model.ops).toHaveLength(1)
    expect(model.ops[0].kind).toBe("removeField")
    expect(model.ops[0].summary).toContain("AUGBL")
    expect(model.ops[0].args).toEqual(["AUGBL"])
  })

  test("移除不存在的字段抛错且 xml/ops 皆不变", async () => {
    const model = await hydrated()

    expect(() => model.removeField("NO_SUCH_FIELD")).toThrow(/not found/)
    expect(model.xml).toBe(FIXTURE_XML)
    expect(model.ops).toEqual([])
  })
})

describe("AdsoModel.addKey", () => {
  test("xml 含 keyElement 与同名引用元素，ops 记录意图", async () => {
    const model = await hydrated()

    model.addKey("0MATERIAL")

    expect(model.xml).toContain("<keyElement>#///0MATERIAL</keyElement>")
    expect(model.xml).toContain('name="0MATERIAL"')
    expect(model.xml).toContain("<keyElement>#///0AC_LEDGER</keyElement>") // 既有键不动
    expect(model.ops).toHaveLength(1)
    expect(model.ops[0].kind).toBe("addKey")
    expect(model.ops[0].summary).toContain("0MATERIAL")
    expect(model.ops[0].args).toEqual(["0MATERIAL", undefined])
  })

  test("非法 InfoObject 名抛错且 xml/ops 皆不变", async () => {
    const model = await hydrated()

    expect(() => model.addKey("BAD NAME!")).toThrow(/invalid InfoObject name/)
    expect(model.xml).toBe(FIXTURE_XML)
    expect(model.ops).toEqual([])
  })
})

describe("AdsoModel.plan", () => {
  test("无 op 时返回 (no pending ops)", async () => {
    const model = await hydrated()
    expect(model.plan()).toEqual(["(no pending ops)"])
  })

  test("有 op 时逐条给出 diff 预览（kind 与 summary 在列）", async () => {
    const model = await hydrated()
    model
      .addField({ name: "ZAPI_FLD", length: 20 })
      .addKey("0MATERIAL")
      .removeField("AUGBL")

    const plan = model.plan()
    expect(plan).toHaveLength(3)
    expect(plan[0]).toContain("addField")
    expect(plan[0]).toContain("ZAPI_FLD")
    expect(plan[1]).toContain("addKey")
    expect(plan[1]).toContain("0MATERIAL")
    expect(plan[2]).toContain("removeField")
    expect(plan[2]).toContain("AUGBL")
    expect(plan).not.toContain("(no pending ops)")
  })
})
