import {
  addFieldToEndRoutine,
  removeFieldFromEndRoutine,
  isEndRoutineFieldSelected,
  extractTransformationTimestamp
} from "../api/transformation"

/**
 * 结束例程 setFields XML 辅助 — 对照 Eclipse SetGlobalRoutineFieldsAction PUT body
 */

const SAMPLE_TRFN = `<?xml version="1.0" encoding="UTF-8"?>
<trfn:transformation xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:BwCore="http://www.sap.com/bw/modeling/BwCore.ecore" xmlns:trfn="http://www.sap.com/bw/modeling/Trfn.ecore" xmlns:adtcore="http://www.sap.com/adt/core" name="0BE9X06HU3MN3FB1TO6MNLEGQI6XIJEO" description="ADSO ZL_FID01 -> ADSO ZL_FID37">
  <tlogoProperties adtcore:changedAt="2026-07-15T11:59:14Z" adtcore:name="0BE9X06HU3MN3FB1TO6MNLEGQI6XIJEO" adtcore:type="TRFN"/>
  <source name="ZL_FID01" type="ADSO"><segment id="1"></segment></source>
  <target name="ZL_FID37" type="ADSO">
    <segment id="1">
      <element name="ZC_JTL4" dimension="#///target/segment1/CHA§" intType="C" key="false" posit="0071">
        <endUserTexts label="ZC_JTL4"/>
        <inlineType name="CHAR" length="3" semanticType="empty"/>
        <localProperties xsi:type="BwCore:LocalCharacteristicProperties"/>
        <associationType>1</associationType>
        <associationValid>false</associationValid>
      </element>
      <element name="ETL_DATE" dimension="#///target/segment1/CHA§" intType="D" key="false" posit="0065">
        <endUserTexts label="日期"/>
        <inlineType name="DATS" length="8" semanticType="date"/>
        <localProperties xsi:type="BwCore:LocalCharacteristicProperties"/>
      </element>
    </segment>
  </target>
  <group id="0" type="G">
    <rule id="46" routinetype="START">
      <source id="1"><elementRef>#///source/segment1/0AC_LEDGER</elementRef></source>
      <step xsi:type="trfn:StepRoutine" id="1" type="ROUTINE" methodNameM="GLOBAL_START"/>
    </rule>
    <rule id="44" description="" routinetype="END">
      <target id="1">
        <elementRef>#///target/segment1/ETL_DATE</elementRef>
      </target>
      <step xsi:type="trfn:StepRoutine" id="1" rank="MAIN" type="ROUTINE" classNameM="/BIC/3FB1TO6MNLEGQI6XIJEO_M" methodNameM="GLOBAL_END"/>
    </rule>
  </group>
  <group id="1" description="Rules" sourceSegment="#///source/segment1" targetSegment="#///target/segment1" type="S">
    <rule id="43" description="">
      <target id="1">
        <output>#///group1/rule43/step1/output1</output>
        <elementRef>#///target/segment1/ETL_DATE</elementRef>
      </target>
      <step xsi:type="trfn:StepFormula" id="1" type="FORMULA" formula=" SYST-DATUM"/>
    </rule>
  </group>
</trfn:transformation>`

describe("TRFN end routine setFields XML helpers", () => {
  test("extractTransformationTimestamp()", () => {
    expect(extractTransformationTimestamp(SAMPLE_TRFN)).toBe("20260715115914")
  })

  test("isEndRoutineFieldSelected() - 初始仅 ETL_DATE", () => {
    expect(isEndRoutineFieldSelected(SAMPLE_TRFN, "ETL_DATE")).toBe(true)
    expect(isEndRoutineFieldSelected(SAMPLE_TRFN, "ZC_JTL4")).toBe(false)
  })

  test("addFieldToEndRoutine() - 勾选 ZC_JTL4", () => {
    const next = addFieldToEndRoutine(SAMPLE_TRFN, "ZC_JTL4")

    expect(isEndRoutineFieldSelected(next, "ZC_JTL4")).toBe(true)
    expect(next).toContain('<elementRef>#///target/segment1/ZC_JTL4</elementRef>')
    expect(next).toContain('type="NO_UPDATE"')
    expect(next).toContain('name="ZC_JTL4"')
    expect(next).toMatch(/<rule id="\d+"[^>]*>[\s\S]*ZC_JTL4[\s\S]*NO_UPDATE/)
  })

  test("addFieldToEndRoutine() - 已勾选则幂等", () => {
    const once = addFieldToEndRoutine(SAMPLE_TRFN, "ZC_JTL4")
    const twice = addFieldToEndRoutine(once, "ZC_JTL4")
    const count = (twice.match(/#\/\/\/target\/segment1\/ZC_JTL4/g) || []).length
    // END target 1 处 + NO_UPDATE elementRef 1 处 = 2
    expect(count).toBe(2)
  })

  test("addFieldToEndRoutine() - 目标字段不存在则抛错", () => {
    expect(() => addFieldToEndRoutine(SAMPLE_TRFN, "NO_SUCH_FIELD")).toThrow(
      /not found in TRFN target/
    )
  })

  test("removeFieldFromEndRoutine() - 取消勾选", () => {
    const withField = addFieldToEndRoutine(SAMPLE_TRFN, "ZC_JTL4")
    const removed = removeFieldFromEndRoutine(withField, "ZC_JTL4")

    expect(isEndRoutineFieldSelected(removed, "ZC_JTL4")).toBe(false)
    expect(removed).not.toContain('type="NO_UPDATE"')
    // target segment 上的字段定义保留
    expect(removed).toContain('name="ZC_JTL4"')
  })

  test("removeFieldFromEndRoutine() - 紧凑 XML / 属性顺序 description+id", () => {
    // 服务端读回形态 (Eclipse PUT 后 GET)
    const compact = SAMPLE_TRFN.replace(
      "</group>\n</trfn:transformation>",
      `<rule description="" id="53"><target id="1"><output>#///group1/rule53/step1/output1</output><elementRef>#///target/segment1/ZC_JTL4</elementRef></target><step xsi:type="trfn:StepNoUpdate" id="1" type="NO_UPDATE" rank="MAIN"><output id="1"><input>#///group1/rule53/target1</input><element xsi:type="trfn:TransformationElement" name="ZC_JTL4" dimension="#///target/segment1/CHA§"><endUserTexts label="ZC_JTL4"/><inlineType name="CHAR" length="3"/></element></output></step></rule></group>
</trfn:transformation>`
    ).replace(
      `<target id="1">
        <elementRef>#///target/segment1/ETL_DATE</elementRef>
      </target>`,
      `<target id="1"><elementRef>#///target/segment1/ETL_DATE</elementRef></target>
      <target id="2"><elementRef>#///target/segment1/ZC_JTL4</elementRef></target>`
    )

    expect(isEndRoutineFieldSelected(compact, "ZC_JTL4")).toBe(true)
    const removed = removeFieldFromEndRoutine(compact, "ZC_JTL4")
    expect(isEndRoutineFieldSelected(removed, "ZC_JTL4")).toBe(false)
    expect(removed).not.toContain("#///target/segment1/ZC_JTL4")
    expect(removed).toContain('name="ZC_JTL4"') // target element 仍在
  })
})
