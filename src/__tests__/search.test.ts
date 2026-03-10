import { BWAdtClient } from "../BWAdtClient"

// 测试配置 - 请根据实际情况修改
const testConfig = {
  baseUrl: process.env.BW_BASE_URL || "http://your-bw-server:8000",
  username: process.env.BW_USERNAME || "your-username",
  password: process.env.BW_PASSWORD || "your-password",
  client: process.env.BW_CLIENT || "100",
  language: process.env.BW_LANGUAGE || "EN"
}

describe("BW Search Tests", () => {
  let client: BWAdtClient

  beforeAll(async () => {
    client = new BWAdtClient(
      testConfig.baseUrl,
      testConfig.username,
      testConfig.password,
      testConfig.client,
      testConfig.language
    )
    await client.login()
    console.log(`\n========== BW Search Tests Starting ==========\n`)
  }, 30000)

  test("should quick search for ADSO", async () => {
    const results = await client.quickSearch("ZL_FID01")

    expect(results).toBeDefined()
    expect(Array.isArray(results)).toBe(true)

    console.log(`\n========== Quick Search: "ZL_FID01" ==========`)
    console.log(`Found ${results.length} result(s)`)
    results.forEach((item, index) => {
      console.log(`  [${index + 1}] ${item.title || item.objectName}`)
      console.log(`      Technical Name: ${item.technicalObjectName}`)
      console.log(`      Type: ${item.objectType}`)
      console.log(`      Status: ${item.objectStatus}`)
      console.log(`      Version: ${item.objectVersion}`)
      console.log(`      URI: ${item.uri}`)
    })
    console.log(`=============================================\n`)
  }, 30000)

  test("should quick search for DTP", async () => {
    const results = await client.quickSearch("DTP")

    expect(results).toBeDefined()
    expect(Array.isArray(results)).toBe(true)

    console.log(`\n========== Quick Search: "DTP" ==========`)
    console.log(`Found ${results.length} result(s)`)
    results.forEach((item, index) => {
      console.log(`  [${index + 1}] ${item.title || item.objectName}`)
      console.log(`      Technical Name: ${item.technicalObjectName}`)
      console.log(`      Type: ${item.objectType}`)
    })
    console.log(`==========================================\n`)

    // 应该能找到一些 DTP
    expect(results.length).toBeGreaterThan(0)
  }, 30000)

  test("should quick search for Transformation", async () => {
    const results = await client.quickSearch("0PV9QJUMRUVENJWN24BPR29K29DXRI55")

    expect(results).toBeDefined()
    expect(Array.isArray(results)).toBe(true)

    console.log(`\n========== Quick Search: Transformation ==========`)
    console.log(`Found ${results.length} result(s)`)
    results.forEach((item, index) => {
      console.log(`  [${index + 1}] ${item.title || item.objectName}`)
      console.log(`      Technical Name: ${item.technicalObjectName}`)
      console.log(`      Type: ${item.objectType}`)
      console.log(`      Description: ${item.title}`)
    })
    console.log(`=============================================\n`)

    // 应该能找到这个特定的 Transformation
    expect(results.length).toBeGreaterThan(0)
  }, 30000)

  test("should search with detailed options", async () => {
    const results = await client.searchBWObjects({
      searchTerm: "ZL_FID01",
      searchInName: true,
      searchInDescription: true,
      objectType: "ADSO",
      createdOnFrom: "2020-01-01T00:00:00Z",
      createdOnTo: "2026-12-31T23:59:59Z"
    })

    expect(results).toBeDefined()
    expect(Array.isArray(results)).toBe(true)

    console.log(`\n========== Detailed Search: ADSO "ZL_FID01" ==========`)
    console.log(`Found ${results.length} result(s)`)
    results.forEach((item, index) => {
      console.log(`  [${index + 1}] ${item.title || item.objectName}`)
      console.log(`      Technical Name: ${item.technicalObjectName}`)
      console.log(`      Type: ${item.objectType}`)
      console.log(`      Status: ${item.objectStatus}`)
      console.log(`      Version: ${item.objectVersion}`)
      console.log(`      URI: ${item.uri}`)
    })
    console.log(`=================================================\n`)
  }, 30000)

  test("should search for Process Chains", async () => {
    const results = await client.searchBWObjects({
      searchTerm: "ZBW",
      searchInName: true,
      objectType: "RSPC"
    })

    expect(results).toBeDefined()
    expect(Array.isArray(results)).toBe(true)

    console.log(`\n========== Search: Process Chains "ZBW" ==========`)
    console.log(`Found ${results.length} result(s)`)
    results.forEach((item, index) => {
      console.log(`  [${index + 1}] ${item.title || item.objectName}`)
      console.log(`      Technical Name: ${item.technicalObjectName}`)
      console.log(`      Type: ${item.objectType}`)
      console.log(`      Description: ${item.title}`)
    })
    console.log(`=================================================\n`)

    // 应该能找到一些 Process Chain
    if (results.length > 0) {
      expect(results[0].objectType).toBe("RSPC")
    }
  }, 30000)

  test("should search for InfoObjects", async () => {
    const results = await client.searchBWObjects({
      searchTerm: "MATERIAL",
      searchInName: true,
      objectType: "IOBJ"
    })

    expect(results).toBeDefined()
    expect(Array.isArray(results)).toBe(true)

    console.log(`\n========== Search: InfoObject "MATERIAL" ==========`)
    console.log(`Found ${results.length} result(s)`)
    results.forEach((item, index) => {
      console.log(`  [${index + 1}] ${item.title || item.objectName}`)
      console.log(`      Technical Name: ${item.technicalObjectName}`)
      console.log(`      Type: ${item.objectType}`)
    })
    console.log(`========================================================\n`)
  }, 30000)

  afterAll(async () => {
    console.log(`\n========== BW Search Tests Completed ==========\n`)
    if (client.loggedin) {
      await client.logout()
      console.log("Logged out successfully")
    }
  })
})
