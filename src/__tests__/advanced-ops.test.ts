/**
 * .advanced 子面（2026-09-22，离线）：调用方持锁原语的命名空间。
 *
 * 门面动词分两种锁契约：自管动词（saveAndActivate/delete：内部 lock→…→unlock/
 * finally）与 `advanced` 子面（转发 api 层裸函数，锁归调用方，签名逐参镜像）。
 * 断言逐参转发 + 返回冻结对象；`advanced` 是子面访问器，不属于 verbs 家族表
 * （domain-registry 一致性断言显式排除，registry notes 记录子面内容）。
 *
 * 全部断言离线可得：api 模块 spyOn 原位打桩 + {} as AdtHTTP，不发网络请求、
 * 不读 .env、不用 describeLive。
 */
import type { AdtHTTP } from "../AdtHTTP"
import * as adsoApi from "../api/adso"
import * as trfnApi from "../api/transformation"
import * as dtpApi from "../api/dtp"
import * as dsApi from "../api/datasource"
import * as bwObjectApi from "../api/bwObject"
import { AdsoDomain } from "../domains/adso"
import { TrfnDomain } from "../domains/trfn"
import { DtpDomain } from "../domains/dtp"
import { DataSourceDomain } from "../domains/dataSource"

// spyOn 原位打桩（真模块单实例就地替换；不用 jest.mock 工厂——双实例坑见
// verb-family-audit / adso-model 笔记）
const spiedAdsoLock = jest.spyOn(adsoApi, "lockADSO") as jest.Mock
const spiedAdsoUnlock = jest.spyOn(adsoApi, "unlockADSO") as jest.Mock
const spiedAdsoActivate = jest.spyOn(adsoApi, "activateADSO") as jest.Mock
const spiedAdsoUpdate = jest.spyOn(adsoApi, "updateADSO") as jest.Mock
const spiedTrfnActivate = jest.spyOn(trfnApi, "activateTransformation") as jest.Mock
const spiedTrfnUpdate = jest.spyOn(trfnApi, "updateTransformation") as jest.Mock
const spiedDtpLock = jest.spyOn(dtpApi, "lockDTP") as jest.Mock
const spiedDtpUpdate = jest.spyOn(dtpApi, "updateDTP") as jest.Mock
const spiedDsLock = jest.spyOn(dsApi, "lockDataSource") as jest.Mock
const spiedDsActivate = jest.spyOn(dsApi, "activateDataSource") as jest.Mock
const spiedCreateBWObject = jest.spyOn(
  bwObjectApi,
  "createBWObject"
) as jest.Mock

const h = {} as AdtHTTP

beforeEach(() => {
  spiedAdsoLock.mockReset()
  spiedAdsoUnlock.mockReset()
  spiedAdsoActivate.mockReset()
  spiedAdsoUpdate.mockReset()
  spiedTrfnActivate.mockReset()
  spiedTrfnUpdate.mockReset()
  spiedDtpLock.mockReset()
  spiedDtpUpdate.mockReset()
  spiedDsLock.mockReset()
  spiedDsActivate.mockReset()
  spiedCreateBWObject.mockReset()
})

describe("advanced 子面：冻结保证", () => {
  test("四域 advanced 均返回冻结对象", () => {
    for (const advanced of [
      new AdsoDomain(h).advanced,
      new TrfnDomain(h).advanced,
      new DtpDomain(h).advanced,
      new DataSourceDomain(h).advanced
    ]) {
      expect(Object.isFrozen(advanced)).toBe(true)
    }
  })
})

describe("adso.advanced", () => {
  test("lock(id) 逐参转发 lockADSO 并回传锁定结果", async () => {
    const lockResult = { lockHandle: "LOCKHANDLE1" }
    spiedAdsoLock.mockResolvedValue(lockResult)
    const advanced = new AdsoDomain(h).advanced
    await expect(advanced.lock("ZTEST")).resolves.toBe(lockResult)
    expect(spiedAdsoLock).toHaveBeenCalledTimes(1)
    expect(spiedAdsoLock).toHaveBeenCalledWith(h, "ZTEST")
  })

  test("unlock(id) 逐参转发 unlockADSO", async () => {
    spiedAdsoUnlock.mockResolvedValue(undefined)
    const advanced = new AdsoDomain(h).advanced
    await expect(advanced.unlock("ZTEST")).resolves.toBeUndefined()
    expect(spiedAdsoUnlock).toHaveBeenCalledTimes(1)
    expect(spiedAdsoUnlock).toHaveBeenCalledWith(h, "ZTEST")
  })

  test("update(id, xml, io) 逐参转发 updateADSO（io 原样）", async () => {
    const updated = { success: true, messages: [] }
    spiedAdsoUpdate.mockResolvedValue(updated)
    const io = { lockHandle: "LOCKHANDLE1", corrNr: "BPDK903312", timestamp: "20260922000000" }
    const advanced = new AdsoDomain(h).advanced
    await expect(advanced.update("ZTEST", "<xml/>", io)).resolves.toBe(updated)
    expect(spiedAdsoUpdate).toHaveBeenCalledTimes(1)
    expect(spiedAdsoUpdate).toHaveBeenCalledWith(h, "ZTEST", "<xml/>", io)
  })

  test("delete(id, {lockHandle, transport?}) 调用方持锁原样走 BWObject.delete", async () => {
    const confirmation = {
      deleted: true as const,
      objectType: bwObjectApi.BWObjectType.ADSO,
      objectName: "ZTEST"
    }
    const deleteSpy = jest.fn().mockResolvedValue(confirmation)
    spiedCreateBWObject.mockReturnValue({ delete: deleteSpy })
    const advanced = new AdsoDomain(h).advanced
    await expect(
      advanced.delete("ZTEST", { lockHandle: "LOCKHANDLE1", transport: "BPDK903312" })
    ).resolves.toBe(confirmation)
    expect(spiedCreateBWObject).toHaveBeenCalledWith(
      h,
      bwObjectApi.BWObjectType.ADSO,
      "ZTEST"
    )
    expect(deleteSpy).toHaveBeenCalledWith({
      lockHandle: "LOCKHANDLE1",
      transport: "BPDK903312"
    })
  })
})

describe("trfn.advanced", () => {
  test("activate(id, lockHandle) 逐参转发 activateTransformation", async () => {
    const activated = { success: true, messages: [] }
    spiedTrfnActivate.mockResolvedValue(activated)
    const advanced = new TrfnDomain(h).advanced
    await expect(advanced.activate("ZTEST", "LOCKHANDLE1")).resolves.toBe(activated)
    expect(spiedTrfnActivate).toHaveBeenCalledTimes(1)
    expect(spiedTrfnActivate).toHaveBeenCalledWith(h, "ZTEST", "LOCKHANDLE1")
  })

  test("update(id, xml, io) 逐参转发 updateTransformation（version 默认 m）", async () => {
    const updated = { success: true, messages: [] }
    spiedTrfnUpdate.mockResolvedValue(updated)
    const io = { lockHandle: "LOCKHANDLE1", corrNr: "BPDK903312" }
    const advanced = new TrfnDomain(h).advanced
    await expect(advanced.update("ZTEST", "<xml/>", io)).resolves.toBe(updated)
    expect(spiedTrfnUpdate).toHaveBeenCalledTimes(1)
    expect(spiedTrfnUpdate).toHaveBeenCalledWith(h, "ZTEST", "<xml/>", io, "m")
    // version 显式透传
    await advanced.update("ZTEST", "<xml/>", io, "a")
    expect(spiedTrfnUpdate).toHaveBeenLastCalledWith(h, "ZTEST", "<xml/>", io, "a")
  })
})

describe("dtp.advanced", () => {
  test("lock(id) 逐参转发 lockDTP 并回传锁定结果", async () => {
    const lockResult = { lockHandle: "LOCKHANDLE1" }
    spiedDtpLock.mockResolvedValue(lockResult)
    const advanced = new DtpDomain(h).advanced
    await expect(advanced.lock("DTP_TEST")).resolves.toBe(lockResult)
    expect(spiedDtpLock).toHaveBeenCalledTimes(1)
    expect(spiedDtpLock).toHaveBeenCalledWith(h, "DTP_TEST")
  })

  test("update(id, xml, io) 逐参转发 updateDTP（io = {lockHandle, transport?}）", async () => {
    spiedDtpUpdate.mockResolvedValue(undefined)
    const advanced = new DtpDomain(h).advanced
    await expect(
      advanced.update("DTP_TEST", "<xml/>", { lockHandle: "LOCKHANDLE1", transport: "BPDK903312" })
    ).resolves.toBeUndefined()
    expect(spiedDtpUpdate).toHaveBeenCalledTimes(1)
    expect(spiedDtpUpdate).toHaveBeenCalledWith(h, "DTP_TEST", "<xml/>", {
      lockHandle: "LOCKHANDLE1",
      transport: "BPDK903312"
    })
  })
})

describe("dataSource.advanced", () => {
  test("lock(ds, src) 逐参转发 lockDataSource（双段标识）", async () => {
    const lockResult = { lockHandle: "LOCKHANDLE1" }
    spiedDsLock.mockResolvedValue(lockResult)
    const advanced = new DataSourceDomain(h).advanced
    await expect(advanced.lock("ZDS", "S4DCLNT300")).resolves.toBe(lockResult)
    expect(spiedDsLock).toHaveBeenCalledTimes(1)
    expect(spiedDsLock).toHaveBeenCalledWith(h, "ZDS", "S4DCLNT300")
  })

  test("activate(ds, src, lockHandle, corrNr?) 逐参转发 activateDataSource", async () => {
    const activated = { success: true, messages: [] }
    spiedDsActivate.mockResolvedValue(activated)
    const advanced = new DataSourceDomain(h).advanced
    await expect(
      advanced.activate("ZDS", "S4DCLNT300", "LOCKHANDLE1", "BPDK903312")
    ).resolves.toBe(activated)
    expect(spiedDsActivate).toHaveBeenCalledTimes(1)
    expect(spiedDsActivate).toHaveBeenCalledWith(
      h,
      "ZDS",
      "S4DCLNT300",
      "LOCKHANDLE1",
      "BPDK903312"
    )
  })
})
