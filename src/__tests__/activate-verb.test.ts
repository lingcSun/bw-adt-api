/**
 * 建模域裸 activate 正名 + 自管实现（2026-09-22，离线）。
 *
 * 用户确认存在纯激活场景（重激活已保存对象，如 TRFN 变更后 DTP 被取消激活
 * 需重激活），`activate` 正名为 modeling 家族动词；adso/trfn 补自管锁的
 * activate（与 saveAndActivate/delete 同模式：lock → activate → finally
 * 吞错 unlock），dtp 既有 activate 的裸 finally 修复（unlock 抛错不再掩盖
 * 激活原异常）。与 delete 的差别：激活不释放锁（BWObject.delete 内部自带
 * 吞错 unlock），故 activate 在成功路径也必须域级 unlock——始终 unlock。
 * `.advanced.activate` 保持调用方持锁语义不变（两契约隔离）。
 * dataSource 不加 activate（无独立激活实测记录，分类学边界纪律）。
 *
 * 全部断言离线可得：api 模块 spyOn 原位打桩 + {} as AdtHTTP，不发网络请求、
 * 不读 .env、不用 describeLive。
 */
import type { AdtHTTP } from "../AdtHTTP"
import * as adsoApi from "../api/adso"
import * as trfnApi from "../api/transformation"
import * as dtpApi from "../api/dtp"
import { AdsoDomain } from "../domains/adso"
import { TrfnDomain } from "../domains/trfn"
import { DtpDomain } from "../domains/dtp"
import { DataSourceDomain } from "../domains/dataSource"
import { getDomain, VERB_FAMILIES } from "../domains/registry"

// spyOn 原位打桩（真模块单实例就地替换；不用 jest.mock 工厂——双实例坑见
// verb-family-audit / adso-model 笔记）
const mockedADSOLock = jest.spyOn(adsoApi, "lockADSO") as jest.Mock
const mockedADSOUnlock = jest.spyOn(adsoApi, "unlockADSO") as jest.Mock
const mockedADSOActivate = jest.spyOn(adsoApi, "activateADSO") as jest.Mock
const mockedTrfnLock = jest.spyOn(trfnApi, "lockTransformation") as jest.Mock
const mockedTrfnUnlock = jest.spyOn(
  trfnApi,
  "unlockTransformation"
) as jest.Mock
const mockedTrfnActivate = jest.spyOn(
  trfnApi,
  "activateTransformation"
) as jest.Mock
const mockedDTPLock = jest.spyOn(dtpApi, "lockDTP") as jest.Mock
const mockedDTPUnlock = jest.spyOn(dtpApi, "unlockDTP") as jest.Mock
const mockedDTPActivate = jest.spyOn(dtpApi, "activateDTP") as jest.Mock

const h = {} as AdtHTTP

beforeEach(() => {
  mockedADSOLock.mockReset()
  mockedADSOUnlock.mockReset()
  mockedADSOActivate.mockReset()
  mockedTrfnLock.mockReset()
  mockedTrfnUnlock.mockReset()
  mockedTrfnActivate.mockReset()
  mockedDTPLock.mockReset()
  mockedDTPUnlock.mockReset()
  mockedDTPActivate.mockReset()
})

describe("activate 自管锁（lock → activate → 始终 finally 吞错 unlock）", () => {
  test.each([
    ["adso", new AdsoDomain(h), mockedADSOLock, mockedADSOUnlock, mockedADSOActivate],
    ["trfn", new TrfnDomain(h), mockedTrfnLock, mockedTrfnUnlock, mockedTrfnActivate]
  ] as const)(
    "%s.activate：lock 被调 → activate 收到 lockHandle → 始终 unlock（激活不释放锁）",
    async (_name, domain, lockSpy, unlockSpy, activateSpy) => {
      const activated = { success: true, messages: [] }
      lockSpy.mockResolvedValue({ lockHandle: "LOCKHANDLE1" })
      activateSpy.mockResolvedValue(activated)
      await expect(domain.activate("ZTEST")).resolves.toBe(activated)
      expect(lockSpy).toHaveBeenCalledTimes(1)
      expect(lockSpy).toHaveBeenCalledWith(h, "ZTEST")
      expect(activateSpy).toHaveBeenCalledTimes(1)
      // 与 delete 不同：激活不释放锁，成功路径也要域级 unlock
      expect(unlockSpy).toHaveBeenCalledTimes(1)
      expect(unlockSpy).toHaveBeenCalledWith(h, "ZTEST")
    }
  )

  test("adso.activate(id, {transport})：transport 作 corrNr 透传 activateADSO", async () => {
    const activated = { success: true, messages: [] }
    mockedADSOLock.mockResolvedValue({ lockHandle: "LOCKHANDLE1" })
    mockedADSOActivate.mockResolvedValue(activated)
    await expect(
      new AdsoDomain(h).activate("ZTEST", { transport: "BPDK903312" })
    ).resolves.toBe(activated)
    // 账本：ADSO 侧 corrNr 尚待复核，但 api 层签名收 corrNr，按签名透传
    expect(mockedADSOActivate).toHaveBeenCalledWith(
      h,
      "ZTEST",
      "LOCKHANDLE1",
      "BPDK903312"
    )
  })

  test("trfn.activate：无 transport 参数（activateTransformation 签名如此），lockHandle 按位透传", async () => {
    const activated = { success: true, messages: [] }
    mockedTrfnLock.mockResolvedValue({ lockHandle: "LOCKHANDLE1" })
    mockedTrfnActivate.mockResolvedValue(activated)
    await expect(new TrfnDomain(h).activate("ZTEST")).resolves.toBe(activated)
    expect(mockedTrfnActivate).toHaveBeenCalledWith(h, "ZTEST", "LOCKHANDLE1")
    expect(mockedTrfnActivate.mock.calls[0]).toHaveLength(3)
  })

  test("adso.activate 省略 options：corrNr 透传为空串（api 层默认值形态）", async () => {
    const activated = { success: true, messages: [] }
    mockedADSOLock.mockResolvedValue({ lockHandle: "LOCKHANDLE1" })
    mockedADSOActivate.mockResolvedValue(activated)
    await expect(new AdsoDomain(h).activate("ZTEST")).resolves.toBe(activated)
    expect(mockedADSOActivate).toHaveBeenCalledWith(h, "ZTEST", "LOCKHANDLE1", "")
  })

  test.each([
    ["adso", new AdsoDomain(h), mockedADSOLock, mockedADSOUnlock, mockedADSOActivate],
    ["trfn", new TrfnDomain(h), mockedTrfnLock, mockedTrfnUnlock, mockedTrfnActivate]
  ] as const)(
    "%s.activate：激活抛错 → 域 unlock 尝试一次且原异常上抛",
    async (_name, domain, lockSpy, unlockSpy, activateSpy) => {
      const boom = new Error("activation failed on server")
      lockSpy.mockResolvedValue({ lockHandle: "LOCKHANDLE1" })
      activateSpy.mockRejectedValue(boom)
      await expect(domain.activate("ZTEST")).rejects.toBe(boom)
      expect(unlockSpy).toHaveBeenCalledTimes(1)
      expect(unlockSpy).toHaveBeenCalledWith(h, "ZTEST")
    }
  )

  test.each([
    ["adso", new AdsoDomain(h), mockedADSOLock, mockedADSOUnlock, mockedADSOActivate],
    ["trfn", new TrfnDomain(h), mockedTrfnLock, mockedTrfnUnlock, mockedTrfnActivate]
  ] as const)(
    "%s.activate：unlock 自身也抛错 → 吞掉（finally 吞错），仍上抛激活原异常",
    async (_name, domain, lockSpy, unlockSpy, activateSpy) => {
      const boom = new Error("activation failed on server")
      lockSpy.mockResolvedValue({ lockHandle: "LOCKHANDLE1" })
      activateSpy.mockRejectedValue(boom)
      unlockSpy.mockRejectedValue(new Error("unlock failed too"))
      // 不被 unlock 错误掩盖：rejects.toBe 锁原异常引用恒等
      await expect(domain.activate("ZTEST")).rejects.toBe(boom)
      expect(unlockSpy).toHaveBeenCalledTimes(1)
    }
  )
})

describe("dtp.activate 既有链路：finally 吞错修复（unlock 抛错不掩盖原异常）", () => {
  test("成功路径：返回 { lockHandle, ...激活结果 }，且域 unlock 一次", async () => {
    const lockResult = { lockHandle: "LOCKHANDLE1" }
    const activated = { success: true, messages: [{ text: "activated" }] }
    mockedDTPLock.mockResolvedValue(lockResult)
    mockedDTPActivate.mockResolvedValue(activated)
    const result = await new DtpDomain(h).activate("DTP_TEST")
    expect(result).toEqual({ lockHandle: "LOCKHANDLE1", ...activated })
    expect(mockedDTPActivate).toHaveBeenCalledWith(h, "DTP_TEST", "LOCKHANDLE1")
    expect(mockedDTPUnlock).toHaveBeenCalledTimes(1)
    expect(mockedDTPUnlock).toHaveBeenCalledWith(h, "DTP_TEST")
  })

  test("激活抛错 → unlock 尝试一次且原异常上抛", async () => {
    const boom = new Error("activation failed on server")
    mockedDTPLock.mockResolvedValue({ lockHandle: "LOCKHANDLE1" })
    mockedDTPActivate.mockRejectedValue(boom)
    await expect(new DtpDomain(h).activate("DTP_TEST")).rejects.toBe(boom)
    expect(mockedDTPUnlock).toHaveBeenCalledTimes(1)
  })

  test("unlock 自身也抛错 → 被吞掉（修复前裸 finally 会掩盖激活原异常）", async () => {
    const boom = new Error("activation failed on server")
    mockedDTPLock.mockResolvedValue({ lockHandle: "LOCKHANDLE1" })
    mockedDTPActivate.mockRejectedValue(boom)
    mockedDTPUnlock.mockRejectedValue(new Error("unlock failed too"))
    await expect(new DtpDomain(h).activate("DTP_TEST")).rejects.toBe(boom)
    expect(mockedDTPUnlock).toHaveBeenCalledTimes(1)
  })
})

describe("family 正名 + 注册表同步 + dataSource 边界", () => {
  test("VERB_FAMILIES.modeling 含 activate", () => {
    expect(VERB_FAMILIES.modeling).toContain("activate")
  })

  test.each(["adso", "trfn", "dtp"])("%s verbs 含 activate（原型一致性由 domain-registry 统一断言兜底）", name => {
    expect(getDomain(name)?.verbs).toContain("activate")
  })

  test("dataSource 刻意不加 activate（无独立激活实测记录，边界纪律）", () => {
    const methods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(new DataSourceDomain(h))
    ).filter(n => n !== "constructor")
    expect(methods).not.toContain("activate")
    expect(getDomain("dataSource")?.verbs).not.toContain("activate")
  })
})
