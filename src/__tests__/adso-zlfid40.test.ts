import { BWAdtClient } from "../BWAdtClient"

/**
 * ADSO 读取接口验证 - 对照 Eclipse 双击打开 ZL_FID40 的 Communication Log
 *
 * 日志中的核心请求序列:
 *   14:40:55  GET /sap/bw/modeling/adso/zl_fid40/m              → 200 (26.6KB)  元数据
 *   14:40:58  GET /sap/bw/modeling/adso/zl_fid40/m              → 304           缓存校验
 *   14:41:02  GET /sap/bw/modeling/adso/zl_fid40/versions       → 200           版本历史
 *   14:41:03  GET /sap/bw/modeling/adso/ZL_FID40/configuration  → 200           配置
 *   14:41:06  GET /sap/bw/modeling/iobj/0fiscvarnt/a            → 200           引用的 InfoObject
 *
 * 以下 UI 导航请求不在验证范围（CLAUDE.md 明确不实现，用 search 替代）:
 *   - GET /repo/nodepath            (定位树节点)
 *   - GET /repo/infoproviderstructure (逐级展开树)
 */

const testConfig = {
  baseUrl: process.env.BW_BASE_URL!,
  username: process.env.BW_USERNAME!,
  password: process.env.BW_PASSWORD!,
  client: process.env.BW_CLIENT!,
  language: process.env.BW_LANGUAGE!
}

const TEST_ADSO = "ZL_FID40"

describe("ADSO 读取接口验证 (ZL_FID40)", () => {
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

  afterAll(async () => {
    if (client.loggedin) await client.logout()
  })

  // ✅ 核心请求 1: GET /sap/bw/modeling/adso/zl_fid40/m → 200
  test("getADSO() - ADSO 元数据 (对应日志 14:40:55)", async () => {
    const raw = await client.getADSO(TEST_ADSO, true) // forceCacheUpdate 模拟首次加载

    expect(raw).toBeDefined()
    console.log(`\n=== getADSO raw keys ===`)
    console.log(JSON.stringify(Object.keys(raw), null, 2))
  }, 30000)

  // ✅ 核心请求 1 (解析版)
  test("getADSODetails() - 解析后的 ADSO 详情", async () => {
    const details = await client.getADSODetails(TEST_ADSO, true)

    expect(details).toBeDefined()
    console.log(`\n========== ADSO Details: ${TEST_ADSO} ==========`)
    console.log(`Name:             ${details.name}`)
    console.log(`Technical Name:   ${details.technicalName}`)
    console.log(`Type:             ${details.adsoType}`)
    console.log(`Status:           ${details.status}`)
    console.log(`Object Version:   ${details.objVers}`)
    console.log(`InfoArea:         ${details.infoArea}`)
    console.log(`Description:      ${details.description}`)
    console.log(`=========================================\n`)
  }, 30000)

  // ✅ 核心请求 3: GET /sap/bw/modeling/adso/zl_fid40/versions → 200
  test("getADSOVersions() - 版本历史 (对应日志 14:41:02)", async () => {
    const versions = await client.getADSOVersions(TEST_ADSO)

    expect(Array.isArray(versions)).toBe(true)
    console.log(`\n========== ADSO Versions: ${TEST_ADSO} ==========`)
    console.log(`Found ${versions.length} version(s)`)
    versions.forEach((v, i) => {
      console.log(`  [${i + 1}] ${v.version}  ${v.description || ""}  URI: ${v.uri}`)
    })
    console.log(`============================================\n`)

    expect(versions.length).toBeGreaterThan(0)
  }, 30000)

  // ✅ 核心请求 4: GET /sap/bw/modeling/adso/ZL_FID40/configuration → 200
  test("getADSOConfiguration() - 配置信息 (对应日志 14:41:03)", async () => {
    const config = await client.getADSOConfiguration(TEST_ADSO)

    expect(config).toBeDefined()
    console.log(`\n========== ADSO Configuration: ${TEST_ADSO} ==========`)
    console.log(`Name:                     ${config.name}`)
    console.log(`Technical Name:           ${config.technicalName}`)
    console.log(`Type:                     ${config.adsoType}`)
    console.log(`Semantic Partitioning:    ${config.semanticPartitioning}`)
    console.log(`Reporting Enabled:        ${config.reportingEnabled}`)
    console.log(`Consolidation Enabled:    ${config.consolidationEnabled}`)
    console.log(`Inbound Interface Enabled:${config.inboundInterfaceEnabled}`)
    console.log(`Description:              ${config.description}`)
    console.log(`===================================================\n`)
  }, 30000)

  // ✅ 核心请求 5: GET /sap/bw/modeling/iobj/0fiscvarnt/a → 200
  test("getInfoObject() - 引用的 InfoObject 0FISCVARNT (对应日志 14:41:06)", async () => {
    const iobj = await client.getInfoObject("0FISCVARNT")

    expect(iobj).toBeDefined()
    console.log(`\n========== InfoObject: 0FISCVARNT ==========`)
    console.log(JSON.stringify(iobj, null, 2).slice(0, 1500))
    console.log(`============================================\n`)
  }, 30000)
})
