import { BWAdtClient } from "../BWAdtClient"
import { describeLive, testLive } from "./helpers/liveSystem"

/**
 * DTP 读取接口验证（details / versions）。
 */

const testConfig = {
  baseUrl: process.env.BW_BASE_URL!,
  username: process.env.BW_USERNAME!,
  password: process.env.BW_PASSWORD!,
  client: process.env.BW_CLIENT!,
  language: process.env.BW_LANGUAGE!
}

const TEST_DTP = "DTP_ET0916OM0DNHSHAP1BKTB6DJP"

describeLive("DTP 读取接口验证", () => {
  let client: BWAdtClient

  beforeAll(async () => {
    client = new BWAdtClient(
      testConfig.baseUrl, testConfig.username, testConfig.password,
      testConfig.client, testConfig.language
    )
    await client.login()
  }, 30000)

  afterAll(async () => {
    if (client.loggedin) await client.logout()
  })

  // ✅ 核心请求 1: GET /dtpa/{id}/m?forceCacheUpdate=true → 200 (90.7KB)
  test("getDTP() - DTP 元数据 (对应日志 15:38:49)", async () => {
    const raw = await client.getDTP(TEST_DTP, true) // forceCacheUpdate 强制刷新缓存

    expect(raw).toBeDefined()
    const root = raw["dtpa:dataTransferProcess"]
    expect(root).toBeDefined()
    // 根属性含 name 和 description
    expect(root["@_name"]).toBe(TEST_DTP)
    expect(root["@_description"]).toContain("ZL_FID01")
  }, 30000)

  // ✅ 核心请求 1 (解析版)
  test("getDTPDetails() - 解析后的 DTP 详情 (source=ZL_FID01, target=ZL_FID40)", async () => {
    const details = await client.getDTPDetails(TEST_DTP, true)

    expect(details).toBeDefined()
    console.log(`\n========== DTP Details: ${TEST_DTP} ==========`)
    console.log(`Name:        ${details.name}`)
    console.log(`Source:      ${details.source} (${details.sourceType})`)
    console.log(`Target:      ${details.target} (${details.targetType})`)
    console.log(`Description: ${details.description}`)
    console.log(`Type:        ${details.dtpType}`)
    console.log(`Status:      ${details.status}`)
    console.log(`Object Ver:  ${details.objVers}`)
    console.log(`=========================================\n`)

    // 这就是 ZL_FID01 -> ZL_FID40 的 DTP (dataflow 测试已确认)
    expect(details.name).toBe(TEST_DTP)
    expect(details.source).toBe("ZL_FID01")
    expect(details.target).toBe("ZL_FID40")
    expect(details.description).toContain("ZL_FID01")
    expect(details.description).toContain("ZL_FID40")
  }, 30000)

  // ✅ 核心请求 2: GET /dtpa/{id}/versions → 200 (21.4KB)
  test("getDTPVersions() - 版本历史 (对应日志 15:38:50)", async () => {
    const versions = await client.getDTPVersions(TEST_DTP)

    expect(Array.isArray(versions)).toBe(true)
    console.log(`\n========== DTP Versions: ${TEST_DTP} ==========`)
    console.log(`Found ${versions.length} version(s)`)
    versions.slice(0, 10).forEach((v, i) => {
      console.log(`  [${i + 1}] ${v.version}  ${v.description || ""}  URI: ${v.uri}`)
    })
    console.log(`============================================\n`)

    expect(versions.length).toBeGreaterThan(0)
  }, 30000)
})
