import { BWAdtClient } from "../BWAdtClient"

// 测试配置 - 请根据实际情况修改
const testConfig = {
  baseUrl: process.env.BW_BASE_URL || "http://your-bw-server:8000",
  username: process.env.BW_USERNAME || "your-username",
  password: process.env.BW_PASSWORD || "your-password",
  client: process.env.BW_CLIENT || "100",
  language: process.env.BW_LANGUAGE || "EN"
}

// 测试用的 Transformation 名称
const TEST_TRFN = process.env.BW_TEST_TRFN || "YOUR_TRFN_NAME"

describe("BW Transformation Tests", () => {
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
    console.log(`\n========== Transformation Tests Starting ==========\n`)
  }, 30000)

  test("should get transformation details", async () => {
    const details = await client.getTransformationDetails(TEST_TRFN)

    expect(details).toBeDefined()

    console.log(`\n========== Transformation Details: ${TEST_TRFN} ==========`)
    console.log(`Name: ${details.name}`)
    console.log(`Source: ${details.source}`)
    console.log(`Target: ${details.target}`)
    console.log(`Description: ${details.description}`)
    console.log(`Object Version: ${details.objVers}`)
    console.log(`Source Type: ${details.sourceType}`)
    console.log(`Target Type: ${details.targetType}`)
    console.log(`Rule Count: ${details.ruleCount}`)
    console.log(`Status: ${details.status}`)
    console.log(`========================================================\n`)
  }, 30000)

  test("should get transformation versions", async () => {
    const versions = await client.getTransformationVersions(TEST_TRFN)

    expect(versions).toBeDefined()
    expect(Array.isArray(versions)).toBe(true)

    console.log(`\n========== Transformation Versions: ${TEST_TRFN} ==========`)
    console.log(`Found ${versions.length} version(s)`)
    versions.forEach((v: any, index: number) => {
      console.log(`  [${index + 1}] Version: ${v.version}`)
      console.log(`      Description: ${v.description}`)
      console.log(`      URI: ${v.uri}`)
      console.log(`      Created: ${v.created}`)
      console.log(`      User: ${v.user}`)
    })
    console.log(`===========================================================\n`)

    // 通常应该有至少一个版本
    expect(versions.length).toBeGreaterThan(0)
  }, 30000)

  test("should lock transformation", async () => {
    const lockResult = await client.lockTransformation(TEST_TRFN)

    expect(lockResult).toBeDefined()
    expect(lockResult.lockHandle).toBeDefined()
    expect(lockResult.lockHandle).not.toBe("")

    console.log(`\n========== Transformation Lock Result: ${TEST_TRFN} ==========`)
    console.log(`Lock Handle: ${lockResult.lockHandle}`)
    console.log(`CorrNr: ${lockResult.corrNr || "N/A"}`)
    console.log(`CorrUser: ${lockResult.corrUser || "N/A"}`)
    console.log(`CorrText: ${lockResult.corrText || "N/A"}`)
    console.log(`=============================================================\n`)

    // 解锁以避免占用
    await client.unlockTransformation(TEST_TRFN)
    console.log("Transformation unlocked after lock test")
  }, 30000)

  test("should check transformation", async () => {
    const checkResult = await client.checkTransformation(TEST_TRFN)

    expect(checkResult).toBeDefined()
    expect(checkResult.success).toBeDefined()

    console.log(`\n========== Transformation Check Result: ${TEST_TRFN} ==========`)
    console.log(`Success: ${checkResult.success}`)
    if (checkResult.messages && checkResult.messages.length > 0) {
      console.log(`Messages (${checkResult.messages.length}):`)
      checkResult.messages.forEach((msg: any, index: number) => {
        console.log(`  [${index + 1}] Type: ${msg.messageType}`)
        console.log(`      Title: ${msg.title}`)
        if (msg.errorPosition) {
          console.log(`      Error Position: ${msg.errorPosition}`)
        }
      })
    } else {
      console.log(`Messages: None`)
    }
    console.log(`=============================================================\n`)
  }, 30000)

  test("should handle lock/unlock cycle", async () => {
    console.log(`\n========== Transformation Lock/Unlock Cycle: ${TEST_TRFN} ==========`)

    // 第一次锁定
    const lock1 = await client.lockTransformation(TEST_TRFN)
    console.log(`First lock obtained: ${lock1.lockHandle}`)
    expect(lock1.lockHandle).toBeDefined()

    // 解锁
    await client.unlockTransformation(TEST_TRFN)
    console.log(`Unlocked`)

    // 第二次锁定
    const lock2 = await client.lockTransformation(TEST_TRFN)
    console.log(`Second lock obtained: ${lock2.lockHandle}`)
    expect(lock2.lockHandle).toBeDefined()

    // 最终解锁
    await client.unlockTransformation(TEST_TRFN)
    console.log(`Final unlock completed`)
    console.log(`=====================================================================\n`)
  }, 30000)

  afterAll(async () => {
    console.log(`\n========== Transformation Tests Completed ==========\n`)
    if (client.loggedin) {
      await client.logout()
      console.log("Logged out successfully")
    }
  })
})
