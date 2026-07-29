import { BWAdtClient } from "../BWAdtClient"

/**
 * ADSO 关联对象查询验证 - 对照 Eclipse 展开 ZL_FID40 的 Communication Log
 *
 * 日志中的 UI 导航请求（本项目不实现，用搜索替代）:
 *   14:50:21  GET /repo/infoproviderstructure/adso/zl_fid40       ← 树形文件夹（转换/数据传输流程）
 *   14:50:23  GET /repo/infoproviderstructure/adso/zl_fid40/trfn  ← 3 个 TRFN
 *   14:50:27  GET /repo/infoproviderstructure/adso/zl_fid40/dtpa  ← 3 个 DTPA
 *
 * 期望（与专用端点实测一致）:
 *   TRFN (3): 005J3S8O... 0884UVM7... 0H519LNP...
 *   DTPA (3): DTP_ET0916...SVTQ8UG  DTP_ET0916...P1BKTB6DJP  DTP_ET0916...V7PKTO41PA
 */

const testConfig = {
  baseUrl: process.env.BW_BASE_URL!,
  username: process.env.BW_USERNAME!,
  password: process.env.BW_PASSWORD!,
  client: process.env.BW_CLIENT!,
  language: process.env.BW_LANGUAGE!
}

const TEST_ADSO = "ZL_FID40"

describe("ADSO 关联对象查询 (搜索封装)", () => {
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

  test("getADSOTransformations() - 替代 infoproviderstructure/.../trfn", async () => {
    const trfns = await client.getADSOTransformations(TEST_ADSO)

    console.log(`\n========== Transformations of ${TEST_ADSO} ==========`)
    console.log(`Found ${trfns.length} TRFN(s):`)
    trfns.forEach((t, i) => {
      console.log(`  [${i + 1}] ${t.technicalObjectName}`)
      console.log(`      ${t.title}`)
      console.log(`      Status: ${t.objectStatus}/${t.objectVersion}  URI: ${t.uri}`)
    })
    console.log(`=================================================\n`)

    // 与专用端点实测一致: 3 个 TRFN
    expect(trfns.length).toBe(3)
    expect(trfns.every(t => t.objectType === "TRFN")).toBe(true)
  }, 30000)

  test("getADSODataTransferProcesses() - 替代 infoproviderstructure/.../dtpa", async () => {
    const dtps = await client.getADSODataTransferProcesses(TEST_ADSO)

    console.log(`\n========== DTPs of ${TEST_ADSO} ==========`)
    console.log(`Found ${dtps.length} DTP(s):`)
    dtps.forEach((d, i) => {
      console.log(`  [${i + 1}] ${d.technicalObjectName}`)
      console.log(`      ${d.title}`)
      console.log(`      Status: ${d.objectStatus}/${d.objectVersion}  URI: ${d.uri}`)
    })
    console.log(`==========================================\n`)

    // 与专用端点实测一致: 3 个 DTPA
    expect(dtps.length).toBe(3)
    expect(dtps.every(d => d.objectType === "DTPA")).toBe(true)
  }, 30000)
})
