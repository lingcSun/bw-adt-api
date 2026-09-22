/**
 * 动词家族审计 close-out：三建模域的 exists/delete（离线）。
 *
 * - exists → api 层 validateXxxExists，归一为 boolean：实测（API_REFERENCE
 *   validateADSOExists 行）对象不存在时 validation 端点直接报错而非 valid=false，
 *   门面把 AdtError 归一为 false；HttpClientException（网络/会话等传输层失败）
 *   原样重抛（2026-09-22 exists 错误语义收窄，不伪装成「不存在」）。
 * - delete 自管锁（2026-09-22）：门面内部先取域锁（lockADSO/lockTransformation/
 *   lockDTP）→ BWObject.delete({lockHandle, transport?})；成功路径**不** unlock
 *   ——真机卡带 lock→DELETE /m 全 200 即成立（删除即释放锁）；delete 失败才
 *   best-effort unlock（吞错）并原样上抛。options 只剩 { transport? }（0.x 行为
 *   变化：lockHandle 不再是调用方输入，倒挂的弃用 flat lock 依赖就此移除）。
 * - dataSource 明确不加 exists/delete（RSDS 删除无实测证据；分类学边界）。
 *
 * 全部断言离线可得：api 模块 spyOn 原位打桩 + {} as AdtHTTP，不发网络请求、
 * 不读 .env、不用 describeLive。
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

// spyOn 原位打桩（与 infoprovider-domain.test.ts / adso-model.test.ts 同款，P1-B
// 遗留工厂迁移）：被测门面是命名空间属性访问（adso.validateADSOExists(...)），
// 真模块单实例、就地替换，无需 jest.mock 工厂——工厂（含 requireActual 展开）
// 会把 real 模块图拖进 mock 注册表产生双实例（见 verb-family-audit 笔记）。
// BWObjectType 直接用真枚举（不再手拷字面量）。
const mockedADSOExists = jest.spyOn(adsoApi, "validateADSOExists") as jest.Mock
const mockedTrfnExists = jest.spyOn(
  trfnApi,
  "validateTransformationExists"
) as jest.Mock
const mockedDTPExists = jest.spyOn(dtpApi, "validateDTPExists") as jest.Mock
const mockedCreateBWObject = jest.spyOn(
  bwObjectApi,
  "createBWObject"
) as jest.Mock
const mockedADSOLock = jest.spyOn(adsoApi, "lockADSO") as jest.Mock
const mockedADSOUnlock = jest.spyOn(adsoApi, "unlockADSO") as jest.Mock
const mockedTrfnLock = jest.spyOn(trfnApi, "lockTransformation") as jest.Mock
const mockedTrfnUnlock = jest.spyOn(
  trfnApi,
  "unlockTransformation"
) as jest.Mock
const mockedDTPLock = jest.spyOn(dtpApi, "lockDTP") as jest.Mock
const mockedDTPUnlock = jest.spyOn(dtpApi, "unlockDTP") as jest.Mock

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
  mockedADSOLock.mockReset()
  mockedADSOUnlock.mockReset()
  mockedTrfnLock.mockReset()
  mockedTrfnUnlock.mockReset()
  mockedDTPLock.mockReset()
  mockedDTPUnlock.mockReset()
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

describe("delete 自管锁（域 lock → BWObject.delete → 失败才域 unlock）", () => {
  const DELETE_CASES: [
    string,
    AdsoDomain | TrfnDomain | DtpDomain,
    jest.Mock,
    jest.Mock,
    bwObjectApi.BWObjectType
  ][] = [
    ["adso", new AdsoDomain(h), mockedADSOLock, mockedADSOUnlock, bwObjectApi.BWObjectType.ADSO],
    ["trfn", new TrfnDomain(h), mockedTrfnLock, mockedTrfnUnlock, bwObjectApi.BWObjectType.TRANSFORMATION],
    ["dtp", new DtpDomain(h), mockedDTPLock, mockedDTPUnlock, bwObjectApi.BWObjectType.DTP]
  ]

  test.each(DELETE_CASES)(
    "%s.delete(id, {transport})：lock 被调 → BWObject.delete 收到 lockHandle → transport 透传",
    async (_name, domain, lockSpy, unlockSpy, objectType) => {
      const confirmation = { deleted: true as const, objectType, objectName: "ZTEST" }
      lockSpy.mockResolvedValue({ lockHandle: "LOCKHANDLE1" })
      const deleteSpy = stubBWObject(confirmation)
      await expect(
        domain.delete("ZTEST", { transport: "BPDK903312" })
      ).resolves.toBe(confirmation)
      expect(lockSpy).toHaveBeenCalledTimes(1)
      expect(lockSpy).toHaveBeenCalledWith(h, "ZTEST")
      expect(mockedCreateBWObject).toHaveBeenCalledTimes(1)
      expect(mockedCreateBWObject).toHaveBeenCalledWith(h, objectType, "ZTEST")
      expect(deleteSpy).toHaveBeenCalledTimes(1)
      expect(deleteSpy).toHaveBeenCalledWith({
        lockHandle: "LOCKHANDLE1",
        transport: "BPDK903312"
      })
      // 成功路径不 unlock：删除即释放锁（真机卡带 lock→DELETE 即成立），
      // 域级再 unlock 是多余请求
      expect(unlockSpy).not.toHaveBeenCalled()
    }
  )

  test.each(DELETE_CASES)(
    "%s.delete(id) 省略 options：仍自管锁，transport 透传为 undefined",
    async (_name, domain, lockSpy, _unlockSpy, _objectType) => {
      lockSpy.mockResolvedValue({ lockHandle: "LOCKHANDLE1" })
      const deleteSpy = stubBWObject()
      await expect(domain.delete("ZTEST")).resolves.toEqual({
        deleted: true
      })
      expect(lockSpy).toHaveBeenCalledTimes(1)
      expect(deleteSpy).toHaveBeenCalledWith({ lockHandle: "LOCKHANDLE1" })
    }
  )

  test.each(DELETE_CASES)(
    "%s.delete：BWObject.delete 抛错 → best-effort 域 unlock（吞错）且原异常上抛",
    async (_name, domain, lockSpy, unlockSpy, _objectType) => {
      const boom = new Error("delete failed on server")
      lockSpy.mockResolvedValue({ lockHandle: "LOCKHANDLE1" })
      const deleteSpy = stubBWObject()
      deleteSpy.mockRejectedValue(boom)
      await expect(
        domain.delete("ZTEST", { transport: "BPDK903312" })
      ).rejects.toBe(boom)
      // 失败路径锁还挂着（delete 没完成）：unlock 尝试一次，吞掉自身错误
      expect(unlockSpy).toHaveBeenCalledTimes(1)
      expect(unlockSpy).toHaveBeenCalledWith(h, "ZTEST")
    }
  )

  test.each(DELETE_CASES)(
    "%s.delete：best-effort unlock 自身也抛错 → 吞掉，仍上抛 delete 原异常",
    async (_name, domain, lockSpy, unlockSpy, _objectType) => {
      const boom = new Error("delete failed on server")
      lockSpy.mockResolvedValue({ lockHandle: "LOCKHANDLE1" })
      const deleteSpy = stubBWObject()
      deleteSpy.mockRejectedValue(boom)
      unlockSpy.mockRejectedValue(new Error("unlock failed too"))
      await expect(domain.delete("ZTEST")).rejects.toBe(boom)
      expect(unlockSpy).toHaveBeenCalledTimes(1)
    }
  )
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
