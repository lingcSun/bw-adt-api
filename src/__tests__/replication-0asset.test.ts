import { BWAdtClient } from "../BWAdtClient"
import { buildReplicationRequestBody, parseReplicationTasks } from "../api/replication"

/**
 * Replicate DataSource 0ASSET_ATTR_TEXT - 数据源复制完整流程
 *
 * 完整流程 (对应 Eclipse 右键数据源 "Replicate" 的 Communication Log):
 *   1. GET  /sap/bw/modeling/lsysint/replication/{src}?datasource={ds}  → 复制预检
 *   2. POST /sap/bw/modeling/lsysint/replication/{src}?datasource=...&activate=changed&background=true → 触发复制
 *
 * 由于 0ASSET_ATTR_TEXT 已存在, 预检返回 operation="UEQ" (Update if Equal),
 * 这是幂等的元数据刷新操作 (Eclipse 标准 "重新复制" 行为), background=true 后台执行。
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

describe(`Replicate DataSource ${DATASOURCE}`, () => {
  let client: BWAdtClient
  let preCheckTasks: any[]

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

  // ==========================================================================
  // Step 1: 复制预检 (GET)
  // ==========================================================================
  test("① getReplicationInfo() - 复制预检", async () => {
    preCheckTasks = await client.getReplicationInfo(SOURCE_SYSTEM, DATASOURCE)

    console.log(`\n========== 复制预检: ${DATASOURCE} (${preCheckTasks.length} 个任务) ==========`)
    preCheckTasks.forEach((t, i) => {
      console.log(`  [${i + 1}] datasource:    ${t.datasource}`)
      console.log(`      tlogo:          ${t.tlogo}`)
      console.log(`      operation:      ${t.operation} (UEQ=Update if Equal)`)
      console.log(`      execute:        ${t.execute}`)
      console.log(`      externalObject: ${t.externalObject}`)
      console.log(`      uri:            ${t.uri}`)
    })
    console.log("=".repeat(60) + "\n")

    expect(Array.isArray(preCheckTasks)).toBe(true)
    expect(preCheckTasks.length).toBeGreaterThan(0)
    expect(preCheckTasks[0].datasource).toBe(DATASOURCE)
    expect(preCheckTasks[0].tlogo).toBe("RSDS")
    // 已存在的 DS 预检返回 UEQ (更新而非新增)
    expect(preCheckTasks[0].operation).toBe("UEQ")
  }, 30000)

  // ==========================================================================
  // Step 2: 构造请求体验证 (round-trip, 无网络)
  // ==========================================================================
  test("② buildReplicationRequestBody() - 预检任务可构造回传请求体", () => {
    expect(preCheckTasks).toBeDefined()
    expect(preCheckTasks!.length).toBeGreaterThan(0)

    const body = buildReplicationRequestBody(preCheckTasks!)

    console.log("\n========== 回传请求体 ==========")
    console.log(body)
    console.log("=".repeat(40) + "\n")

    // 结构校验: ATOM feed 包 replicationTask
    expect(body).toContain("<atom:feed")
    expect(body).toContain("dsReplication:replicationTask")
    expect(body).toContain(`datasource="${DATASOURCE}"`)
    expect(body).toContain('tlogo="RSDS"')
    expect(body).toContain('operation="UEQ"')
    expect(body).toContain('execute="true"')

    // round-trip: 构造的 body 可被重新解析 (与 GET 响应结构一致)
    const reparsed = parseReplicationTasks(body)
    expect(reparsed.length).toBe(preCheckTasks!.length)
    expect(reparsed[0].datasource).toBe(DATASOURCE)
    expect(reparsed[0].operation).toBe("UEQ")
  })

  // ==========================================================================
  // Step 3: 触发复制 (POST, background=true)
  // ==========================================================================
  test("③ replicateDataSource() - 触发后台复制 (UEQ 幂等刷新)", async () => {
    // 使用预检任务触发, activate=changed 仅激活变更, background=true 后台执行
    const result = await client.replicateDataSource(
      SOURCE_SYSTEM,
      DATASOURCE,
      preCheckTasks!,
      { activate: "changed", background: true }
    )

    console.log("\n========== 复制触发结果 ==========")
    console.log(`Job Name:  ${result.jobName}`)
    console.log(`Job Count: ${result.jobCount}`)
    console.log("=".repeat(40) + "\n")

    // 后台执行返回 job 句柄 (RSDS_REPLICATION 是标准复制作业)
    expect(result.jobName).toBe("RSDS_REPLICATION")
    expect(result.jobCount).toBeDefined()
    expect(result.jobCount).toMatch(/^\d+$/)  // jobCount 是数字字符串
  }, 60000)

  // ==========================================================================
  // Step 4: 复制后验证 DS 仍然可读且 active
  // ==========================================================================
  test("④ 复制后 DataSource 仍可读且 active", async () => {
    const details = await client.getDataSourceDetails(DATASOURCE, SOURCE_SYSTEM, true)

    console.log("\n========== 复制后状态 ==========")
    console.log(`名称: ${details.name}`)
    console.log(`状态: ${details.objectStatus}/${details.objectVersion}`)
    console.log("=".repeat(35) + "\n")

    expect(details.name).toBe(DATASOURCE)
    expect(details.objectStatus).toBe("active")
    expect(details.adapterType).toBe("ODP")
  }, 30000)
})
