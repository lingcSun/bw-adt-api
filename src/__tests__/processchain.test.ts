import { BWAdtClient } from "../BWAdtClient"

// 测试配置 - 请根据实际情况修改
const testConfig = {
  baseUrl: process.env.BW_BASE_URL || "http://your-bw-server:8000",
  username: process.env.BW_USERNAME || "your-username",
  password: process.env.BW_PASSWORD || "your-password",
  client: process.env.BW_CLIENT || "100",
  language: process.env.BW_LANGUAGE || "EN"
}

// 测试用的 Process Chain 名称
const TEST_CHAIN = process.env.BW_TEST_PROCESS_CHAIN || "YOUR_PROCESS_CHAIN_NAME"

describe("BW Process Chain Tests", () => {
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
    console.log(`\n========== Process Chain Tests Starting ==========\n`)
  }, 30000)

  test("should get process chain details", async () => {
    const details = await client.getProcessChainDetails(TEST_CHAIN)

    expect(details).toBeDefined()

    console.log(`\n========== Process Chain Details: ${TEST_CHAIN} ==========`)
    console.log(`Name: ${details.name}`)
    console.log(`Technical Name: ${details.technicalName}`)
    console.log(`Description: ${details.description}`)
    console.log(`Object Version: ${details.objVers}`)
    console.log(`Chain Type: ${details.chainType}`)
    console.log(`Status: ${details.status}`)
    console.log(`Created: ${details.created}`)
    console.log(`Changed: ${details.changed}`)
    console.log(`Changed By: ${details.changedBy}`)

    if (details.steps && details.steps.length > 0) {
      console.log(`\n--- Steps (${details.steps.length}) ---`)
      details.steps.forEach((step: any, index: number) => {
        console.log(`  [${index + 1}] ${step.stepType} - ${step.stepId}`)
        if (step.description) console.log(`      Description: ${step.description}`)
        if (step.status) console.log(`      Status: ${step.status}`)
        if (step.source) console.log(`      Source: ${step.source}`)
        if (step.target) console.log(`      Target: ${step.target}`)
      })
    }
    console.log(`========================================================\n`)
  }, 30000)

  test("should get process chain versions", async () => {
    const versions = await client.getProcessChainVersions(TEST_CHAIN)

    expect(versions).toBeDefined()
    expect(Array.isArray(versions)).toBe(true)

    console.log(`\n========== Process Chain Versions: ${TEST_CHAIN} ==========`)
    console.log(`Found ${versions.length} version(s)`)
    versions.forEach((v: any, index: number) => {
      console.log(`  [${index + 1}] Version: ${v.version}`)
      console.log(`      Description: ${v.description}`)
      console.log(`      URI: ${v.uri}`)
      console.log(`      Created: ${v.created}`)
      console.log(`      User: ${v.user}`)
    })
    console.log(`============================================================\n`)

    // 通常应该有至少一个版本
    expect(versions.length).toBeGreaterThan(0)
  }, 30000)

  test("should lock process chain", async () => {
    const lockResult = await client.lockProcessChain(TEST_CHAIN)

    expect(lockResult).toBeDefined()
    expect(lockResult.lockHandle).toBeDefined()
    expect(lockResult.lockHandle).not.toBe("")

    console.log(`\n========== Process Chain Lock Result: ${TEST_CHAIN} ==========`)
    console.log(`Lock Handle: ${lockResult.lockHandle}`)
    if (lockResult.corrNr) console.log(`Transport Request: ${lockResult.corrNr}`)
    if (lockResult.corrUser) console.log(`Transport User: ${lockResult.corrUser}`)
    if (lockResult.corrText) console.log(`Transport Description: ${lockResult.corrText}`)
    console.log(`================================================================\n`)

    // 测试完成后自动解锁
    await client.unlockProcessChain(TEST_CHAIN)
  }, 30000)

  test("should unlock process chain", async () => {
    // 先锁定
    const lockResult = await client.lockProcessChain(TEST_CHAIN)
    expect(lockResult.lockHandle).toBeDefined()

    // 然后解锁
    await client.unlockProcessChain(TEST_CHAIN)

    console.log(`\n========== Process Chain Unlock Result: ${TEST_CHAIN} ==========`)
    console.log(`Successfully unlocked process chain`)
    console.log(`===================================================================\n`)
  }, 30000)

  test("should check process chain consistency", async () => {
    const checkResult = await client.checkProcessChain(TEST_CHAIN)

    expect(checkResult).toBeDefined()
    expect(checkResult.messages).toBeDefined()
    expect(Array.isArray(checkResult.messages)).toBe(true)

    console.log(`\n========== Process Chain Check Result: ${TEST_CHAIN} ==========`)
    console.log(`Success: ${checkResult.success}`)
    if (checkResult.messages) {
      console.log(`Messages: ${checkResult.messages.length}`)
      checkResult.messages.forEach((msg: any, index: number) => {
        console.log(`  [${index + 1}] ${msg.type}: ${msg.message}`)
        if (msg.object) console.log(`      Object: ${msg.object}`)
      })
    }
    console.log(`=================================================================\n`)
  }, 30000)

  test("should activate process chain", async () => {
    // 先锁定
    const lockResult = await client.lockProcessChain(TEST_CHAIN)
    expect(lockResult.lockHandle).toBeDefined()

    // 激活
    const activateResult = await client.activateProcessChain(TEST_CHAIN, lockResult.lockHandle)

    expect(activateResult).toBeDefined()
    expect(activateResult.messages).toBeDefined()
    expect(Array.isArray(activateResult.messages)).toBe(true)

    console.log(`\n========== Process Chain Activation Result: ${TEST_CHAIN} ==========`)
    console.log(`Success: ${activateResult.success}`)
    if (activateResult.messages) {
      console.log(`Messages: ${activateResult.messages.length}`)
      activateResult.messages.forEach((msg: any, index: number) => {
        console.log(`  [${index + 1}] ${msg.type}: ${msg.message}`)
        if (msg.object) console.log(`      Object: ${msg.object}`)
      })
    }
    console.log(`========================================================================\n`)

    // 测试完成后自动解锁
    await client.unlockProcessChain(TEST_CHAIN)
  }, 30000)

  test("should get process chain status", async () => {
    const status = await client.getProcessChainStatus(TEST_CHAIN)

    expect(status).toBeDefined()
    expect(status.chainName).toBeDefined()
    expect(status.status).toBeDefined()

    console.log(`\n========== Process Chain Status: ${TEST_CHAIN} ==========`)
    console.log(`Chain Name: ${status.chainName}`)
    console.log(`Status: ${status.status}`)
    if (status.currentStep) console.log(`Current Step: ${status.currentStep}`)
    if (status.totalSteps) console.log(`Total Steps: ${status.totalSteps}`)
    if (status.completedSteps) console.log(`Completed Steps: ${status.completedSteps}`)
    if (status.startTime) console.log(`Start Time: ${status.startTime}`)
    if (status.endTime) console.log(`End Time: ${status.endTime}`)
    if (status.message) console.log(`Message: ${status.message}`)
    console.log(`============================================================\n`)
  }, 30000)

  test("should get process chain logs", async () => {
    const logs = await client.getProcessChainLogs(TEST_CHAIN)

    expect(logs).toBeDefined()
    expect(Array.isArray(logs)).toBe(true)

    console.log(`\n========== Process Chain Logs: ${TEST_CHAIN} ==========`)
    console.log(`Found ${logs.length} log entry(ies)`)

    logs.forEach((log: any, index: number) => {
      console.log(`  [${index + 1}] Status: ${log.status}`)
      console.log(`      Chain: ${log.chainName}`)
      if (log.stepName) console.log(`      Step: ${log.stepName}`)
      if (log.timestamp) console.log(`      Time: ${log.timestamp}`)
      if (log.message) console.log(`      Message: ${log.message}`)
      if (log.duration) console.log(`      Duration: ${log.duration}ms`)
      if (log.recordsProcessed) console.log(`      Records: ${log.recordsProcessed}`)
    })
    console.log(`===========================================================\n`)
  }, 30000)

  // 注意：以下测试会实际执行流程链，请谨慎使用
  // 取消注释以测试执行功能

  /*
  test("should execute process chain", async () => {
    const execResult = await client.executeProcessChain(TEST_CHAIN)

    expect(execResult).toBeDefined()

    console.log(`\n========== Process Chain Execution Result: ${TEST_CHAIN} ==========`)
    console.log(`Success: ${execResult.success}`)
    if (execResult.requestID) console.log(`Request ID: ${execResult.requestID}`)
    if (execResult.message) console.log(`Message: ${execResult.message}`)
    if (execResult.startTime) console.log(`Start Time: ${execResult.startTime}`)
    if (execResult.endTime) console.log(`End Time: ${execResult.endTime}`)
    if (execResult.status) console.log(`Status: ${execResult.status}`)
    console.log(`=========================================================================\n`)
  }, 60000)

  test("should stop running process chain", async () => {
    const stopResult = await client.stopProcessChain(TEST_CHAIN)

    expect(stopResult).toBeDefined()
    expect(stopResult.success).toBeDefined()

    console.log(`\n========== Process Chain Stop Result: ${TEST_CHAIN} ==========`)
    console.log(`Success: ${stopResult.success}`)
    if (stopResult.message) console.log(`Message: ${stopResult.message}`)
    console.log(`================================================================\n`)
  }, 30000)
  */

  afterAll(async () => {
    await client.logout()
    console.log(`\n========== Process Chain Tests Completed ==========\n`)
  }, 30000)
})
