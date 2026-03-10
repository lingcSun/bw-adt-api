import { BWAdtClient } from "../BWAdtClient"

// 测试配置 - 请根据实际情况修改
const testConfig = {
  baseUrl: process.env.BW_BASE_URL || "http://your-bw-server:8000",
  username: process.env.BW_USERNAME || "your-username",
  password: process.env.BW_PASSWORD || "your-password",
  client: process.env.BW_CLIENT || "100",
  language: process.env.BW_LANGUAGE || "EN"
}

// 测试用的 DTP 名称
const TEST_DTP = process.env.BW_TEST_DTP || "YOUR_DTP_NAME"

describe("BW DTP Tests", () => {
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
    console.log(`\n========== DTP Tests Starting ==========\n`)
  }, 30000)

  test("should get DTP details", async () => {
    const details = await client.getDTPDetails(TEST_DTP)

    expect(details).toBeDefined()

    console.log(`\n========== DTP Details: ${TEST_DTP} ==========`)
    console.log(`Name: ${details.name}`)
    console.log(`Technical Name: ${details.technicalName}`)
    console.log(`Source: ${details.source}`)
    console.log(`Target: ${details.target}`)
    console.log(`Description: ${details.description}`)
    console.log(`Object Version: ${details.objVers}`)
    console.log(`DTP Type: ${details.dtpType}`)
    console.log(`Status: ${details.status}`)
    console.log(`Source Type: ${details.sourceType}`)
    console.log(`Target Type: ${details.targetType}`)
    console.log(`Delta Request: ${details.deltaRequest}`)
    console.log(`Real-Time Load: ${details.realTimeLoad}`)
    console.log(`=============================================\n`)
  }, 30000)

  test("should get DTP versions", async () => {
    const versions = await client.getDTPVersions(TEST_DTP)

    expect(versions).toBeDefined()
    expect(Array.isArray(versions)).toBe(true)

    console.log(`\n========== DTP Versions: ${TEST_DTP} ==========`)
    console.log(`Found ${versions.length} version(s)`)
    versions.forEach((v: any, index: number) => {
      console.log(`  [${index + 1}] Version: ${v.version}`)
      console.log(`      Description: ${v.description}`)
      console.log(`      URI: ${v.uri}`)
      console.log(`      Created: ${v.created}`)
      console.log(`      User: ${v.user}`)
    })
    console.log(`================================================\n`)

    // 通常应该有至少一个版本
    expect(versions.length).toBeGreaterThan(0)
  }, 30000)

  test("should lock DTP", async () => {
    const lockResult = await client.lockDTP(TEST_DTP)

    expect(lockResult).toBeDefined()
    expect(lockResult.lockHandle).toBeDefined()
    expect(lockResult.lockHandle).not.toBe("")

    console.log(`\n========== DTP Lock Result: ${TEST_DTP} ==========`)
    console.log(`Lock Handle: ${lockResult.lockHandle}`)
    console.log(`CorrNr: ${lockResult.corrNr || "N/A"}`)
    console.log(`CorrUser: ${lockResult.corrUser || "N/A"}`)
    console.log(`CorrText: ${lockResult.corrText || "N/A"}`)
    console.log(`==================================================\n`)

    // 解锁以避免占用
    await client.unlockDTP(TEST_DTP)
    console.log("DTP unlocked after lock test")
  }, 30000)

  test("should check DTP", async () => {
    const checkResult = await client.checkDTP(TEST_DTP)

    expect(checkResult).toBeDefined()

    console.log(`\n========== DTP Check Result: ${TEST_DTP} ==========`)
    console.log(`Result: ${JSON.stringify(checkResult, null, 2)}`)
    console.log(`==================================================\n`)
  }, 30000)

  test("should handle lock/unlock cycle", async () => {
    console.log(`\n========== DTP Lock/Unlock Cycle: ${TEST_DTP} ==========`)

    // 第一次锁定
    const lock1 = await client.lockDTP(TEST_DTP)
    console.log(`First lock obtained: ${lock1.lockHandle}`)
    expect(lock1.lockHandle).toBeDefined()

    // 解锁
    await client.unlockDTP(TEST_DTP)
    console.log(`Unlocked`)

    // 第二次锁定
    const lock2 = await client.lockDTP(TEST_DTP)
    console.log(`Second lock obtained: ${lock2.lockHandle}`)
    expect(lock2.lockHandle).toBeDefined()

    // 最终解锁
    await client.unlockDTP(TEST_DTP)
    console.log(`Final unlock completed`)
    console.log(`========================================================\n`)
  }, 30000)

  afterAll(async () => {
    console.log(`\n========== DTP Tests Completed ==========\n`)
    if (client.loggedin) {
      await client.logout()
      console.log("Logged out successfully")
    }
  })
})
