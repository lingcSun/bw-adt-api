/**
 * infoProvider 多态域（P1 Task 3，离线）。
 *
 * 判别规则（唯一诚实可用版，见域分类学笔记）：
 * - details(name) 经 api/search 精确名搜索取 objectType：
 *   ADSO → 转发 AdsoDomain.details；其余类型 → 抛 not verified yet；无命中 → not found；
 * - exists(name) = 精确名命中与否；
 * - adso(name) 返回绑定同一 AdtHTTP 的 AdsoDomain（与 client.adso 同类）。
 *
 * api/search 以 jest.mock 替换、AdsoDomain.details 以 spyOn 拦截——
 * 不发网络请求、不读 .env、不用 describeLive。
 */
import type { AdtHTTP } from "../AdtHTTP"
import { searchBWObjects } from "../api/search"
import { AdsoDomain } from "../domains/adso"
import { InfoProviderDomain } from "../domains/infoProvider"
import { BWAdtClient } from "../BWAdtClient"

jest.mock("../api/search", () => ({
  searchBWObjects: jest.fn()
}))

const mockedSearch = searchBWObjects as jest.Mock

const h = {} as AdtHTTP

beforeEach(() => {
  mockedSearch.mockReset()
})

/** 精确名命中（ADSO）的桩搜索结果。 */
function adsoHit(name = "ZTEST_IP") {
  return {
    objectName: name,
    objectType: "ADSO",
    technicalObjectName: name,
    objectStatus: "active",
    objectVersion: "M",
    uri: `adso/${name}`,
    title: name
  }
}

describe("InfoProviderDomain.details 判别", () => {
  const domain = new InfoProviderDomain(h)
  let detailsSpy: jest.SpyInstance
  let detailsResult: Awaited<ReturnType<AdsoDomain["details"]>>

  beforeEach(() => {
    detailsResult = {} as Awaited<ReturnType<AdsoDomain["details"]>>
    detailsSpy = jest
      .spyOn(AdsoDomain.prototype, "details")
      .mockResolvedValue(detailsResult)
  })

  afterEach(() => {
    detailsSpy.mockRestore()
  })

  test("ADSO 命中 → 转发 AdsoDomain.details（同名参数）", async () => {
    mockedSearch.mockResolvedValue([adsoHit("ZTEST_IP")])

    const result = await domain.details("ZTEST_IP")

    expect(result).toBe(detailsResult)
    expect(detailsSpy).toHaveBeenCalledTimes(1)
    expect(detailsSpy).toHaveBeenCalledWith("ZTEST_IP")
  })

  test("搜索按精确名发起（searchInName=true / searchInDescription=false）", async () => {
    mockedSearch.mockResolvedValue([adsoHit("ZTEST_IP")])
    await domain.details("ZTEST_IP")
    expect(mockedSearch).toHaveBeenCalledTimes(1)
    expect(mockedSearch).toHaveBeenCalledWith(h, {
      searchTerm: "ZTEST_IP",
      searchInName: true,
      searchInDescription: false
    })
  })

  test("同名不同类型：精确名过滤优先于模糊命中（且非首条命中）", async () => {
    // 服务端 contains 搜索会带回同前缀对象；只有精确同名那条才参与判别
    mockedSearch.mockResolvedValue([
      adsoHit("ZTEST_IP2"), // 同前缀模糊命中，名字不同——必须被过滤
      adsoHit("ZTEST_IP") // 精确同名 ADSO，故意放在第二条
    ])
    await domain.details("ZTEST_IP")
    expect(detailsSpy).toHaveBeenCalledTimes(1)
    expect(detailsSpy).toHaveBeenCalledWith("ZTEST_IP")
  })

  test("非 ADSO 类型 → 抛 not verified yet（消息含 objectType 与分类学笔记指针）", async () => {
    mockedSearch.mockResolvedValue([
      { ...adsoHit("ZTEST_CUBE"), objectType: "INFOCUBE" }
    ])
    await expect(domain.details("ZTEST_CUBE")).rejects.toThrow(
      "InfoProvider type INFOCUBE not verified yet"
    )
    await expect(domain.details("ZTEST_CUBE")).rejects.toThrow(
      /2026-09-21-domain-taxonomy\.md/
    )
    expect(detailsSpy).not.toHaveBeenCalled()
  })

  test("无命中 → 抛 InfoProvider <name> not found", async () => {
    mockedSearch.mockResolvedValue([])
    await expect(domain.details("ZTEST_MISSING")).rejects.toThrow(
      "InfoProvider ZTEST_MISSING not found"
    )
    expect(detailsSpy).not.toHaveBeenCalled()
  })
})

describe("InfoProviderDomain.exists 精确名命中", () => {
  const domain = new InfoProviderDomain(h)

  test("精确同名命中 → true", async () => {
    mockedSearch.mockResolvedValue([adsoHit("ZTEST_IP")])
    await expect(domain.exists("ZTEST_IP")).resolves.toBe(true)
  })

  test("仅模糊/同前缀命中（无精确同名）→ false", async () => {
    mockedSearch.mockResolvedValue([adsoHit("ZTEST_IP2")])
    await expect(domain.exists("ZTEST_IP")).resolves.toBe(false)
  })

  test("无结果 → false", async () => {
    mockedSearch.mockResolvedValue([])
    await expect(domain.exists("ZTEST_MISSING")).resolves.toBe(false)
  })

  test("命中不区分大小写（BW 技术名服务端归大写，判别两侧统一大写比较）", async () => {
    mockedSearch.mockResolvedValue([adsoHit("ZTEST_IP")])
    await expect(domain.exists("ztest_ip")).resolves.toBe(true)
  })
})

describe("InfoProviderDomain.adso 类型特化面", () => {
  test("返回 AdsoDomain 实例，绑定同一 AdtHTTP（与 client.adso 同类）", () => {
    const domain = new InfoProviderDomain(h)
    const facade = domain.adso("ZTEST_IP")
    expect(facade).toBeInstanceOf(AdsoDomain)
    // AdsoDomain 的 h 是 TS private（运行时属性）——这里刻意戳进去锁"同一会话"绑定
    expect((facade as unknown as { h: unknown }).h).toBe(h)
  })

  test("与 client.adso 相互独立：各自实例、互不共享", () => {
    const client = new BWAdtClient("http://localhost:50000", "user", "pass")
    expect(client.infoProvider).toBeInstanceOf(InfoProviderDomain)
    expect(client.adso).toBeInstanceOf(AdsoDomain)
    expect(client.infoProvider.adso("X")).not.toBe(client.adso)
  })
})
