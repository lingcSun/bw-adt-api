import { BWAdtClient } from "../BWAdtClient"

/**
 * TRFN 结束例程源码保存/激活 — 对照 Eclipse Communication Log 20:07–20:09
 *
 * ABAP 类路径:
 *   LOCK (_action=LOCK) → PUT source/main → UNLOCK → POST /sap/bc/adt/activation
 * 随后回 TRFN:
 *   lock → transportchecks → PUT trfn → POST /sap/bw/modeling/activation → unlock
 *
 * 安全策略: 读回原样写回, 不改例程逻辑。
 */

const testConfig = {
  baseUrl: process.env.BW_BASE_URL!,
  username: process.env.BW_USERNAME!,
  password: process.env.BW_PASSWORD!,
  client: process.env.BW_CLIENT!,
  language: process.env.BW_LANGUAGE!
}

const TEST_TRFN = "0BE9X06HU3MN3FB1TO6MNLEGQI6XIJEO"
const EXPECTED_CLASS = "/BIC/3FB1TO6MNLEGQI6XIJEO_M"

describe("TRFN 结束例程源码写操作", () => {
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

  test("lockTransformationClass (_action=LOCK) / unlock", async () => {
    try {
      await client.unlockTransformationClass(TEST_TRFN, "")
    } catch {
      /* ignore */
    }

    const lock = await client.lockTransformationClass(TEST_TRFN)
    console.log(`\n=== Lock class ===`)
    console.log(`lockHandle: ${lock.lockHandle}`)
    console.log(`corrNr: ${lock.corrNr || "(none)"}`)
    console.log(`==================\n`)

    expect(lock.lockHandle).toBeTruthy()

    await client.unlockTransformationClass(TEST_TRFN, lock.lockHandle)
  }, 60000)

  test("getTransformationClassSource(workingArea)", async () => {
    const src = await client.getTransformationClassSource(TEST_TRFN, {
      forceCacheUpdate: true,
      classVersion: "workingArea"
    })

    console.log(`\n=== Source workingArea ===`)
    console.log(`class: ${src.className}`)
    console.log(`length: ${src.sourceCode.length}`)
    console.log(`has GLOBAL_END: ${/GLOBAL_END/i.test(src.sourceCode)}`)
    console.log(`==========================\n`)

    expect(src.className).toBe(EXPECTED_CLASS)
    expect(src.sourceCode.length).toBeGreaterThan(100)
    expect(src.sourceCode).toMatch(/GLOBAL_END/i)
  }, 60000)

  test("saveAndActivateTransformationClassSource() - 原样写回 + 激活类 + 激活TRFN", async () => {
    try {
      await client.unlockTransformation(TEST_TRFN)
    } catch {
      /* ignore */
    }
    try {
      const lock = await client.lockTransformationClass(TEST_TRFN)
      await client.unlockTransformationClass(TEST_TRFN, lock.lockHandle)
    } catch {
      /* ignore residual */
    }

    const src = await client.getTransformationClassSource(TEST_TRFN, {
      forceCacheUpdate: true
    })

    console.log(`\n=== Save & Activate class+TRFN ===`)
    console.log(`source length: ${src.sourceCode.length}`)

    const result = await client.saveAndActivateTransformationClassSource(
      TEST_TRFN,
      src.sourceCode,
      { transportDescription: "API routine round-trip activate" }
    )

    console.log(`className: ${result.className}`)
    console.log(`class lockHandle: ${result.classResult.lockHandle}`)
    console.log(`class activate: ${result.classResult.activateResult?.success}`)
    result.classResult.activateResult?.messages?.slice(0, 5).forEach((m, i) => {
      console.log(`  class[${i}] ${m.type}: ${m.shortText}`)
    })
    console.log(`trfn update: ${result.trfnResult?.updateResult?.success}`)
    console.log(`trfn activate: ${result.trfnResult?.activateResult?.success}`)
    result.trfnResult?.activateResult?.messages?.slice(0, 5).forEach((m, i) => {
      console.log(`  trfn[${i}] ${m.messageType}: ${m.title}`)
    })
    console.log(`=================================\n`)

    expect(result.className).toBe(EXPECTED_CLASS)
    expect(result.classResult.activateResult?.success).toBe(true)
    expect(result.trfnResult?.updateResult?.success).toBe(true)
    expect(result.trfnResult?.activateResult?.success).toBe(true)
  }, 300000)
})
