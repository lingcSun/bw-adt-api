import { templateValidationObjectType } from "../api/adso"
import { describeLive, testLive } from "./helpers/liveSystem"

/**
 * 模板 tlogo → validation objectType 映射（2026-09-19 复测 F4 修复）。
 * 取值依据 2026-09-20 真机实测：ADSO/IOBJ/RSDS 为合法 token；
 * DSO/ISRC 作为 objectType 直接被服务端拒绝（"Object type ... is not valid"）。
 */
describeLive("templateValidationObjectType()（F4）", () => {
  test("ADSO 模板按 ADSO 校验（保持原行为）", () => {
    expect(templateValidationObjectType("ADSO")).toBe("ADSO")
    expect(templateValidationObjectType("")).toBe("ADSO")
    expect(templateValidationObjectType(undefined)).toBe("ADSO")
  })

  test("IOBJ 模板按 IOBJ 校验（此前误按 ADSO 报不存在）", () => {
    expect(templateValidationObjectType("IOBJ")).toBe("IOBJ")
  })

  test("DSO 模板映射为 RSDS", () => {
    expect(templateValidationObjectType("DSO")).toBe("RSDS")
  })

  test("ISRC 无合法 token，跳过预检", () => {
    expect(templateValidationObjectType("ISRC")).toBeUndefined()
  })
})
