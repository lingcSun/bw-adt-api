/**
 * InfoArea 结构域归位（P1 Task 2，离线）。
 *
 * 只断言委托链：client.infoArea.tree → api/repository.getInfoproviderStructure、
 * client.infoArea.validate → api/adso.validateInfoArea。api 模块以 jest.spyOn
 * 就地打桩（P1-B 遗留工厂迁移；一律不设 jest.mock 工厂：工厂与多入口导入图
 * 相遇会产生第二份模块实例，见 2026-09-22-adso-model.md）——
 * 不发网络请求、不读 .env、不用 describeLive。
 * 两个旧位置（repository.infoproviderStructure / adso.validateInfoArea）按约束
 * 保留原方法体并标 @deprecated，这里同时锁其委托行为不变。
 */
import type { AdtHTTP } from "../AdtHTTP"
import * as repository from "../api/repository"
import * as adsoApi from "../api/adso"
import { InfoAreaDomain } from "../domains/infoArea"
import { RepositoryDomain } from "../domains/repository"
import { AdsoDomain } from "../domains/adso"
import { BWAdtClient } from "../BWAdtClient"

const mockedTree = jest.spyOn(repository, "getInfoproviderStructure") as jest.Mock
const mockedValidate = jest.spyOn(adsoApi, "validateInfoArea") as jest.Mock

const h = {} as AdtHTTP

beforeEach(() => {
  mockedTree.mockReset()
  mockedValidate.mockReset()
})

describe("InfoAreaDomain 委托链", () => {
  const domain = new InfoAreaDomain(h)

  test("tree → api/repository.getInfoproviderStructure（type 省略时透传 undefined）", async () => {
    const entries = [{ objectName: "ZTESTCHA1" }]
    mockedTree.mockResolvedValue(entries)
    await expect(domain.tree("ZAREA")).resolves.toBe(entries)
    expect(mockedTree).toHaveBeenCalledTimes(1)
    expect(mockedTree).toHaveBeenCalledWith(h, "ZAREA", undefined)
  })

  test("tree 透传 type 参数", async () => {
    mockedTree.mockResolvedValue([])
    await domain.tree("ZAREA", "adso")
    expect(mockedTree).toHaveBeenCalledWith(h, "ZAREA", "adso")
  })

  test("validate → api/adso.validateInfoArea", async () => {
    const result = { valid: true }
    mockedValidate.mockResolvedValue(result)
    await expect(domain.validate("ZAREA")).resolves.toBe(result)
    expect(mockedValidate).toHaveBeenCalledTimes(1)
    expect(mockedValidate).toHaveBeenCalledWith(h, "ZAREA")
  })
})

describe("旧位置保留且委托行为不变（@deprecated 只改注记）", () => {
  test("repository.infoproviderStructure 仍委托 getInfoproviderStructure", async () => {
    const domain = new RepositoryDomain(h)
    mockedTree.mockResolvedValue([])
    await domain.infoproviderStructure("ZAREA", "iobj_kyf")
    expect(mockedTree).toHaveBeenCalledWith(h, "ZAREA", "iobj_kyf")
  })

  test("adso.validateInfoArea 仍委托 api 层 validateInfoArea", async () => {
    const domain = new AdsoDomain(h)
    mockedValidate.mockResolvedValue({ valid: false })
    await domain.validateInfoArea("ZAREA")
    expect(mockedValidate).toHaveBeenCalledWith(h, "ZAREA")
  })
})

describe("BWAdtClient.infoArea 挂载", () => {
  test("client.infoArea 是 InfoAreaDomain 实例，verbs 为 tree/validate", () => {
    const client = new BWAdtClient("http://localhost:50000", "user", "pass")
    expect(client.infoArea).toBeInstanceOf(InfoAreaDomain)
    expect(typeof client.infoArea.tree).toBe("function")
    expect(typeof client.infoArea.validate).toBe("function")
  })
})
