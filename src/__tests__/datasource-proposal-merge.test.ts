import { BWAdtClient } from "../BWAdtClient"
import {
  parseDataSourceDetails,
  parseDataSourceFields,
  extractDataSourceTimestamp
} from "../api/datasource"
import { fullParse, xmlNodeAttr, xmlArray } from "../utilities"

/**
 * DataSource Proposal/Merge 接口验证
 *
 * 对照 Eclipse Communication Log (2026-07-29 15:52:13):
 *   POST /sap/bw/modeling/rsdsint/proposal/0ASSET_ATTR_TEXT/S4DCLNT300?action=merge
 *     请求 Content-Type: application/vnd.sap.bw.modeling.rsds+xml
 *     响应 Content-Type: application/vnd.sap.bw.modeling.rsdsint+xml
 *
 * 触发场景 (Eclipse): 修改 DataSource 的 ODP 适配器后, 向导进入对比页 (ComparisonPage)
 *   时调用此接口, 把外部 ODP 字段结构合并回 DataSource。纯计算, 不修改系统状态。
 *
 * 请求体: 当前 DataSource 完整 XML (从 getDataSourceXml 获取)
 * 响应体: 合并后的 DataSource 完整 XML, 结构与 GET /rsds/{ds}/{src}/m 一致
 */

const testConfig = {
  baseUrl: process.env.BW_BASE_URL!,
  username: process.env.BW_USERNAME!,
  password: process.env.BW_PASSWORD!,
  client: process.env.BW_CLIENT!,
  language: process.env.BW_LANGUAGE!
}

const DATASOURCE = "0ASSET_ATTR_TEXT"
const SOURCE_SYSTEM = "S4DCLNT300"

describe(`DataSource Proposal/Merge: ${DATASOURCE}`, () => {
  let client: BWAdtClient
  let originalXml: string
  let mergedXml: string

  beforeAll(async () => {
    client = new BWAdtClient(
      testConfig.baseUrl, testConfig.username, testConfig.password,
      testConfig.client, testConfig.language
    )
    await client.login()

    // Step 1: 获取当前 DataSource XML (作为 merge 请求体)
    originalXml = await client.getDataSourceXml(DATASOURCE, SOURCE_SYSTEM, true)

    // Step 2: 调用 proposal/merge
    mergedXml = await client.mergeDataSourceProposal(DATASOURCE, SOURCE_SYSTEM, originalXml)
  }, 60000)

  afterAll(async () => {
    if (client.loggedin) await client.logout()
  })

  // ==========================================================================
  // 核心验证: merge 端点可接受 getDataSourceXml 返回的 XML 并返回合并结果
  // ==========================================================================
  test("① mergeDataSourceProposal() - 端点可调用且返回有效 XML", () => {
    console.log(`\n========== merge 调用结果 ==========`)
    console.log(`请求体长度: ${originalXml.length} 字符`)
    console.log(`响应体长度: ${mergedXml.length} 字符`)
    console.log(`响应根节点: ${mergedXml.match(/<[\w:]+dataSource/)?.[0]}`)
    console.log("=".repeat(40) + "\n")

    expect(mergedXml).toBeDefined()
    expect(mergedXml.length).toBeGreaterThan(0)
    // 响应根节点应为 rsds:dataSource (服务端规范化命名空间)
    expect(mergedXml).toMatch(/<rsds:dataSource/)
    expect(mergedXml).toContain(DATASOURCE)
  })

  // ==========================================================================
  // 响应结构验证: merge 响应可被 parseDataSourceDetails 解析 (与 GET /m 一致)
  // ==========================================================================
  test("② merge 响应可被 parseDataSourceDetails 解析 (结构同 GET /m)", () => {
    const raw = fullParse(mergedXml)
    const details = parseDataSourceDetails(raw)

    console.log("\n========== merge 响应解析 (DataSourceDetails) ==========")
    console.log(`名称:       ${details.name}`)
    console.log(`类型:       ${details.type}`)
    console.log(`源系统:     ${details.sourceSystem}`)
    console.log(`适配器:     ${details.adapterType}`)
    console.log(`应用组件:   ${details.applicationComponent}`)
    console.log(`对象版本:   ${details.objectVersion}`)
    console.log(`对象状态:   ${details.objectStatus}`)
    console.log("=".repeat(55) + "\n")

    expect(details.name).toBe(DATASOURCE)
    expect(details.sourceSystem).toBe(SOURCE_SYSTEM)
    expect(details.adapterType).toBe("ODP")
    expect(details.applicationComponent).toBe("FI-AA-IO")
  })

  // ==========================================================================
  // 字段一致性验证: merge 前后字段数应一致 (未改 ODP 适配器, 结构不变)
  // ==========================================================================
  test("③ merge 前后字段数一致 (未改适配器, 结构无变化)", () => {
    const originalFields = parseDataSourceFields(fullParse(originalXml))
    const mergedFields = parseDataSourceFields(fullParse(mergedXml))

    console.log("\n========== 字段数对比 ==========")
    console.log(`merge 前: ${originalFields.length} 个字段`)
    console.log(`merge 后: ${mergedFields.length} 个字段`)
    console.log("=".repeat(35) + "\n")

    // 未修改 ODP 适配器, merge 后字段结构应与原始一致
    expect(mergedFields.length).toBe(originalFields.length)

    // 字段名集合一致
    const origNames = originalFields.map(f => f.name).sort()
    const mergedNames = mergedFields.map(f => f.name).sort()
    expect(mergedNames).toEqual(origNames)
  })

  // ==========================================================================
  // segmentMapping 验证: merge 响应包含完整的字段映射
  // ==========================================================================
  test("④ merge 响应的 segmentMapping 字段映射完整", () => {
    const raw = fullParse(mergedXml)
    const root = raw["rsds:dataSource"]
    const mappings = xmlArray(root, "adapter", "segmentMapping", "fieldMapping")

    console.log(`\n========== segmentMapping: ${mappings.length} 个映射 ==========`)
    mappings.slice(0, 3).forEach((m: any, i: number) => {
      const a = xmlNodeAttr(m)
      console.log(`  [${i + 1}] ${a.externalField} (${a.type}/${a.length}) transfer=${a.transfer}`)
    })
    console.log(`  ... (共 ${mappings.length} 个)`)
    console.log("=".repeat(55) + "\n")

    expect(mappings.length).toBeGreaterThan(0)
    expect(xmlNodeAttr(mappings[0]).externalField).toBe("BUKRS")
  })

  // ==========================================================================
  // timestamp 提取验证: merge 响应含 tlogoProperties/changedAt, 可提取 PUT timestamp
  // ==========================================================================
  test("⑤ merge 响应的 timestamp 可提取 (用于后续 PUT)", () => {
    const timestamp = extractDataSourceTimestamp(mergedXml)

    console.log(`\n========== timestamp 提取 ==========`)
    console.log(`提取的 timestamp: ${timestamp} (14 位 yyyyMMddHHmmss)`)
    console.log("=".repeat(40) + "\n")

    expect(timestamp).toBeDefined()
    expect(timestamp).toMatch(/^\d{14}$/)
  })
})
