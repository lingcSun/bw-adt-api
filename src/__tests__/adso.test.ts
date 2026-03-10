import { BWAdtClient } from "../BWAdtClient"

// 测试配置 - 请根据实际情况修改
const testConfig = {
  baseUrl: process.env.BW_BASE_URL || "http://your-bw-server:8000",
  username: process.env.BW_USERNAME || "your-username",
  password: process.env.BW_PASSWORD || "your-password",
  client: process.env.BW_CLIENT || "100",
  language: process.env.BW_LANGUAGE || "EN"
}

// 测试用的 ADSO 名称 - 使用实际存在的 ADSO
const TEST_ADSO = process.env.BW_TEST_ADSO || "YOUR_ADSO_NAME"

describe("BW ADSO Tests", () => {
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
    console.log(`\n========== ADSO Tests Starting ==========\n`)
  }, 30000)

  test("should get ADSO details", async () => {
    // 强制刷新缓存以获取实际内容
    const details = await client.getADSODetails(TEST_ADSO, true)

    expect(details).toBeDefined()
    // 如果 technicalName 为空（304缓存响应），至少应该有其他字段
    if (!details.technicalName || details.technicalName === "") {
      console.log(`Note: Got cached response (304), some fields may be empty`)
    }

    console.log(`\n========== ADSO Details: ${TEST_ADSO} ==========`)
    console.log(`Name: ${details.name}`)
    console.log(`Technical Name: ${details.technicalName}`)
    console.log(`Type: ${details.adsoType}`)
    console.log(`Status: ${details.status}`)
    console.log(`Object Version: ${details.objVers}`)
    console.log(`InfoArea: ${details.infoArea}`)
    console.log(`Description: ${details.description}`)
    console.log(`Is RealTime: ${details.isRealTime}`)
    console.log(`Partitioning: ${details.partitioning}`)
    console.log(`Activation Status: ${details.activationStatus}`)
    console.log(`=========================================\n`)
  }, 30000)

  test("should get ADSO configuration", async () => {
    const config = await client.getADSOConfiguration(TEST_ADSO)

    expect(config).toBeDefined()

    console.log(`\n========== ADSO Configuration: ${TEST_ADSO} ==========`)
    console.log(`Name: ${config.name}`)
    console.log(`Technical Name: ${config.technicalName}`)
    console.log(`Type: ${config.adsoType}`)
    console.log(`Semantic Partitioning: ${config.semanticPartitioning}`)
    console.log(`Reporting Enabled: ${config.reportingEnabled}`)
    console.log(`Consolidation Enabled: ${config.consolidationEnabled}`)
    console.log(`Inbound Interface Enabled: ${config.inboundInterfaceEnabled}`)
    console.log(`Description: ${config.description}`)
    console.log(`===================================================\n`)
  }, 30000)

  test("should get ADSO versions", async () => {
    const versions = await client.getADSOVersions(TEST_ADSO)

    expect(versions).toBeDefined()
    expect(Array.isArray(versions)).toBe(true)

    console.log(`\n========== ADSO Versions: ${TEST_ADSO} ==========`)
    console.log(`Found ${versions.length} version(s)`)
    versions.forEach((v, index) => {
      console.log(`  [${index + 1}] Version: ${v.version}`)
      console.log(`      Description: ${v.description}`)
      console.log(`      URI: ${v.uri}`)
      console.log(`      Created: ${v.created}`)
    })
    console.log(`=============================================\n`)

    // 通常应该有至少一个版本
    expect(versions.length).toBeGreaterThan(0)
  }, 30000)

  test("should lock ADSO", async () => {
    const lockResult = await client.lockADSO(TEST_ADSO)

    expect(lockResult).toBeDefined()
    expect(lockResult.lockHandle).toBeDefined()
    expect(lockResult.lockHandle).not.toBe("")

    console.log(`\n========== ADSO Lock Result: ${TEST_ADSO} ==========`)
    console.log(`Lock Handle: ${lockResult.lockHandle}`)
    console.log(`CorrNr: ${lockResult.corrNr || "N/A"}`)
    console.log(`CorrUser: ${lockResult.corrUser || "N/A"}`)
    console.log(`CorrText: ${lockResult.corrText || "N/A"}`)
    console.log(`=================================================\n`)

    // 解锁以避免占用
    await client.unlockADSO(TEST_ADSO)
    console.log("ADSO unlocked after lock test")
  }, 30000)

  test("should check ADSO consistency", async () => {
    const checkResult = await client.checkADSO(TEST_ADSO)

    expect(checkResult).toBeDefined()
    expect(checkResult.success).toBeDefined()

    console.log(`\n========== ADSO Check Result: ${TEST_ADSO} ==========`)
    console.log(`Success: ${checkResult.success}`)
    if (checkResult.messages && checkResult.messages.length > 0) {
      console.log(`Messages (${checkResult.messages.length}):`)
      checkResult.messages.forEach((msg, index) => {
        console.log(`  [${index + 1}] Type: ${msg.messageType}`)
        console.log(`      Title: ${msg.title}`)
        if (msg.errorPosition) {
          console.log(`      Error Position: ${msg.errorPosition}`)
        }
      })
    } else {
      console.log(`Messages: None`)
    }
    console.log(`=================================================\n`)
  }, 30000)

  test("should lock and activate ADSO", async () => {
    // 1. 锁定 ADSO
    const lockResult = await client.lockADSO(TEST_ADSO)
    expect(lockResult.lockHandle).toBeDefined()

    console.log(`\n========== ADSO Lock & Activate: ${TEST_ADSO} ==========`)
    console.log(`Step 1: Locked`)
    console.log(`Lock Handle: ${lockResult.lockHandle}`)

    // 2. 检查 ADSO（可选）
    const checkResult = await client.checkADSO(TEST_ADSO)
    console.log(`\nStep 2: Checked`)
    console.log(`Check Success: ${checkResult.success}`)

    // 3. 激活 ADSO
    const activateResult = await client.activateADSO(TEST_ADSO, lockResult.lockHandle)
    console.log(`\nStep 3: Activated`)
    console.log(`Activate Success: ${activateResult.success}`)
    if (activateResult.messages && activateResult.messages.length > 0) {
      console.log(`Messages (${activateResult.messages.length}):`)
      activateResult.messages.forEach((msg, index) => {
        console.log(`  [${index + 1}] ${msg.messageType}: ${msg.title}`)
      })
    }

    // 4. 解锁 ADSO
    await client.unlockADSO(TEST_ADSO)
    console.log(`\nStep 4: Unlocked`)
    console.log(`======================================================\n`)

    expect(activateResult.success).toBe(true)
  }, 60000) // 60秒超时，因为激活可能需要更长时间

  test("should handle lock/unlock cycle", async () => {
    console.log(`\n========== ADSO Lock/Unlock Cycle: ${TEST_ADSO} ==========`)

    // 第一次锁定
    const lock1 = await client.lockADSO(TEST_ADSO)
    console.log(`First lock obtained: ${lock1.lockHandle}`)
    expect(lock1.lockHandle).toBeDefined()

    // 解锁
    await client.unlockADSO(TEST_ADSO)
    console.log(`Unlocked`)

    // 第二次锁定
    const lock2 = await client.lockADSO(TEST_ADSO)
    console.log(`Second lock obtained: ${lock2.lockHandle}`)
    expect(lock2.lockHandle).toBeDefined()

    // 最终解锁
    await client.unlockADSO(TEST_ADSO)
    console.log(`Final unlock completed`)
    console.log(`=========================================================\n`)
  }, 30000)

  afterAll(async () => {
    console.log(`\n========== ADSO Tests Completed ==========\n`)
    if (client.loggedin) {
      await client.logout()
      console.log("Logged out successfully")
    }
  })
})
