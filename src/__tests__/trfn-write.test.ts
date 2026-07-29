import { BWAdtClient } from "../BWAdtClient"
import {
  addFieldToEndRoutine,
  removeFieldFromEndRoutine,
  isEndRoutineFieldSelected
} from "../api/transformation"

/**
 * TRFN 写操作 / 结束例程 setFields 验证
 * 对照 Eclipse Communication Log 20:00:
 *   lock → transportchecks → PUT .../m?lockHandle=... + Transport-Lock-Holder
 *   → (随后进入 ABAP 例程编辑, 本测试不覆盖源码写入)
 *
 * 对象: 0BE9X06HU3MN3FB1TO6MNLEGQI6XIJEO
 * 字段: ZC_JTL4 (ADSO ZL_FID37 已添加的 field 类型字段)
 */

const testConfig = {
  baseUrl: process.env.BW_BASE_URL!,
  username: process.env.BW_USERNAME!,
  password: process.env.BW_PASSWORD!,
  client: process.env.BW_CLIENT!,
  language: process.env.BW_LANGUAGE!
}

const TEST_TRFN = "0BE9X06HU3MN3FB1TO6MNLEGQI6XIJEO"
const TEST_FIELD = "ZC_JTL4"

describe("TRFN 写操作 / 结束例程 setFields", () => {
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

  test("读回确认 ZC_JTL4 在 target + END setFields (Eclipse 已保存)", async () => {
    const xml = await client.getTransformationXml(TEST_TRFN, "m", {
      forceCacheUpdate: true
    })

    console.log(`\n=== TRFN ${TEST_TRFN} ===`)
    console.log(`XML length: ${xml.length}`)
    console.log(`target has ${TEST_FIELD}: ${xml.includes(`name="${TEST_FIELD}"`)}`)
    console.log(
      `end routine selected: ${isEndRoutineFieldSelected(xml, TEST_FIELD)}`
    )
    console.log(`========================\n`)

    expect(xml).toContain(`name="${TEST_FIELD}"`)
    expect(isEndRoutineFieldSelected(xml, TEST_FIELD)).toBe(true)
  }, 60000)

  test("saveAndActivateTransformation() - 原样写回", async () => {
    try {
      await client.unlockTransformation(TEST_TRFN)
    } catch {
      /* ignore */
    }

    const xml = await client.getTransformationXml(TEST_TRFN, "m", {
      forceCacheUpdate: true
    })

    const result = await client.saveAndActivateTransformation(TEST_TRFN, xml, {
      transportDescription: "API TRFN round-trip"
    })

    console.log(`\n=== Round-trip ===`)
    console.log(`transport: ${result.transport}`)
    console.log(`update: ${result.updateResult?.success}`)
    console.log(`activate: ${result.activateResult?.success}`)
    result.activateResult?.messages?.slice(0, 4).forEach((m, i) => {
      console.log(`  [${i}] ${m.messageType}: ${m.title}`)
    })
    console.log(`==================\n`)

    expect(result.updateResult?.success).toBe(true)
    expect(result.activateResult?.success).toBe(true)
  }, 180000)

  test("setEndRoutineFields 路径: 取消(仅PUT) → 再勾选并激活", async () => {
    // 说明: 单独取消勾选后马上激活, 会因结束例程 ABAP 签名未同步报
    // 「结束程序: 例程中的语法错误」。Eclipse setFields 勾选→保存→激活是正向路径;
    // 取消后需再勾选并一次激活, 或配合例程源码刷新。本测试验证正向 setFields。
    try {
      await client.unlockTransformation(TEST_TRFN)
    } catch {
      /* ignore */
    }

    const xml = await client.getTransformationXml(TEST_TRFN, "m", {
      forceCacheUpdate: true
    })
    expect(isEndRoutineFieldSelected(xml, TEST_FIELD)).toBe(true)

    // 1) 取消勾选仅保存不激活 (为下一步腾出「未勾选」状态)
    const without = removeFieldFromEndRoutine(xml, TEST_FIELD)
    expect(isEndRoutineFieldSelected(without, TEST_FIELD)).toBe(false)
    expect(without).not.toContain(`#///target/segment1/${TEST_FIELD}`)

    const removeResult = await client.saveAndActivateTransformation(
      TEST_TRFN,
      without,
      {
        transportDescription: `API unset end field ${TEST_FIELD} (no activate)`,
        autoActivate: false
      }
    )
    console.log(`\n=== Unset ${TEST_FIELD} (PUT only) ===`)
    console.log(`update: ${removeResult.updateResult?.success}`)
    expect(removeResult.updateResult?.success).toBe(true)

    const afterUnset = await client.getTransformationXml(TEST_TRFN, "m", {
      forceCacheUpdate: true
    })
    expect(isEndRoutineFieldSelected(afterUnset, TEST_FIELD)).toBe(false)

    // 2) setEndRoutineFields 勾选并激活
    const addResult = await client.setEndRoutineFields(TEST_TRFN, [TEST_FIELD], {
      transportDescription: `API set end field ${TEST_FIELD}`
    })
    console.log(`=== Set ${TEST_FIELD} ===`)
    console.log(`update: ${addResult.updateResult?.success}`)
    console.log(`activate: ${addResult.activateResult?.success}`)
    addResult.activateResult?.messages?.forEach((m, i) => {
      console.log(`  [${i}] ${m.messageType}: ${m.title}`)
    })
    console.log(`========================\n`)

    expect(addResult.updateResult?.success).toBe(true)
    expect(addResult.activateResult?.success).toBe(true)

    const afterSet = await client.getTransformationXml(TEST_TRFN, "m", {
      forceCacheUpdate: true
    })
    expect(isEndRoutineFieldSelected(afterSet, TEST_FIELD)).toBe(true)
  }, 300000)
})
