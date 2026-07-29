import { BWAdtClient } from "../BWAdtClient"

/**
 * DataSource Replication 接口验证 - 对照 Eclipse 右键数据源 "Replicate" 的 Communication Log
 *
 * 日志中的核心请求 (S4DCLNT300 系统):
 *   09:17:22  GET  /sap/bw/modeling/lsysint/replication/S4DCLNT300?datasource=ZBW_FI_TASKSTAGE_I...  → 200 (复制预检)
 *   09:17:25  POST /sap/bw/modeling/lsysint/replication/S4DCLNT300?datasource=...&activate=changed&background=true → 200 (触发复制)
 *
 * 注意: POST 触发会真正在 BW 后台执行复制 (background=true), 会修改系统状态。
 * 默认只验证 GET 预检; 触发测试用 .skip 保护, 确认安全后手动放开。
 */

const testConfig = {
  baseUrl: process.env.BW_BASE_URL!,
  username: process.env.BW_USERNAME!,
  password: process.env.BW_PASSWORD!,
  client: process.env.BW_CLIENT!,
  language: process.env.BW_LANGUAGE!
}

const TEST_DATASOURCE = "ZBW_FI_TASKSTAGE_I"
const TEST_SOURCE_SYSTEM = "S4DCLNT300"

describe("DataSource Replication 接口验证", () => {
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

  // ✅ 核心请求 1: GET .../replication/{src}?datasource= → 200 (复制预检)
  test("getReplicationInfo() - 复制预检 (对应日志 09:17:22)", async () => {
    const tasks = await client.getReplicationInfo(TEST_SOURCE_SYSTEM, TEST_DATASOURCE)

    expect(Array.isArray(tasks)).toBe(true)
    expect(tasks.length).toBeGreaterThan(0)
    console.log(`\n========== Replication Tasks: ${TEST_DATASOURCE} ==========`)
    tasks.forEach((t, i) => {
      console.log(`  [${i + 1}] datasource=${t.datasource} tlogo=${t.tlogo} operation=${t.operation} execute=${t.execute}`)
      console.log(`      externalObject=${t.externalObject}`)
      console.log(`      uri=${t.uri}`)
    })
    console.log(`=========================================\n`)

    expect(tasks[0].datasource).toBe(TEST_DATASOURCE)
    expect(tasks[0].tlogo).toBe("RSDS")
    expect(tasks[0].operation).toBe("UEQ")
  }, 30000)

  // ⚠️ 触发复制会真正修改系统状态 (后台执行)。默认跳过, 需手动放开验证。
  // 放开后用 background=true 避免阻塞 HTTP 请求。
  test.skip("replicateDataSourceFull() - 触发复制 (对应日志 09:17:25, 默认跳过)", async () => {
    const { tasks, result } = await client.replicateDataSourceFull(
      TEST_SOURCE_SYSTEM,
      TEST_DATASOURCE,
      { activate: "changed", background: true }
    )

    console.log(`\n========== Replication Result ==========`)
    console.log(`Tasks: ${tasks.length}`)
    console.log(`Job: ${result.jobName} (${result.jobCount})`)
    console.log(`=========================================\n`)

    expect(result.jobName).toBe("RSDS_REPLICATION")
    expect(result.jobCount).toBeDefined()
  }, 60000)
})
