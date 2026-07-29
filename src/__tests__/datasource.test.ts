import { BWAdtClient } from "../BWAdtClient"

/**
 * DataSource (RSDS) 读取接口验证 - 对照 Eclipse 打开 DataSource 的 Communication Log
 *
 * 日志中的核心请求 (ZBW_ZFIVTASK_STAGE_H / S4DCLNT300):
 *   09:12:54  GET /sap/bw/modeling/rsds/ZBW_ZFIVTASK_STAGE_H/S4DCLNT300/m?forceCacheUpdate=true  → 200 (28KB)
 *   09:12:54  GET /sap/bw/modeling/rsds/zbw_zfivtask_stage_h/s4dclnt300/versions                  → 200 (0.9KB)
 */

const testConfig = {
  baseUrl: process.env.BW_BASE_URL!,
  username: process.env.BW_USERNAME!,
  password: process.env.BW_PASSWORD!,
  client: process.env.BW_CLIENT!,
  language: process.env.BW_LANGUAGE!
}

// 实测对象: 履约义务拆分分期抬头表, ODP 类型, 源系统 S4DCLNT300
const TEST_DATASOURCE = "ZBW_ZFIVTASK_STAGE_H"
const TEST_SOURCE_SYSTEM = "S4DCLNT300"

describe("DataSource (RSDS) 读取接口验证", () => {
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

  // ✅ 核心请求 1: GET /rsds/{ds}/{src}/m?forceCacheUpdate=true → 200 (28KB)
  test("getDataSource() - DataSource 元数据 (对应日志 09:12:54)", async () => {
    const raw = await client.getDataSource(TEST_DATASOURCE, TEST_SOURCE_SYSTEM, true)

    expect(raw).toBeDefined()
    const root = raw["rsds:dataSource"]
    expect(root).toBeDefined()
    expect(root["@_name"]).toBe(TEST_DATASOURCE)
    expect(root["@_sourceSystemName"]).toBe(TEST_SOURCE_SYSTEM)
  }, 30000)

  // ✅ 核心请求 1 (解析版)
  test("getDataSourceDetails() - 解析后的 DataSource 详情", async () => {
    const details = await client.getDataSourceDetails(TEST_DATASOURCE, TEST_SOURCE_SYSTEM, true)

    expect(details).toBeDefined()
    console.log(`\n========== DataSource Details: ${TEST_DATASOURCE} ==========`)
    console.log(`Name:        ${details.name}`)
    console.log(`Type:        ${details.type}`)
    console.log(`Source Sys:  ${details.sourceSystem}`)
    console.log(`AppComp:     ${details.applicationComponent}`)
    console.log(`Adapter:     ${details.adapterType}`)
    console.log(`Description: ${details.description}`)
    console.log(`Object Ver:  ${details.objectVersion}`)
    console.log(`Status:      ${details.objectStatus}`)
    console.log(`=========================================\n`)

    expect(details.name).toBe(TEST_DATASOURCE)
    expect(details.sourceSystem).toBe(TEST_SOURCE_SYSTEM)
    expect(details.adapterType).toBe("ODP")
    expect(details.objectStatus).toBe("active")
  }, 30000)

  // ✅ 字段列表解析
  test("getDataSourceFields() - 解析字段列表", async () => {
    const fields = await client.getDataSourceFields(TEST_DATASOURCE, TEST_SOURCE_SYSTEM, true)

    expect(Array.isArray(fields)).toBe(true)
    expect(fields.length).toBeGreaterThan(0)
    console.log(`\n========== DataSource Fields: ${fields.length} 个 ==========`)
    fields.slice(0, 5).forEach((f, i) => {
      console.log(`  [${i + 1}] ${f.name} ${f.dataType}${f.length ? "(" + f.length + ")" : ""} pos=${f.position} label=${f.label || ""}`)
    })
    console.log(`=========================================\n`)

    // MATNR 字段应在列表中
    const matnr = fields.find(f => f.name === "MATNR")
    expect(matnr).toBeDefined()
    expect(matnr!.dataType).toBe("CHAR")
  }, 30000)

  // ✅ 核心请求 2: GET /rsds/{ds}/{src}/versions → 200 (0.9KB)
  test("getDataSourceVersions() - 版本历史 (对应日志 09:12:54)", async () => {
    const versions = await client.getDataSourceVersions(TEST_DATASOURCE, TEST_SOURCE_SYSTEM)

    expect(Array.isArray(versions)).toBe(true)
    console.log(`\n========== DataSource Versions: ${TEST_DATASOURCE} ==========`)
    console.log(`Found ${versions.length} version(s)`)
    versions.forEach((v, i) => {
      console.log(`  [${i + 1}] ${v.version}  ${v.description || ""}  URI: ${v.uri}`)
    })
    console.log(`============================================\n`)

    expect(versions.length).toBeGreaterThan(0)
  }, 30000)
})
