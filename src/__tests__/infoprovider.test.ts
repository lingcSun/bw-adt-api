import { BWAdtClient } from "../BWAdtClient"
import { InfoProviderType } from "../api/infoprovider"

// 测试配置 - 请根据实际情况修改
const testConfig = {
  baseUrl: process.env.BW_BASE_URL || "http://your-bw-server:8000",
  username: process.env.BW_USERNAME || "your-username",
  password: process.env.BW_PASSWORD || "your-password",
  client: process.env.BW_CLIENT || "100",
  language: process.env.BW_LANGUAGE || "EN"
}

describe("BW InfoProvider Structure Tests", () => {
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
  }, 30000)

  test("should query root InfoProvider structure (InfoAreas)", async () => {
    const structure = await client.infoProviderStructure()

    expect(structure).toBeDefined()
    expect(Array.isArray(structure)).toBe(true)

    console.log(`\n========== InfoProvider Structure (Root) ==========`)
    console.log(`Found ${structure.length} top-level objects`)
    structure.forEach((item, index) => {
      console.log(`  [${index + 1}] ${item.name || item.techName}`)
      console.log(`      Type: ${item.type}`)
      console.log(`      TechName: ${item.techName}`)
      console.log(`      Children URI: ${item.childrenUri || "N/A"}`)
      console.log(`      URI: ${item.uri || "N/A"}`)
    })
    console.log(`======================================================\n`)

    // 验证基本结构
    if (structure.length > 0) {
      const first = structure[0]
      expect(first).toHaveProperty("name")
      expect(first).toHaveProperty("techName")
      expect(first).toHaveProperty("type")
    }
  }, 30000)

  test("should query InfoArea with ADSO children", async () => {
    // 查询 ZBW_LDL_FI InfoArea 下的 ADSO
    const structure = await client.infoProviderStructure({
      infoArea: "ZBW_LDL_FI"
    })

    expect(structure).toBeDefined()
    expect(Array.isArray(structure)).toBe(true)

    console.log(`\n========== InfoArea: ZBW_LDL_FI ==========`)
    console.log(`Found ${structure.length} objects`)
    structure.forEach((item, index) => {
      console.log(`  [${index + 1}] ${item.name || item.techName}`)
      console.log(`      Type: ${item.type}`)
      console.log(`      TechName: ${item.techName}`)
    })
    console.log(`=========================================\n`)
  }, 30000)

  test("should query specific ADSO structure", async () => {
    // 查询特定 ADSO 的子节点（Transformations, DTPs）
    const structure = await client.infoProviderStructure({
      infoProvider: "ZL_FID01"
    })

    expect(structure).toBeDefined()
    expect(Array.isArray(structure)).toBe(true)

    console.log(`\n========== ADSO: ZL_FID01 ==========`)
    console.log(`Found ${structure.length} child objects`)
    structure.forEach((item, index) => {
      console.log(`  [${index + 1}] ${item.name || item.techName}`)
      console.log(`      Type: ${item.type}`)
      console.log(`      TechName: ${item.techName}`)
      console.log(`      Children URI: ${item.childrenUri || "N/A"}`)
    })
    console.log(`====================================\n`)

    // 通常 ADSO 下会有 TRFN 和 DTPA
    expect(structure.length).toBeGreaterThan(0)
  }, 30000)

  test("should query ADSO transformations directly", async () => {
    const transformations = await client.adsoTransformations("ZL_FID01")

    expect(transformations).toBeDefined()
    expect(Array.isArray(transformations)).toBe(true)

    console.log(`\n========== ADSO Transformations: ZL_FID01 ==========`)
    console.log(`Found ${transformations.length} transformations`)
    transformations.forEach((item, index) => {
      console.log(`  [${index + 1}] ${item.name || item.techName}`)
      console.log(`      Type: ${item.type}`)
      console.log(`      TechName: ${item.techName}`)
    })
    console.log(`====================================================\n`)
  }, 30000)

  test("should query ADSO DTPs directly", async () => {
    const dtps = await client.adsoDTPs("ZL_FID01")

    expect(dtps).toBeDefined()
    expect(Array.isArray(dtps)).toBe(true)

    console.log(`\n========== ADSO DTPs: ZL_FID01 ==========`)
    console.log(`Found ${dtps.length} DTPs`)
    dtps.forEach((item, index) => {
      console.log(`  [${index + 1}] ${item.name || item.techName}`)
      console.log(`      Type: ${item.type}`)
      console.log(`      TechName: ${item.techName}`)
    })
    console.log(`========================================\n`)
  }, 30000)

  test("should query InfoArea RSPC children", async () => {
    // 查询 InfoArea 下的 Process Chains
    const structure = await client.infoProviderStructure({
      infoArea: "ZBW_LDL_FI",
      type: InfoProviderType.RSPC
    })

    expect(structure).toBeDefined()
    expect(Array.isArray(structure)).toBe(true)

    console.log(`\n========== InfoArea RSPC: ZBW_LDL_FI ==========`)
    console.log(`Found ${structure.length} Process Chains`)
    structure.forEach((item, index) => {
      console.log(`  [${index + 1}] ${item.name || item.techName}`)
      console.log(`      Type: ${item.type}`)
      console.log(`      TechName: ${item.techName}`)
      console.log(`      Status: ${item.objVers || "active"}`)
    })
    console.log(`=============================================\n`)
  }, 30000)

  afterAll(async () => {
    if (client.loggedin) {
      await client.logout()
      console.log("Logged out successfully")
    }
  })
})
