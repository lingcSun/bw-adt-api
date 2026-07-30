import { BWAdtClient } from "../BWAdtClient"
import { addADSOFieldToXml, removeADSOFieldFromXml } from "../api/adso"

/**
 * ADSO 写操作验证 - 对照 Eclipse "打开ADSO→加field→新建TR→保存→激活"
 *
 * 完整序列 (ZL_FID37 Communication Log 19:21):
 *   POST /adso/{id}?action=lock                         [stateful]
 *   POST /cts/transportchecks                           [stateless]
 *   POST /cts/transports                                [ModalContext]
 *   PUT  /adso/{id}/m?corrNr=...&lockHandle=...         [stateless]
 *   POST /activation                                    [stateless]
 *   POST /adso/{id}?action=unlock                       [stateful]
 *
 * 安全策略:
 *   1) 原样写回测试不改内容
 *   2) 加字段测试用临时字段 ZADT_TMP_F, finally 中移除
 */

const testConfig = {
  baseUrl: process.env.BW_BASE_URL!,
  username: process.env.BW_USERNAME!,
  password: process.env.BW_PASSWORD!,
  client: process.env.BW_CLIENT!,
  language: process.env.BW_LANGUAGE!
}

const TEST_ADSO = "ZL_FID37"
const ADSO_URI = `/sap/bw/modeling/adso/${TEST_ADSO.toLowerCase()}/m`
const TMP_FIELD = "ZADT_TMP_F"

describe("ADSO 写操作流程", () => {
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

  test("lockADSO() - 锁定 ADSO", async () => {
    const lockResult = await client.lockADSO(TEST_ADSO)

    console.log(`\n=== Lock ${TEST_ADSO} ===`)
    console.log(`lockHandle: ${lockResult.lockHandle}`)
    console.log(`corrNr: ${lockResult.corrNr || "(none)"}`)
    console.log(`=================\n`)

    expect(lockResult.lockHandle).toBeDefined()
    expect(lockResult.lockHandle).not.toBe("")

    await client.unlockADSO(TEST_ADSO)
  }, 30000)

  test("transportCheck() - 检查 ADSO 是否需要传输请求", async () => {
    const info = await client.transportCheck(ADSO_URI)

    console.log(`\n=== Transport Check: ${TEST_ADSO} ===`)
    console.log(`RECORDING: ${info.RECORDING}`)
    console.log(`Available TRANSPORTS: ${info.TRANSPORTS.length}`)
    console.log(`=================================\n`)

    expect(info).toBeDefined()
    expect(info.RECORDING).toBeDefined()
  }, 30000)

  test("saveAndActivateADSO() - 读回原样写回 (不修改内容)", async () => {
    try { await client.unlockADSO(TEST_ADSO) } catch { /* ignore */ }

    const originalXml = await client.getADSOXml(TEST_ADSO, true)
    expect(originalXml).toContain("adso:dataStore")
    expect(originalXml).toContain(`name="${TEST_ADSO}"`)

    console.log(`\n=== Save & Activate (原样写回) ${TEST_ADSO} ===`)
    console.log(`XML length: ${originalXml.length}`)

    const result = await client.saveAndActivateADSO(TEST_ADSO, originalXml, {
      createTransport: true,
      transportDescription: "API ADSO round-trip verify"
    })

    console.log(`lockHandle: ${result.lockHandle}`)
    console.log(`transport: ${result.transport || "(none)"}`)
    console.log(`activated: ${result.activated}`)
    console.log(`update success: ${result.updateResult?.success}`)
    if (result.activateResult) {
      console.log(`activate success: ${result.activateResult.success}`)
      result.activateResult.messages?.slice(0, 5).forEach((m, i) => {
        console.log(`  [${i}] ${m.messageType}: ${m.title}`)
      })
    }
    console.log(`==========================================\n`)

    expect(result.lockHandle).toBeTruthy()
    expect(result.updateResult?.success).toBe(true)
    if (result.activated) {
      expect(result.activateResult?.success).toBe(true)
    }
  }, 180000)

  test("addADSOField + cleanup - 临时 field 字段增删", async () => {
    try { await client.unlockADSO(TEST_ADSO) } catch { /* ignore */ }

    let xml = await client.getADSOXml(TEST_ADSO, true)

    // 若上次残留, 先清掉
    if (xml.includes(`name="${TMP_FIELD}"`)) {
      xml = removeADSOFieldFromXml(xml, TMP_FIELD)
      await client.saveAndActivateADSO(TEST_ADSO, xml, {
        createTransport: true,
        transportDescription: "API cleanup residual ZADT_TMP_F"
      })
      xml = await client.getADSOXml(TEST_ADSO, true)
    }

    const withField = addADSOFieldToXml(xml, {
      name: TMP_FIELD,
      dataType: "CHAR",
      length: 10,
      label: "ADT API 临时字段"
    })

    console.log(`\n=== Add field ${TMP_FIELD} to ${TEST_ADSO} ===`)
    const addResult = await client.saveAndActivateADSO(TEST_ADSO, withField, {
      createTransport: true,
      transportDescription: `API add field ${TMP_FIELD}`
    })
    console.log(`add transport: ${addResult.transport || "(none)"}`)
    console.log(`add update: ${addResult.updateResult?.success}`)
    console.log(`add activate: ${addResult.activateResult?.success}`)

    expect(addResult.updateResult?.success).toBe(true)
    expect(addResult.activateResult?.success).toBe(true)

    const afterAdd = await client.getADSOXml(TEST_ADSO, true)
    expect(afterAdd).toContain(`name="${TMP_FIELD}"`)
    expect(afterAdd).toContain('sidDeterminationMode="N"')

    // 清理: 移除临时字段
    const cleaned = removeADSOFieldFromXml(afterAdd, TMP_FIELD)
    const removeResult = await client.saveAndActivateADSO(TEST_ADSO, cleaned, {
      createTransport: true,
      transportDescription: `API remove field ${TMP_FIELD}`
    })
    console.log(`remove update: ${removeResult.updateResult?.success}`)
    console.log(`remove activate: ${removeResult.activateResult?.success}`)
    console.log(`========================================\n`)

    expect(removeResult.updateResult?.success).toBe(true)
    expect(removeResult.activateResult?.success).toBe(true)

    const afterRemove = await client.getADSOXml(TEST_ADSO, true)
    expect(afterRemove).not.toContain(`name="${TMP_FIELD}"`)
  }, 300000)
})
