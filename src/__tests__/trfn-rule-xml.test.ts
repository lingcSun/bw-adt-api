import {
  addTransformationRule,
  autoMapTransformationFields
} from "../api/transformation"

/**
 * 纯 XML 辅助函数测试 — 对照 Eclipse Communication Log (2026-07-16 09:45:15 PUT body)
 *
 * 验证 addTransformationRule 生成的 DIRECT rule XML 与 Eclipse 结构一致;
 * autoMapTransformationFields 批量同名映射。
 * 无网络依赖。
 */

// 从 PUT body 精简的 TRFN XML: source 有 BUDAT/ZXMBH, target 有 BUDAT/ZXMBH/0RECORDMODE,
// Rules group (type="S") 为空。命名空间和结构与 Eclipse log 一致。
const SAMPLE_TRFN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<trfn:transformation xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:BwCore="http://www.sap.com/bw/modeling/BwCore.ecore" xmlns:adtcore="http://www.sap.com/adt/core" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:trfn="http://www.sap.com/bw/modeling/Trfn.ecore" name="0MLYMXOXL67GTF38FT1WJG9SM0DJG60G">
  <tlogoProperties adtcore:changedAt="2026-07-16T01:39:59Z" adtcore:name="0MLYMXOXL67GTF38FT1WJG9SM0DJG60G" adtcore:type="TRFN" adtcore:version="inactive"/>
  <source description="履约义务拆分分期明细表" id="0" name="ZBW_FI_TASKSTAGE_I            S4DCLNT300" type="RSDS">
    <segment id="1" name="段 0001">
      <element name="BUDAT" intType="D" key="true" posit="0001">
        <endUserTexts label="过账日期"/>
        <inlineType name="DATS" length="8" semanticType="date"/>
        <localProperties xsi:type="BwCore:LocalCharacteristicProperties"/>
        <associationType>1</associationType>
        <associationValid>false</associationValid>
      </element>
      <element name="ZXMBH" intType="C" key="true" posit="0002">
        <endUserTexts label="ZXMBH"/>
        <inlineType name="CHAR" length="10" semanticType="empty"/>
        <localProperties xsi:type="BwCore:LocalCharacteristicProperties"/>
        <associationType>1</associationType>
        <associationValid>false</associationValid>
      </element>
      <element name="ONLY_IN_SOURCE" intType="C" key="false" posit="0003">
        <endUserTexts label="ONLY_IN_SOURCE"/>
        <inlineType name="CHAR" length="10" semanticType="empty"/>
        <localProperties xsi:type="BwCore:LocalCharacteristicProperties"/>
        <associationType>1</associationType>
        <associationValid>false</associationValid>
      </element>
    </segment>
  </source>
  <target description="履约义务拆分分期明细表" id="0" name="ZS_FID27" type="ADSO">
    <segment id="1">
      <element name="0RECORDMODE" infoObjectName="0RECORDMODE" dimension="#///target/segment1/__TECH_FIELDS__§" intType="C" key="false" posit="0004">
        <endUserTexts label="BW 增量处理: 更新模式"/>
        <inlineType name="CHAR" length="1" semanticType="empty"/>
        <atom:link href="/sap/bw/modeling/iobj/0recordmode/a" rel="self"/>
        <associationType>1</associationType>
        <associationValid>true</associationValid>
      </element>
      <element name="BUDAT" dimension="#///target/segment1/__KEY§" intType="D" key="false" posit="0005">
        <endUserTexts label="过账日期"/>
        <inlineType name="DATS" length="8" semanticType="date"/>
        <localProperties xsi:type="BwCore:LocalCharacteristicProperties"/>
        <associationType>1</associationType>
        <associationValid>false</associationValid>
      </element>
      <element name="ZXMBH" dimension="#///target/segment1/__KEY§" intType="C" key="false" posit="0006">
        <endUserTexts label="ZXMBH"/>
        <inlineType name="CHAR" length="10" semanticType="empty"/>
        <localProperties xsi:type="BwCore:LocalCharacteristicProperties"/>
        <associationType>1</associationType>
        <associationValid>false</associationValid>
      </element>
    </segment>
  </target>
  <group id="1" description="Rules" sourceSegment="#///source/segment1" targetSegment="#///target/segment1" type="S">
  </group>
</trfn:transformation>`

describe("Transformation rule XML helpers (对照 Eclipse PUT body)", () => {
  test("addTransformationRule() - 插入 DIRECT rule, 结构与 Eclipse log 一致", () => {
    const next = addTransformationRule(SAMPLE_TRFN_XML, "BUDAT")

    // rule id 应为 1 (原 group 为空)
    expect(next).toContain('<rule id="1" description="">')
    // source elementRef
    expect(next).toContain("#///source/segment1/BUDAT")
    // target elementRef
    expect(next).toContain("#///target/segment1/BUDAT")
    // StepDirect
    expect(next).toContain('xsi:type="trfn:StepDirect"')
    expect(next).toContain('rank="MAIN" type="DIRECT"')
    // step.input.element 含 source 字段
    expect(next).toContain('#///group1/rule1/source1')
    expect(next).toContain('#///group1/rule1/target1')
    // 原有内容保留
    expect(next).toContain('name="0MLYMXOXL67GTF38FT1WJG9SM0DJG60G"')
    expect(next).toContain("</trfn:transformation>")
  })

  test("addTransformationRule() - 跨名映射 (ZXMBH source → 同名 target)", () => {
    const next = addTransformationRule(SAMPLE_TRFN_XML, "ZXMBH")
    expect(next).toContain("#///source/segment1/ZXMBH")
    expect(next).toContain("#///target/segment1/ZXMBH")
  })

  test("addTransformationRule() - 幂等: 同一 source 已映射则不变", () => {
    const once = addTransformationRule(SAMPLE_TRFN_XML, "BUDAT")
    const twice = addTransformationRule(once, "BUDAT")
    // 不应出现第二个指向 BUDAT 的 rule
    const matches = once.match(/#\/\/source\/segment1\/BUDAT/g) || []
    const matches2 = twice.match(/#\/\/source\/segment1\/BUDAT/g) || []
    expect(matches2.length).toBe(matches.length)
  })

  test("addTransformationRule() - source 字段不存在时抛错", () => {
    expect(() => addTransformationRule(SAMPLE_TRFN_XML, "NOT_EXIST")).toThrow(
      /Source field "NOT_EXIST" not found/
    )
  })

  test("addTransformationRule() - target 字段不存在时抛错", () => {
    // ONLY_IN_SOURCE 存在于 source 但 target 没有
    expect(() =>
      addTransformationRule(SAMPLE_TRFN_XML, "ONLY_IN_SOURCE", "NOT_IN_TARGET")
    ).toThrow(/Target field "NOT_IN_TARGET" not found/)
  })

  test("autoMapTransformationFields() - 批量映射同名字段", () => {
    const { xml, mapped } = autoMapTransformationFields(SAMPLE_TRFN_XML)

    // 同名字段: BUDAT, ZXMBH (ONLY_IN_SOURCE 在 target 不存在, 0RECORDMODE 在 source 不存在)
    expect(mapped).toEqual(["BUDAT", "ZXMBH"])
    // 生成 2 条 rule
    expect(xml).toContain('<rule id="1"')
    expect(xml).toContain('<rule id="2"')
    // 不应映射 ONLY_IN_SOURCE (target 无同名) 或 0RECORDMODE (source 无同名)
    expect(xml).not.toContain("#///source/segment1/ONLY_IN_SOURCE")
  })

  test("autoMapTransformationFields() - 已有映射的字段不重复", () => {
    // 先手动加一条 BUDAT
    const withOne = addTransformationRule(SAMPLE_TRFN_XML, "BUDAT")
    const { mapped } = autoMapTransformationFields(withOne)
    // BUDAT 已映射, 只剩 ZXMBH
    expect(mapped).toEqual(["ZXMBH"])
  })

  test("生成的 rule 内联了字段的 label/inlineType 元数据", () => {
    const next = addTransformationRule(SAMPLE_TRFN_XML, "BUDAT")
    // source step element 应含过账日期 label + DATS inlineType
    expect(next).toContain('label="过账日期"')
    expect(next).toContain('name="DATS" length="8" semanticType="date"')
  })
})
