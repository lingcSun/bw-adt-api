import { BWAdtClient } from "../BWAdtClient"

/**
 * DMOD 数据流接口验证 - 对照 Eclipse 数据流图抓包
 *
 * 日志请求: GET /sap/bw/modeling/dmod/8TRANSIENT?objecttype=ADSO&objectname=ZL_FID40&leveldownwards=-1
 * 返回 16.6KB,40 个节点,完整血缘链
 */

const testConfig = {
  baseUrl: process.env.BW_BASE_URL!,
  username: process.env.BW_USERNAME!,
  password: process.env.BW_PASSWORD!,
  client: process.env.BW_CLIENT!,
  language: process.env.BW_LANGUAGE!
}

const TARGET = "ZL_FID40"

describe("DMOD 数据流接口", () => {
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

  test("getDataflow(upstream) - 获取 ZL_FID40 的上游来源链", async () => {
    const model = await client.getDataflow(TARGET, "ADSO", { direction: "upstream" })

    console.log(`\n========== Dataflow upstream: ${TARGET} ==========`)
    console.log(`Nodes: ${model.nodes.length}, Relations: ${model.relations.length}`)
    console.log(`\nAll nodes:`)
    model.nodes.forEach(n => {
      console.log(`  [${n.nodeId}] ${n.objectType} ${n.objectName}  "${n.objectDescription || ""}"`)
    })
    console.log(`=================================================\n`)

    // upstream(leveldownwards=-1)返回 40 个节点
    expect(model.nodes.length).toBe(40)
    expect(model.relations.length).toBeGreaterThan(0)

    // 根节点应该是 ZL_FID40
    const root = model.nodes[0]
    expect(root.objectName).toBe(TARGET)
    expect(root.objectType).toBe("ADSO")
  }, 60000)

  test("getDataflow(downstream) - ZL_FID01 的下游应含 ZL_FID40", async () => {
    // ZL_FID01 的数据流向 ZL_FID40,故 downstream 应包含 ZL_FID40
    const model = await client.getDataflow("ZL_FID01", "ADSO", { direction: "downstream" })

    console.log(`\n========== Dataflow downstream: ZL_FID01 ==========`)
    console.log(`Nodes: ${model.nodes.length}`)
    model.nodes.forEach(n => {
      console.log(`  ${n.objectType} ${n.objectName}  "${n.objectDescription || ""}"`)
    })
    console.log(`=================================================\n`)

    // ZL_FID40 是 ZL_FID01 的下游目标,必须出现
    const fid40 = model.nodes.find(n => n.objectName === "ZL_FID40")
    expect(fid40).toBeDefined()
    expect(fid40!.objectType).toBe("ADSO")
  }, 60000)

  test("getDataflow(upstream) - 解析的 relations 含 source/target", async () => {
    const model = await client.getDataflow(TARGET, "ADSO", { direction: "upstream" })

    console.log(`\n========== Parsed Relations (${model.relations.length}) ==========`)
    model.relations.forEach(r => {
      console.log(`  ${r.type} ${r.name}`)
      console.log(`    ${r.sourceType} ${r.sourceName} -> ${r.targetType} ${r.targetName}  (${r.status})`)
    })
    console.log(`=================================================\n`)

    // 所有关系都应该有 source 和 target
    for (const r of model.relations) {
      expect(r.sourceName).toBeTruthy()
      expect(r.targetName).toBeTruthy()
      expect(r.type === "TRFN" || r.type === "DTPA").toBe(true)
    }
  }, 60000)

  test("getDataflowLineage() - 查 ZL_FID01 -> ZL_FID40 的转换和 DTP", async () => {
    const relations = await client.getDataflowLineage(TARGET, "ZL_FID01")

    console.log(`\n========== Lineage: ZL_FID01 -> ${TARGET} ==========`)
    console.log(`Found ${relations.length} relation(s):`)
    relations.forEach(r => {
      console.log(`  ${r.type}  ${r.name}`)
      console.log(`    "${r.description}"  (status: ${r.status})`)
    })
    console.log(`=================================================\n`)

    // 期望: 1 个 TRFN + 1 个 DTPA
    expect(relations.length).toBe(2)

    const trfn = relations.filter(r => r.type === "TRFN")
    const dtpa = relations.filter(r => r.type === "DTPA")
    expect(trfn.length).toBe(1)
    expect(dtpa.length).toBe(1)

    // 验证 TRFN 的具体值
    expect(trfn[0].name).toBe("0H519LNPR8FQY94PC60F48MJH87KEUT3")
    expect(trfn[0].sourceName).toBe("ZL_FID01")
    expect(trfn[0].targetName).toBe("ZL_FID40")

    // 验证 DTPA 的具体值
    expect(dtpa[0].name).toBe("DTP_ET0916OM0DNHSHAP1BKTB6DJP")
    expect(dtpa[0].sourceName).toBe("ZL_FID01")
    expect(dtpa[0].targetName).toBe("ZL_FID40")
  }, 60000)
})
