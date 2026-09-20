/**
 * PC rspc JSON 解析回归（2026-09-20 F1 修复）。
 * fixture 结构取自真机 GET /rspc/{id}/m 的实测 payload（值已脱敏/简化）：
 * { bActive, sVariantDescription, oDetail, aSocket[], aExecutionOption[] }
 */
import { parseProcessChainMetaData, parseProcessChainDetails } from "../api/processchain"

const LIVE_SHAPE = JSON.stringify({
  bActive: true,
  sVariantDescription: "请求清理",
  oDetail: "",
  aSocket: [
    { sStatus: "positive", sSubStatus: "00", sDescription: "Successfully completed" },
    { sStatus: "negative", sSubStatus: "00", sDescription: "Ended with errors" }
  ],
  aExecutionOption: [{ name: "N", period: 0, description: "链运行时执行" }]
})

describe("parseProcessChainMetaData（rspc JSON）", () => {
  test("映射 bActive/sVariantDescription，名字由 chainId 回填", () => {
    const meta = parseProcessChainMetaData(LIVE_SHAPE, "Z_CHAIN")
    expect(meta.name).toBe("Z_CHAIN")
    expect(meta.description).toBe("请求清理")
    expect(meta.objVers).toBe("M")
    expect(meta.status).toBe("active")
  })

  test("bActive=false 视为仅修改版", () => {
    const meta = parseProcessChainMetaData(JSON.stringify({ bActive: false }), "Z_CHAIN")
    expect(meta.objVers).toBe("A")
    expect(meta.status).toBe("inactive")
  })

  test("非法 JSON 带原始片段抛错", () => {
    expect(() => parseProcessChainMetaData("<xml/>", "Z_CHAIN")).toThrow(/non-JSON/)
  })
})

describe("parseProcessChainDetails（rspc JSON）", () => {
  test("基本信息映射，steps/时间戳如实战意保留 undefined", () => {
    const d = parseProcessChainDetails(LIVE_SHAPE, "Z_CHAIN")
    expect(d.name).toBe("Z_CHAIN")
    expect(d.technicalName).toBe("Z_CHAIN")
    expect(d.description).toBe("请求清理")
    expect(d.status).toBe("active")
    expect(d.steps).toBeUndefined()
    expect(d.created).toBeUndefined()
    expect(d.changedBy).toBeUndefined()
  })

  test("chainId 缺省时 name 为空串（兼容旧签名）", () => {
    const d = parseProcessChainDetails(LIVE_SHAPE)
    expect(d.name).toBe("")
  })
})
