import { BWAdtClient } from "../BWAdtClient"

/**
 * 查找数据源 0ASSET_ATTR* - 验证 DataSource 搜索功能
 *
 * 0ASSET_ATTR 是 SAP 标准的资产主数据属性数据源 (Asset Master Data Attributes)。
 * 使用通配符 * 匹配所有以 0ASSET_ATTR 开头的 DataSource。
 */

const testConfig = {
  baseUrl: process.env.BW_BASE_URL!,
  username: process.env.BW_USERNAME!,
  password: process.env.BW_PASSWORD!,
  client: process.env.BW_CLIENT!,
  language: process.env.BW_LANGUAGE!
}

describe("查找数据源 0ASSET_ATTR*", () => {
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

  // ✅ 通配符搜索: searchTerm = "0ASSET_ATTR*"
  test("quickSearch('0ASSET_ATTR*') - 通配符搜索数据源", async () => {
    const results = await client.quickSearch("0ASSET_ATTR*")

    console.log(`\n========== 搜索 '0ASSET_ATTR*' 共找到 ${results.length} 条 ==========`)
    results.forEach((r, i) => {
      console.log(
        `  [${i + 1}] ${r.objectType.padEnd(8)} ${r.technicalObjectName.padEnd(35)} ` +
        `(${r.objectStatus || "-"}/${r.objectVersion || "-"})  "${r.title}"`
      )
      console.log(`        URI: ${r.uri}`)
    })
    console.log("=".repeat(70) + "\n")

    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBeGreaterThan(0)

    // 每个结果名称都应以 0ASSET_ATTR 开头
    results.forEach(r => {
      expect(r.technicalObjectName.toUpperCase()).toMatch(/^0ASSET_ATTR/i)
    })

    // 汇总各对象类型数量
    const byType: Record<string, number> = {}
    results.forEach(r => {
      byType[r.objectType] = (byType[r.objectType] || 0) + 1
    })
    console.log("对象类型分布:", byType)
  }, 30000)

  // ✅ 详细信息验证: 检查每个匹配数据源的元数据完整性
  test("匹配数据源元数据完整 (类型/状态/URI)", async () => {
    const results = await client.quickSearch("0ASSET_ATTR*")

    console.log(`\n========== 数据源详细元数据 (${results.length} 条) ==========`)
    results.forEach(r => {
      console.log(
        `  • ${r.technicalObjectName}\n` +
        `      类型: ${r.objectType}    状态: ${r.objectStatus}/${r.objectVersion}\n` +
        `      描述: ${r.title}\n` +
        `      URI:  ${r.uri}`
      )
    })
    console.log("=".repeat(60) + "\n")

    // 所有匹配结果应为 DataSource 类型 (RSDS) 且处于 active 状态
    results.forEach(r => {
      expect(r.objectType).toBe("RSDS")
      expect(r.objectStatus).toBe("active")
      expect(r.uri).toMatch(/\/sap\/bw\/modeling\/rsds\//i)
    })
  }, 30000)
})
