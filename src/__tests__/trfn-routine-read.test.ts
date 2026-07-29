import { BWAdtClient } from "../BWAdtClient"
import {
  extractAbapClassName,
  parseTransformationSettings
} from "../api/transformation"

/**
 * TRFN 结束例程 / ABAP 类读取验证
 * 对照 Eclipse Communication Log (2026-07-15 19:45):
 *   GET /trfn/0be9x06hu3mn3fb1to6mnlegqi6xijeo/m?forceCacheUpdate=true
 *   GET /oo/classes/%2fbic%2f3fb1to6mnlegqi6xijeo_m
 *   GET /oo/classes/%2fbic%2f3fb1to6mnlegqi6xijeo_m/source/main
 *
 * 对象: TRFN 0BE9X06HU3MN3FB1TO6MNLEGQI6XIJEO
 *       (ADSO ZL_FID37 激活影响分析置为 inactive 的下游 TRFN)
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

describe("TRFN 例程类读取 (结束例程)", () => {
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

  test("getTransformation() - 读 TRFN + 解析例程设置", async () => {
    const raw = await client.getTransformation(TEST_TRFN, "m", {
      forceCacheUpdate: true
    })

    const settings = parseTransformationSettings(raw)
    const className = extractAbapClassName(raw)

    console.log(`\n=== TRFN ${TEST_TRFN} ===`)
    console.log(`name: ${settings?.name}`)
    console.log(`description: ${settings?.description}`)
    console.log(`hanaRuntime: ${settings?.hanaRuntime}`)
    console.log(`hasStartRoutine: ${settings?.hasStartRoutine}`)
    console.log(`hasEndRoutine: ${settings?.hasEndRoutine}`)
    console.log(`hasExpertRoutine: ${settings?.hasExpertRoutine}`)
    console.log(`routineClassName: ${settings?.routineClassName}`)
    console.log(`routineMethodName: ${settings?.routineMethodName}`)
    console.log(`extractAbapClassName: ${className}`)
    console.log(`========================\n`)

    expect(settings).toBeDefined()
    expect(className).toBe(EXPECTED_CLASS)
  }, 60000)

  test("getTransformationClass() - ABAP 类元数据", async () => {
    const meta = await client.getTransformationClass(TEST_TRFN, {
      forceCacheUpdate: true
    })

    console.log(`\n=== Class Metadata ===`)
    console.log(`name: ${meta.name}`)
    console.log(`description: ${meta.description}`)
    console.log(`version: ${meta.version}`)
    console.log(`package: ${meta.package}`)
    console.log(`changedBy: ${meta.changedBy}`)
    console.log(`changedAt: ${meta.changedAt}`)
    console.log(`includes: ${meta.includes?.length ?? 0}`)
    console.log(`======================\n`)

    expect(meta.name).toBe(EXPECTED_CLASS)
    expect(meta.version).toBe("active")
    expect(meta.includes?.length).toBeGreaterThan(0)
  }, 60000)

  test("getTransformationClassSource() - ABAP 类源码 (含结束例程)", async () => {
    const src = await client.getTransformationClassSource(TEST_TRFN, {
      forceCacheUpdate: true
    })

    console.log(`\n=== Class Source ===`)
    console.log(`className: ${src.className}`)
    console.log(`source length: ${src.sourceCode?.length}`)
    console.log(`etag: ${src.etag || "(none)"}`)
    console.log(`--- source preview (first 800 chars) ---`)
    console.log(src.sourceCode?.slice(0, 800))
    console.log(`--- ... ---`)

    const hasGlobalEnd = /GLOBAL_END/i.test(src.sourceCode || "")
    const hasGlobalStart = /GLOBAL_START/i.test(src.sourceCode || "")
    console.log(`has GLOBAL_END: ${hasGlobalEnd}`)
    console.log(`has GLOBAL_START: ${hasGlobalStart}`)
    console.log(`====================\n`)

    expect(src.className).toBe(EXPECTED_CLASS)
    expect(src.sourceCode).toBeTruthy()
    expect(src.sourceCode.length).toBeGreaterThan(100)
    expect(src.sourceCode).toMatch(/class\s+\/BIC\//i)
    expect(hasGlobalEnd).toBe(true)
  }, 60000)

  test("getTransformationVersions() - 版本历史", async () => {
    const versions = await client.getTransformationVersions(TEST_TRFN)

    console.log(`\n=== Versions (${versions.length}) ===`)
    versions.slice(0, 5).forEach((v, i) => {
      console.log(`  [${i}] ${v.version} ${v.uri} ${v.user || ""} ${v.created || ""}`)
    })
    console.log(`========================\n`)

    expect(versions.length).toBeGreaterThan(0)
  }, 30000)
})
