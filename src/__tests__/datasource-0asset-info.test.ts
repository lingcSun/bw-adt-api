import { BWAdtClient } from "../BWAdtClient"
import { xmlNodeAttr, xmlNode, xmlArray } from "../utilities"
import { parseDataSourceDetails, parseDataSourceFields } from "../api/datasource"

/**
 * 获取数据源 0ASSET_ATTR_TEXT 的完整信息: Overview / Extraction / Fields
 *
 * XML 结构 (GET /sap/bw/modeling/rsds/{ds}/{src}/m):
 *   <rsds:dataSource ...>              ← Overview (根属性)
 *     <description .../>               ← Overview (描述)
 *     <deltaProperties .../>           ← Overview (增量属性)
 *     <contentInfo .../>               ← Overview (内容版本)
 *     <technicalHeaderInfo ...>        ← Extraction (生成程序/结构表)
 *     <segment>                        ← Fields (字段段)
 *       <field>...</field>
 *     </segment>
 *     <adapter name="ODP" ...>         ← Extraction (ODP 适配器 + segmentMapping)
 *       <segmentMapping>
 *         <fieldMapping .../>
 *       </segmentMapping>
 *     </adapter>
 *     <tlogoProperties .../>           ← Overview (对象状态/版本)
 *   </rsds:dataSource>
 */

const testConfig = {
  baseUrl: process.env.BW_BASE_URL!,
  username: process.env.BW_USERNAME!,
  password: process.env.BW_PASSWORD!,
  client: process.env.BW_CLIENT!,
  language: process.env.BW_LANGUAGE!
}

const DATASOURCE = "0ASSET_ATTR_TEXT"
const SOURCE_SYSTEM = "S4DCLNT300"

describe(`数据源信息: ${DATASOURCE} (Overview / Extraction / Fields)`, () => {
  let client: BWAdtClient
  let raw: any

  beforeAll(async () => {
    client = new BWAdtClient(
      testConfig.baseUrl, testConfig.username, testConfig.password,
      testConfig.client, testConfig.language
    )
    await client.login()
    // forceCacheUpdate=true 确保拿到最新元数据
    raw = await client.getDataSource(DATASOURCE, SOURCE_SYSTEM, true)
  }, 30000)

  afterAll(async () => {
    if (client.loggedin) await client.logout()
  })

  // ==========================================================================
  // Overview — 概览信息 (根属性 + 描述 + 增量 + 对象状态)
  // ==========================================================================
  describe("① Overview 概览", () => {
    test("基础元数据 (getDataSourceDetails)", async () => {
      const details = await client.getDataSourceDetails(DATASOURCE, SOURCE_SYSTEM, true)

      console.log("\n========== Overview 概览 ==========")
      console.log(`名称:         ${details.name}`)
      console.log(`描述:         ${details.description}`)
      console.log(`类型:         ${details.type} (M=主数据属性/文本混合)`)
      console.log(`应用组件:     ${details.applicationComponent}`)
      console.log(`源系统:       ${details.sourceSystem}`)
      console.log(`适配器:       ${details.adapterType}`)
      console.log(`对象版本:     ${details.objectVersion} (M=Active)`)
      console.log(`对象状态:     ${details.objectStatus}`)
      console.log("===================================\n")

      expect(details.name).toBe(DATASOURCE)
      expect(details.sourceSystem).toBe(SOURCE_SYSTEM)
      expect(details.adapterType).toBe("ODP")
      expect(details.applicationComponent).toBe("FI-AA-IO")
      expect(details.objectStatus).toBe("active")
    }, 30000)

    test("根节点扩展属性 (直接访问 raw 对象)", () => {
      const root = raw["rsds:dataSource"]
      const attrs = xmlNodeAttr(root)

      console.log("\n========== 根属性 ==========")
      console.log(`hybridAccess:     ${attrs.hybridAccess}`)
      console.log(`directAccess:     ${attrs.directAccess}`)
      console.log(`openingBalance:   ${attrs.openingBalance}`)
      console.log(`dataReconciliation:${attrs.dataReconciliation}`)
      console.log(`psaInCharFormat:  ${attrs.psaInCharFormat}`)
      console.log("===========================\n")

      expect(attrs.name).toBe(DATASOURCE)
      expect(attrs.type).toBe("M")  // 此 DS 类型为 M
    })
  })

  // ==========================================================================
  // Extraction — 抽取信息 (增量属性 + 技术头信息 + ODP 适配器)
  // ==========================================================================
  describe("② Extraction 抽取", () => {
    test("增量属性 (deltaProperties)", () => {
      const root = raw["rsds:dataSource"]
      const delta = xmlNodeAttr(xmlNode(root, "deltaProperties"))

      console.log("\n========== 增量属性 deltaProperties ==========")
      console.log(`增量模式 delta:        ${delta.delta} (AIE=新增/修改/删除)`)
      console.log(`realTime:              ${delta.realTime}`)
      console.log(`initWithoutData:       ${delta.initWithoutData}`)
      console.log(`zeroDowntime:          ${delta.zeroDowntime}`)
      console.log("=============================================\n")

      expect(delta.delta).toBe("AIE")  // 标准资产 DS 支持全量+增量
    })

    test("技术头信息 (technicalHeaderInfo) - 生成程序/结构表", () => {
      const root = raw["rsds:dataSource"]
      const tech = xmlNodeAttr(xmlNode(root, "technicalHeaderInfo"))

      console.log("\n========== 技术头信息 technicalHeaderInfo ==========")
      console.log(`应用结构 applicationStructure: ${tech.applicationStructure}`)
      console.log(`字符结构 characterStructure:   ${tech.characterStructure}`)
      console.log(`生成程序 generatedProgram:     ${tech.generatedProgram}`)
      console.log(`主段ID primarySegmentID:       ${tech.primarySegmentID}`)
      console.log("===================================================\n")

      expect(tech.applicationStructure).toMatch(/^\/BI0\//)
      expect(tech.generatedProgram).toMatch(/^GP/)
    })

    test("ODP 适配器 (adapter) - 含 externalObject 与 delta", () => {
      const root = raw["rsds:dataSource"]
      const adapter = xmlNodeAttr(xmlNode(root, "adapter"))

      console.log("\n========== ODP 适配器 adapter ==========")
      console.log(`适配器名 name:           ${adapter.name}`)
      console.log(`类型 xsi:type:           ${adapter["xsi:type"]}`)
      console.log(`externalObject:          ${adapter.externalObject}`)
      console.log(`displayName:             ${adapter.displayName}`)
      console.log(`delta:                   ${adapter.delta}`)
      console.log(`semantics:               ${adapter.semantics} (P=主数据)`)
      console.log(`contextDescription:      ${adapter.contextDescription}`)
      console.log(`currentlyUsed:           ${adapter.currentlyUsed}`)
      console.log("========================================\n")

      expect(adapter.name).toBe("ODP")
      expect(adapter.externalObject).toBe(DATASOURCE)
      expect(adapter["xsi:type"]).toBe("rsds:ExtractorODP")
    })

    test("字段映射 (segmentMapping) - DS 字段 → 外部字段", () => {
      const root = raw["rsds:dataSource"]
      const mappings = xmlArray(root, "adapter", "segmentMapping", "fieldMapping")

      console.log(`\n========== 字段映射 segmentMapping: ${mappings.length} 个 ==========`)
      mappings.slice(0, 5).forEach((m: any, i: number) => {
        const a = xmlNodeAttr(m)
        const dsField = (a.datasourceField || "").split("/").pop()
        console.log(`  [${i + 1}] ${dsField} ← ${a.externalField}  (${a.type}${a.length ? "/" + a.length : ""})  transfer=${a.transfer}  "${a.description}"`)
      })
      console.log(`  ... (共 ${mappings.length} 个映射, 含 ODQ_CHANGEMODE/ODQ_ENTITYCNTR 增量技术字段)`)
      console.log("".padEnd(60, "=") + "\n")

      expect(mappings.length).toBeGreaterThan(0)
      // 第一个映射应是公司代码 BUKRS
      const first = xmlNodeAttr(mappings[0])
      expect(first.externalField).toBe("BUKRS")
    })
  })

  // ==========================================================================
  // Fields — 字段列表 (segment/field)
  // ==========================================================================
  describe("③ Fields 字段列表", () => {
    test("字段解析 (getDataSourceFields)", async () => {
      const fields = await client.getDataSourceFields(DATASOURCE, SOURCE_SYSTEM, true)

      const transferred = fields.filter(f => f.transfer)

      console.log(`\n========== Fields 字段: 共 ${fields.length} 个, 传输 ${transferred.length} 个 ==========`)
      console.log("序号  字段名        类型      长度   传输  描述")
      console.log("-".repeat(70))
      fields.slice(0, 15).forEach((f, i) => {
        console.log(
          `${String(i + 1).padStart(3)}   ${f.name.padEnd(12)} ` +
          `${(f.dataType || "").padEnd(8)} ${String(f.length ?? "").padStart(5)}   ` +
          `${f.transfer ? "✓" : "✗"}     ${f.label || ""}`
        )
      })
      console.log(`  ... (共 ${fields.length} 个字段)`)
      console.log("".padEnd(70, "=") + "\n")

      expect(Array.isArray(fields)).toBe(true)
      expect(fields.length).toBeGreaterThan(0)

      // 资产核心字段校验
      const bukrs = fields.find(f => f.name === "BUKRS")
      expect(bukrs).toBeDefined()
      expect(bukrs!.dataType).toBe("CHAR")
      expect(bukrs!.transfer).toBe(true)

      const anln1 = fields.find(f => f.name === "ANLN1")
      expect(anln1).toBeDefined()
      expect(anln1!.dataType).toBe("CHAR")
    }, 30000)
  })
})
