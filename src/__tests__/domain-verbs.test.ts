/**
 * 动词家族审计 close-out：三建模域的 exists/delete 薄转发（离线）。
 *
 * - exists → api 层 validateXxxExists，归一为 boolean：实测（API_REFERENCE
 *   validateADSOExists 行）对象不存在时 validation 端点直接报错而非 valid=false，
 *   门面把 AdtError 归一为 false；HttpClientException（网络/会话等传输层失败）
 *   原样重抛（2026-09-22 exists 错误语义收窄，不伪装成「不存在」）。
 * - delete → createBWObject + BWObject.delete 通用路径，options 原样透传
 *   （ADSO/TRFN/DTP 为 lockHandle 模式，VERIFIED_APIS §8 / W1）。
 * - dataSource 明确不加 exists/delete（RSDS 删除无实测证据；分类学边界）。
 *
 * 全部断言离线可得：jest.mock api 模块 + {} as AdtHTTP，不发网络请求、不读 .env、
 * 不用 describeLive。
 */
import type { AdtHTTP } from "../AdtHTTP"
import { HttpClientException } from "../AdtHTTP"
import { AdtErrorException } from "../AdtException"
import * as adsoApi from "../api/adso"
import * as trfnApi from "../api/transformation"
import * as dtpApi from "../api/dtp"
import * as bwObjectApi from "../api/bwObject"
import { AdsoDomain } from "../domains/adso"
import { TrfnDomain } from "../domains/trfn"
import { DtpDomain } from "../domains/dtp"
import { DataSourceDomain } from "../domains/dataSource"

// 极简工厂（与 infoarea-domain.test.ts 同款）：只提供被测路径触达的符号，
// 不 requireActual——real 模块图会把别的域文件拖进 mock 注册表，产生双实例。
jest.mock("../api/adso", () => ({
  validateADSOExists: jest.fn()
}))
jest.mock("../api/transformation", () => ({
  validateTransformationExists: jest.fn()
}))
jest.mock("../api/dtp", () => ({
  validateDTPExists: jest.fn()
}))
// BWObjectType 取值与真实枚举逐一核对（src/api/bwObject.ts）：
// ADSO="adso"、TRANSFORMATION="trfn"、DTP="dtpa"
jest.mock("../api/bwObject", () => ({
  createBWObject: jest.fn(),
  BWObjectType: {
    ADSO: "adso",
    TRANSFORMATION: "trfn",
    DTP: "dtpa"
  }
}))

const mockedADSOExists = adsoApi.validateADSOExists as jest.Mock
const mockedTrfnExists = trfnApi.validateTransformationExists as jest.Mock
const mockedDTPExists = dtpApi.validateDTPExists as jest.Mock
const mockedCreateBWObject = bwObjectApi.createBWObject as jest.Mock

const h = {} as AdtHTTP

/** createBWObject 桩：记录入参并返回带 delete spy 的假 BWObject。 */
function stubBWObject(deleteResult: unknown = { deleted: true }) {
  const deleteSpy = jest.fn().mockResolvedValue(deleteResult)
  mockedCreateBWObject.mockReturnValue({ delete: deleteSpy })
  return deleteSpy
}

beforeEach(() => {
  mockedADSOExists.mockReset()
  mockedTrfnExists.mockReset()
  mockedDTPExists.mockReset()
  mockedCreateBWObject.mockReset()
})

describe("exists 薄转发（validate *Exists → boolean 归一）", () => {
  test.each([
    ["adso", new AdsoDomain(h), mockedADSOExists],
    ["trfn", new TrfnDomain(h), mockedTrfnExists],
    ["dtp", new DtpDomain(h), mockedDTPExists]
  ])("%s.exists(id) 转发 validate 函数并把 valid 归一为 true", async (_name, domain, mocked) => {
    mocked.mockResolvedValue({ valid: true, message: "Validation passed" })
    await expect(domain.exists("ZTEST")).resolves.toBe(true)
    expect(mocked).toHaveBeenCalledTimes(1)
    expect(mocked).toHaveBeenCalledWith(h, "ZTEST")
  })

  test("valid=false 归一为 false（不抛错）", async () => {
    mockedADSOExists.mockResolvedValue({ valid: false })
    await expect(new AdsoDomain(h).exists("ZTEST")).resolves.toBe(false)
  })

  test("api 层抛 HttpClientException（网络/会话等传输层失败）→ 原样重抛（不伪装为 false）", async () => {
    const cases = [
      [new AdsoDomain(h), mockedADSOExists],
      [new TrfnDomain(h), mockedTrfnExists],
      [new DtpDomain(h), mockedDTPExists]
    ] as const
    for (const [domain, mocked] of cases) {
      const transport = new HttpClientException(
        "session expired / network down",
        "ECONNRESET",
        undefined,
        undefined,
        { url: "/sap/bc/adt/validate" }
      )
      mocked.mockRejectedValue(transport)
      // 同一异常实例原样上抛（ rejects.toBe 锁引用恒等，即「原样」）
      await expect(domain.exists("ZTEST")).rejects.toBe(transport)
    }
  })

  test("api 层抛 AdtError（not-found 形态，实测语义）→ 归一为 false（不抛错）", async () => {
    mockedADSOExists.mockRejectedValue(
      new AdtErrorException(404, {}, "", "ADSO ZNOPE 不存在")
    )
    await expect(new AdsoDomain(h).exists("ZNOPE")).resolves.toBe(false)
    mockedTrfnExists.mockRejectedValue(
      new AdtErrorException(404, {}, "", "转换 'ZNOPE' 不存在")
    )
    await expect(new TrfnDomain(h).exists("ZNOPE")).resolves.toBe(false)
    mockedDTPExists.mockRejectedValue(
      new AdtErrorException(404, {}, "", "DTP 'ZNOPE' 不存在")
    )
    await expect(new DtpDomain(h).exists("ZNOPE")).resolves.toBe(false)
  })
})

describe("delete 薄转发（createBWObject → BWObject.delete）", () => {
  test.each([
    ["adso", new AdsoDomain(h), bwObjectApi.BWObjectType.ADSO],
    ["trfn", new TrfnDomain(h), bwObjectApi.BWObjectType.TRANSFORMATION],
    ["dtp", new DtpDomain(h), bwObjectApi.BWObjectType.DTP]
  ])("%s.delete(id, options) 以正确 objectType 走 BWObject 路径并透传 options", async (
    _name,
    domain,
    objectType
  ) => {
    const confirmation = {
      deleted: true as const,
      objectType,
      objectName: "ZTEST"
    }
    const deleteSpy = stubBWObject(confirmation)
    const options = { lockHandle: "LOCKHANDLE1", transport: "BPDK903312" }
    await expect(domain.delete("ZTEST", options)).resolves.toBe(confirmation)
    expect(mockedCreateBWObject).toHaveBeenCalledTimes(1)
    expect(mockedCreateBWObject).toHaveBeenCalledWith(h, objectType, "ZTEST")
    expect(deleteSpy).toHaveBeenCalledTimes(1)
    expect(deleteSpy).toHaveBeenCalledWith(options)
  })

  test("options 省略时透传为空对象（缺 lockHandle 由 BWObject.delete 报错）", async () => {
    const deleteSpy = stubBWObject()
    await new AdsoDomain(h).delete("ZTEST")
    expect(deleteSpy).toHaveBeenCalledWith({})
  })
})

describe("dataSource 不加 exists/delete（taxonomy 边界纪律）", () => {
  test("DataSourceDomain 原型上不存在 exists/delete", () => {
    const methods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(new DataSourceDomain(h))
    ).filter(n => n !== "constructor")
    expect(methods).not.toContain("exists")
    expect(methods).not.toContain("delete")
  })
})
