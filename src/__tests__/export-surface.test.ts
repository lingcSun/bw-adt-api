/**
 * 包根导出面回归。
 * 只断言离线可得的事实：符号存在且类型正确，不发任何网络请求。
 */
import * as root from "../index"
import { SearchObjectType } from "../api/search"
import { TrfnDomain } from "../domains/trfn"

describe("包根导出面", () => {
  test("api 层函数从根入口可导入", () => {
    expect(typeof root.createTransformation).toBe("function")
    expect(typeof root.createDTP).toBe("function")
    expect(typeof root.createADSO).toBe("function")
    expect(typeof root.createADSOFull).toBe("function")
    expect(typeof root.createBWObject).toBe("function")
    expect(typeof root.BWObjectType).toBe("object")
    expect(typeof root.addADSOFieldToXml).toBe("function")
    expect(typeof root.addRule).toBe("function")
  })

  test("transport 辅助仍从根入口可导入（原显式块改经 ./api 再导出）", () => {
    expect(typeof root.transportCheck).toBe("function")
    expect(typeof root.createTransport).toBe("function")
    expect(typeof root.resolveTransportForWrite).toBe("function")
    expect(typeof root.TransportRequiredError).toBe("function")
    expect(typeof root.isTransportRequiredError).toBe("function")
  })

  test("域门面类从根入口可导入", () => {
    expect(typeof root.TrfnDomain).toBe("function")
    expect(typeof root.AdsoDomain).toBe("function")
  })
})

describe("TrfnDomain.create 门面", () => {
  test("存在且为函数", () => {
    expect(typeof TrfnDomain.prototype.create).toBe("function")
  })
})

describe("SearchObjectType.PROCESS_CHAIN", () => {
  test("枚举值为 RSPC（旧值 PROCS_CHAIN 服务端 500）", () => {
    expect(SearchObjectType.PROCESS_CHAIN).toBe("RSPC")
  })
})
