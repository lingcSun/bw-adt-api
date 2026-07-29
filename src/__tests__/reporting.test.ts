import {
  toReportingCompId,
  buildQuerySelectorXml,
  remapReportingState,
  parseQueryView,
  flattenReportingResultSet
} from "../api/reporting"
import { BWAdtClient } from "../BWAdtClient"
import * as dotenv from "dotenv"

dotenv.config()

const INITIAL_VIEW_XML = `<?xml version="1.0" encoding="utf-8"?>
<queryView version="4" name="!ZC_ASSET" txt="资产子编码" dataRollup="2026-07-17T09:01:13Z" isTransient="false">
  <metaData infoProvider="ZC_ASSET" hasVariables="false" infoProviderText="资产子编码">
    <keyFigures>
      <entry name="0QUANTITY" txt="数量" id="0" aggrMode="SUM" iobjType="KYF" dataType="QUAN"/>
      <entry name="1ROWCOUNT" txt="记录数" id="0" aggrMode="SUM" iobjType="KYF" dataType="DEC"/>
    </keyFigures>
    <characteristics>
      <entry name="0COMP_CODE" txt="公司代码" id="6199" basName="0COMP_CODE" axis="FREE" pos="1" isStructure="false" iobjType="CHA" dataType="CHAR"/>
      <entry name="0PROFIT_CTR" txt="利润中心" id="6542" basName="0PROFIT_CTR" axis="FREE" pos="1" isStructure="false" iobjType="CHA" dataType="CHAR"/>
      <entry name="ZC_ASSET" txt="资产子编码" id="23704" basName="ZC_ASSET" axis="FREE" pos="1" isStructure="false" iobjType="CHA" dataType="CHAR"/>
      <entry name="0MEASURES0000000000000009" txt="关键指标" id="2000000908" axis="COLUMNS" pos="1" isStructure="true"/>
    </characteristics>
    <variables/>
  </metaData>
  <selection>
    <kyfStructure name="0MEASURES0000000000000009" id="2000000908" size="2">
      <keyFigure name="0QUANTITY0000000000000009" altName="0QUANTITY" txt="数量" id="1" basedOn="0QUANTITY"/>
      <keyFigure name="1ROWCOUNT0000000000000009" altName="1ROWCOUNT" txt="记录数" id="2" basedOn="1ROWCOUNT"/>
    </kyfStructure>
    <state>
      <infoObject id="6199" name="0COMP_CODE" axis="FREE" pos="1"/>
      <infoObject id="6542" name="0PROFIT_CTR" axis="FREE" pos="1"/>
      <infoObject id="23704" name="ZC_ASSET" axis="FREE" pos="1"/>
      <infoObject id="2000000908" name="0MEASURES0000000000000009" axis="COLUMNS" pos="1"/>
    </state>
    <space/><effective/>
  </selection>
  <resultSet suppressRepeatedKeyValues="false" isPlanningQuery="false" startInEditMode="false" fromRow="0" toRow="1000">
    <columns drillLvl="0">
      <headers>
        <entry name="0MEASURES0000000000000009" txt="关键指标" id="2000000908" hasAttributes="false" isStructure="true" hasKeyfigures="true" pos="1"/>
      </headers>
      <tuples size="2">
        <tuple tid="-1"><value id="2000000908" sid="1" selType="STRU1" extKey="0QUANTITY" intKey="0QUANTITY0000000000000009" txt="数量"/></tuple>
        <tuple tid="-1"><value id="2000000908" sid="2" selType="STRU1" extKey="1ROWCOUNT" intKey="1ROWCOUNT0000000000000009" txt="记录数"/></tuple>
      </tuples>
    </columns>
    <rows drillLvl="0"><headers/><tuples size="1"><tuple tid="-1"/></tuples></rows>
    <data size="2">
      <cell crv="1069" txt="*" sid="1" row="1" col="1" mcu="true"/>
      <cell crv="18221" txt="18,221" sid="2" row="1" col="2"/>
    </data>
  </resultSet>
  <messages>
    <entry type="W" txt="SAP HANA/BWA 中的操作，未使用高精度计算"/>
  </messages>
</queryView>`

const UPDATED_VIEW_XML = `<?xml version="1.0" encoding="utf-8"?>
<queryView version="4" name="!ZL_FID09" txt="基本费用" dataRollup="2023-10-07T13:50:04Z" isTransient="false">
  <selection>
    <kyfStructure name="0MEASURES0000000000000009" id="2000000908" size="2">
      <keyFigure name="1ROWCOUNT0000000000000009" altName="1ROWCOUNT" txt="记录数" id="1" basedOn="1ROWCOUNT"/>
      <keyFigure name="ZK9HSL0000000000000000006" altName="ZK_HSL" txt="以公司代码货币计金额" id="6" basedOn="ZK_HSL"/>
    </kyfStructure>
    <state>
      <infoObject id="6542" name="0PROFIT_CTR" axis="ROWS" pos="1"/>
      <infoObject id="6199" name="0COMP_CODE" axis="ROWS" pos="2"/>
      <infoObject id="2000000908" name="0MEASURES0000000000000009" axis="COLUMNS" pos="1"/>
    </state>
    <space/><effective/>
  </selection>
  <resultSet suppressRepeatedKeyValues="false" isPlanningQuery="false" startInEditMode="false" fromRow="0" toRow="1000">
    <columns drillLvl="0">
      <headers>
        <entry name="0MEASURES0000000000000009" txt="关键指标" id="2000000908" hasAttributes="false" isStructure="true" hasKeyfigures="true" pos="1"/>
      </headers>
      <tuples size="2">
        <tuple tid="-1"><value id="2000000908" sid="1" selType="STRU1" extKey="1ROWCOUNT" intKey="1ROWCOUNT0000000000000009" txt="记录数"/></tuple>
        <tuple tid="-1"><value id="2000000908" sid="6" selType="STRU1" extKey="ZK_HSL" intKey="ZK9HSL0000000000000000006" txt="以公司代码货币计金额"/></tuple>
      </tuples>
    </columns>
    <rows drillLvl="0">
      <headers>
        <entry name="0PROFIT_CTR" txt="利润中心" id="6542" hasAttributes="true" isStructure="false" showValues="true" resultVisibility="CONDITIONAL" pos="1"/>
        <entry name="0COMP_CODE" txt="公司代码" id="6199" hasAttributes="true" isStructure="false" showValues="true" resultVisibility="CONDITIONAL" pos="2"/>
      </headers>
      <tuples size="3">
        <tuple tid="22">
          <value id="6542" sid="44" extKey="GL00/1000000000" intKey="GL001000000000" txt="GL00/1000000000"/>
          <value id="6199" sid="2" extKey="1010" intKey="1010" txt="1010"/>
        </tuple>
        <tuple tid="9">
          <value id="6542" sid="69" extKey="GL00/GL00" intKey="GL00GL00" txt="GL00/GL00"/>
          <value id="6199" sid="2000000599" selType="TOTAL" extKey="SUMME" intKey="SUMME" txt="结果"/>
        </tuple>
        <tuple tid="3">
          <value id="6542" sid="2000000599" selType="TOTAL" extKey="SUMME" intKey="SUMME" txt="总体结果"/>
          <value id="6199" sid="2000000599" selType="TOTAL" extKey="SUMME" intKey="SUMME" txt="结果"/>
        </tuple>
      </tuples>
    </rows>
    <data size="6">
      <cell crv="194" txt="194" sid="1" row="1" col="1"/>
      <cell crv="386982.56" txt="386,982.56 CNY" sid="6" row="1" col="2"/>
      <cell crv="4382" txt="4,382" sid="1" row="2" col="1"/>
      <cell crv="31068472.52" txt="31,068,472.52 CNY" sid="6" row="2" col="2"/>
      <cell crv="6063" txt="6,063" sid="1" row="3" col="1"/>
      <cell crv="427325826.2" txt="*" sid="6" row="3" col="2" mcu="true"/>
    </data>
  </resultSet>
  <messages/>
</queryView>`

describe("Reporting helpers", () => {
  test("toReportingCompId adds ! prefix when missing", () => {
    expect(toReportingCompId("ZL_FID09")).toBe("!ZL_FID09")
    expect(toReportingCompId("!ZC_ASSET")).toBe("!ZC_ASSET")
  })

  test("buildQuerySelectorXml matches ADT body shape", () => {
    const xml = buildQuerySelectorXml("ZL_FID09", [
      { name: "0MEASURES0000000000000009", id: "2000000908", axis: "COLUMNS", pos: 0 },
      { name: "0PROFIT_CTR", id: "6542", axis: "ROWS", pos: 0 },
      { name: "0COMP_CODE", id: "6199", axis: "FREE", pos: 0 }
    ])

    expect(xml).toContain('name="!ZL_FID09"')
    expect(xml).toContain(
      '<infoObject name="0PROFIT_CTR" id="6542" axis="ROWS" pos="0"></infoObject>'
    )
    expect(xml).toContain("<querySelector")
    expect(xml).toContain("<selection><state>")
  })

  test("remapReportingState puts named chars on ROWS and measures on COLUMNS", () => {
    const remapped = remapReportingState(
      [
        { name: "0COMP_CODE", id: "6199", axis: "FREE", pos: 1 },
        { name: "0PROFIT_CTR", id: "6542", axis: "FREE", pos: 1 },
        { name: "ZC_ASSET", id: "23704", axis: "FREE", pos: 1 },
        { name: "0MEASURES0000000000000009", id: "2000000908", axis: "COLUMNS", pos: 1 }
      ],
      { rows: ["0PROFIT_CTR", "0COMP_CODE"] }
    )

    expect(remapped.map(s => s.name)).toEqual([
      "0MEASURES0000000000000009",
      "ZC_ASSET",
      "0PROFIT_CTR",
      "0COMP_CODE"
    ])
    expect(remapped.find(s => s.name === "0PROFIT_CTR")).toMatchObject({
      axis: "ROWS",
      pos: 0
    })
    expect(remapped.find(s => s.name === "0COMP_CODE")).toMatchObject({
      axis: "ROWS",
      pos: 0
    })
    expect(remapped.find(s => s.name === "ZC_ASSET")).toMatchObject({
      axis: "FREE"
    })
    expect(
      remapped.find(s => s.name === "0MEASURES0000000000000009")
    ).toMatchObject({ axis: "COLUMNS" })
  })
})

describe("parseQueryView", () => {
  test("parses GET initial view metadata and default totals", () => {
    const view = parseQueryView(INITIAL_VIEW_XML)

    expect(view.name).toBe("!ZC_ASSET")
    expect(view.txt).toBe("资产子编码")
    expect(view.metaData?.infoProvider).toBe("ZC_ASSET")
    expect(view.metaData?.keyFigures?.map(k => k.name)).toEqual([
      "0QUANTITY",
      "1ROWCOUNT"
    ])
    expect(view.metaData?.characteristics?.length).toBe(4)
    expect(view.kyfStructure?.size).toBe(2)
    expect(view.state?.length).toBe(4)
    expect(view.resultSet?.cells.length).toBe(2)
    expect(view.messages?.[0]).toMatchObject({ type: "W" })
    expect(view.flatRows?.[0]).toMatchObject({
      "0QUANTITY": 1069,
      "1ROWCOUNT": 18221
    })
  })

  test("parses POST updated view with row dimensions and flatRows", () => {
    const view = parseQueryView(UPDATED_VIEW_XML)

    expect(view.name).toBe("!ZL_FID09")
    expect(view.resultSet?.rows.headers.map(h => h.name)).toEqual([
      "0PROFIT_CTR",
      "0COMP_CODE"
    ])
    expect(view.resultSet?.rows.tuples.length).toBe(3)
    expect(view.flatRows?.length).toBe(3)
    expect(view.flatRows?.[0]).toMatchObject({
      "0PROFIT_CTR": "GL00/1000000000",
      "0COMP_CODE": "1010",
      "1ROWCOUNT": 194,
      ZK_HSL: 386982.56
    })
    expect(view.flatRows?.[1]).toMatchObject({
      "0COMP_CODE": "SUMME",
      "0COMP_CODE_SELTYPE": "TOTAL",
      "1ROWCOUNT": 4382
    })
    expect(view.flatRows?.[2]["ZK_HSL_TXT"]).toBe("*")
  })

  test("flattenReportingResultSet returns empty for missing resultSet", () => {
    expect(flattenReportingResultSet(undefined)).toEqual([])
  })
})

describe("Reporting live API", () => {
  const hasEnv = !!(
    process.env.BW_BASE_URL &&
    process.env.BW_USERNAME &&
    process.env.BW_PASSWORD
  )

  const testConfig = {
    baseUrl: process.env.BW_BASE_URL || "",
    username: process.env.BW_USERNAME || "",
    password: process.env.BW_PASSWORD || "",
    client: process.env.BW_CLIENT || "100",
    language: process.env.BW_LANGUAGE || "ZH"
  }

  ;(hasEnv ? test : test.skip)(
    "getReportingInitialView for characteristic ZC_ASSET",
    async () => {
      const client = new BWAdtClient(
        testConfig.baseUrl,
        testConfig.username,
        testConfig.password,
        testConfig.client,
        testConfig.language
      )
      await client.login()

      try {
        const view = await client.getReportingInitialView("ZC_ASSET", {
          toRow: 10
        })
        expect(view.name).toBe("!ZC_ASSET")
        expect(view.metaData?.characteristics?.length).toBeGreaterThan(0)
        expect(view.state?.length).toBeGreaterThan(0)
      } finally {
        await client.logout()
      }
    },
    120000
  )

  ;(hasEnv ? test : test.skip)(
    "queryProviderPreview for ADSO ZL_FID09",
    async () => {
      const client = new BWAdtClient(
        testConfig.baseUrl,
        testConfig.username,
        testConfig.password,
        testConfig.client,
        testConfig.language
      )
      await client.login()

      try {
        const view = await client.queryProviderPreview("ZL_FID09", {
          rows: ["0PROFIT_CTR", "0COMP_CODE"],
          toRow: 50
        })
        expect(view.name).toBe("!ZL_FID09")
        expect(view.resultSet?.rows.headers.map(h => h.name)).toEqual([
          "0PROFIT_CTR",
          "0COMP_CODE"
        ])
        expect((view.flatRows || []).length).toBeGreaterThan(0)
      } finally {
        await client.logout()
      }
    },
    180000
  )
})
