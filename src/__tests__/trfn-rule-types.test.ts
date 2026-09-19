import { addRule, addTransformationRule } from "../api/transformation"
import { XMLParser } from "fast-xml-parser"

/**
 * 通用规则构造 addRule 测试 — 各类型 step 形态对照真机 46 个 TRFN 采样
 * (.local/rule-samples/*.xml, 2026-09-19/20)。纯 XML, 无网络依赖。
 *
 * 接线惯例 (真机实证):
 * - rule.source N  ↔ step.input N   (source N ↔ step1/inputN)
 * - rule.target 1  ↔ step.output 1  (target1 ↔ step1/output1)
 * - 常量/初始值/不更新规则无 source 块; 公式规则按 inputs 数量带多个 source 块
 */

// 在 trfn-rule-xml.test.ts 的 Eclipse log 精简 fixture 基础上改造:
// 1) 补充 ZZPOSID/ZC_PROJT (source) 与 ZACCOUNT2/ZC_PROJT (target) 供公式/常量用
// 2) S 组预置一条水合 DIRECT 规则 (BUDAT→BUDAT, id=1), 用于替换语义测试
const SAMPLE_TRFN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<trfn:transformation xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:BwCore="http://www.sap.com/bw/modeling/BwCore.ecore" xmlns:adtcore="http://www.sap.com/adt/core" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:trfn="http://www.sap.com/bw/modeling/Trfn.ecore" name="0MLYMXOXL67GTF38FT1WJG9SM0DJG60G">
  <source description="源" id="0" name="SRC" type="RSDS">
    <segment id="1" name="段 0001">
      <element name="BUDAT" intType="D" key="true" posit="0001">
        <endUserTexts label="过账日期"/>
        <inlineType name="DATS" length="8" semanticType="date"/>
      </element>
      <element name="ZXMBH" intType="C" key="true" posit="0002">
        <endUserTexts label="ZXMBH"/>
        <inlineType name="CHAR" length="10" semanticType="empty"/>
      </element>
      <element name="ZZPOSID" intType="C" key="false" posit="0003">
        <endUserTexts label="项目定义"/>
        <inlineType name="CHAR" length="24" semanticType="empty"/>
      </element>
      <element name="ZC_PROJT" intType="C" key="false" posit="0004">
        <endUserTexts label="项目"/>
        <inlineType name="CHAR" length="24" semanticType="empty"/>
      </element>
      <element name="ONLY_IN_SOURCE" intType="C" key="false" posit="0005">
        <endUserTexts label="ONLY_IN_SOURCE"/>
        <inlineType name="CHAR" length="10" semanticType="empty"/>
      </element>
    </segment>
  </source>
  <target description="目标" id="0" name="ZTGT" type="ADSO">
    <segment id="1">
      <element name="0RECORDMODE" infoObjectName="0RECORDMODE" intType="C" key="false" posit="0001">
        <endUserTexts label="更新模式"/>
        <inlineType name="CHAR" length="1" semanticType="empty"/>
      </element>
      <element name="BUDAT" intType="D" key="false" posit="0002">
        <endUserTexts label="过账日期"/>
        <inlineType name="DATS" length="8" semanticType="date"/>
      </element>
      <element name="ZXMBH" intType="C" key="false" posit="0003">
        <endUserTexts label="ZXMBH"/>
        <inlineType name="CHAR" length="10" semanticType="empty"/>
      </element>
      <element name="ZACCOUNT2" intType="C" key="false" posit="0004">
        <endUserTexts label="科目2"/>
        <inlineType name="CHAR" length="12" semanticType="empty"/>
      </element>
      <element name="ZC_PROJT" intType="C" key="false" posit="0005">
        <endUserTexts label="项目"/>
        <inlineType name="CHAR" length="24" semanticType="empty"/>
      </element>
    </segment>
  </target>
  <group id="1" description="Rules" sourceSegment="#///source/segment1" targetSegment="#///target/segment1" type="S">
    <rule description="" id="1">
      <source id="1">
        <input>#///group1/rule1/step1/input1</input>
        <elementRef>#///source/segment1/BUDAT</elementRef>
      </source>
      <target id="1">
        <output>#///group1/rule1/step1/output1</output>
        <elementRef>#///target/segment1/BUDAT</elementRef>
      </target>
      <step xsi:type="trfn:StepDirect" id="1" rank="MAIN" type="DIRECT">
        <input id="1">
          <output>#///group1/rule1/source1</output>
          <element name="BUDAT" intType="D" key="true" posit="0001">
            <inlineType name="DATS" length="8" semanticType="date"/>
          </element>
        </input>
        <output id="1">
          <input>#///group1/rule1/target1</input>
          <element name="BUDAT" intType="D" key="false" posit="0002">
            <inlineType name="DATS" length="8" semanticType="date"/>
          </element>
        </output>
      </step>
    </rule>
  </group>
</trfn:transformation>`

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" })

function ruleCount(xml: string): number {
  return (xml.match(/<rule description="" id="/g) || []).length
}

function stepTypes(xml: string): string[] {
  return [...xml.matchAll(/<step xsi:type="trfn:(Step[A-Za-z]+)"/g)].map(m => m[1])
}

describe("addRule 通用规则构造 (对照真机 step 形态)", () => {
  test("CONSTANT: 常量规则无 source 块, constant 属性落位, 接线指向 target1", () => {
    const next = addRule(SAMPLE_TRFN_XML, {
      type: "CONSTANT", targetField: "ZACCOUNT2", constant: "AC011601"
    })
    expect(stepTypes(next)).toContain("StepConstant")
    expect(next).toContain('xsi:type="trfn:StepConstant" constant="AC011601" id="1" type="CONSTANT" rank="MAIN"')
    // 新规则只指向目标字段
    expect(next).toContain("#///target/segment1/ZACCOUNT2")
    // 常量规则不应产生新的 source elementRef (原 DIRECT 规则的 BUDAT 不算)
    expect(next).not.toContain("#///source/segment1/ZACCOUNT2")
    // 输出接线
    expect(next).toContain("<input>#///group1/rule2/target1</input>")
    // 不破坏原规则
    expect(stepTypes(next)).toContain("StepDirect")
    expect(next).toContain("</trfn:transformation>")
    expect(() => parser.parse(next)).not.toThrow()
  })

  test("INITIAL: 初始值规则同样无 source 块", () => {
    const next = addRule(SAMPLE_TRFN_XML, { type: "INITIAL", targetField: "ZXMBH" })
    expect(next).toContain('xsi:type="trfn:StepInitial" id="1" type="INITIAL" rank="MAIN"')
    expect(next).toContain("#///target/segment1/ZXMBH")
    expect(next).toContain("<input>#///group1/rule2/target1</input>")
    expect(() => parser.parse(next)).not.toThrow()
  })

  test("NO_UPDATE: 不更新规则", () => {
    const next = addRule(SAMPLE_TRFN_XML, { type: "NO_UPDATE", targetField: "ZXMBH" })
    expect(next).toContain('xsi:type="trfn:StepNoUpdate" id="1" type="NO_UPDATE" rank="MAIN"')
    expect(next).toContain("#///target/segment1/ZXMBH")
  })

  test("FORMULA: formula 属性 + 按 inputs 生成多 source 块/多 step input", () => {
    const next = addRule(SAMPLE_TRFN_XML, {
      type: "FORMULA",
      targetField: "ZC_PROJT",
      formula: "IF( IS_INITIAL( ZZPOSID ), ZC_PROJT, ZZPOSID )",
      inputs: ["ZZPOSID", "ZC_PROJT"]
    })
    expect(next).toContain('xsi:type="trfn:StepFormula"')
    expect(next).toContain('formula="IF( IS_INITIAL( ZZPOSID ), ZC_PROJT, ZZPOSID )"')
    // 两个输入: source 块 1/2 + step input 1/2
    expect(next).toContain('<source id="1">')
    expect(next).toContain('<source id="2">')
    expect(next).toContain("#///source/segment1/ZZPOSID")
    expect(next).toContain("#///source/segment1/ZC_PROJT")
    expect(next).toContain("<input id=\"2\">")
    expect(next).toContain("#///group1/rule2/source2")
    expect(() => parser.parse(next)).not.toThrow()
  })

  test("FORMULA: 公式含双引号时做属性转义", () => {
    const next = addRule(SAMPLE_TRFN_XML, {
      type: "FORMULA",
      targetField: "ZC_PROJT",
      formula: 'IF( ZZPOSID = "X", ZC_PROJT, ZZPOSID )',
      inputs: ["ZZPOSID", "ZC_PROJT"]
    })
    expect(next).toContain('formula="IF( ZZPOSID = &quot;X&quot;, ZC_PROJT, ZZPOSID )"')
    expect(() => parser.parse(next)).not.toThrow()
  })

  test("FORMULA: 缺 inputs 时报错", () => {
    expect(() =>
      addRule(SAMPLE_TRFN_XML, { type: "FORMULA", targetField: "ZC_PROJT", formula: "1" })
    ).toThrow(/needs at least one input field/)
  })

  test("替换语义: 目标字段已有规则时默认替换 (Eclipse 改规则类型)", () => {
    const before = ruleCount(SAMPLE_TRFN_XML)
    expect(before).toBe(1)
    const next = addRule(SAMPLE_TRFN_XML, {
      type: "CONSTANT", targetField: "BUDAT", constant: "20260101"
    })
    // 总数不变: 旧 DIRECT 删 1, 新 CONSTANT 加 1
    expect(ruleCount(next)).toBe(1)
    expect(stepTypes(next)).toEqual(["StepConstant"])
    // 新 id 取组内最大+1
    expect(next).toContain('<rule description="" id="2">')
    // 旧规则的接线不复存在
    expect(next).not.toContain("#///group1/rule1/target1")
    expect(() => parser.parse(next)).not.toThrow()
  })

  test("replace:false: 目标已占用时显式报错", () => {
    expect(() =>
      addRule(SAMPLE_TRFN_XML, { type: "INITIAL", targetField: "BUDAT" }, { replace: false })
    ).toThrow(/already has a rule/)
  })

  test("DIRECT: addRule 与 addTransformationRule 结构一致 (group1 场景)", () => {
    const empty = SAMPLE_TRFN_XML.replace(/<rule description="" id="1">[\s\S]*?<\/rule>/, "")
    const viaGeneric = addRule(empty, { type: "DIRECT", sourceField: "ZXMBH" })
    const viaDirect = addTransformationRule(empty, "ZXMBH")
    // 属性序/缩进允许不同 (XML 属性序无语义), 解析后按键排序比较结构
    const sortKeys = (v: unknown): unknown =>
      Array.isArray(v) ? v.map(sortKeys)
        : v && typeof v === "object"
          ? Object.fromEntries(
              Object.entries(v as Record<string, unknown>)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, val]) => [k, sortKeys(val)])
            )
          : v
    const norm = (s: string) =>
      JSON.stringify(sortKeys(new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" }).parse(s)))
    expect(norm(viaGeneric)).toBe(norm(viaDirect))
  })

  test("组前缀推导: S 组 id=2 时引用路径用 group2", () => {
    const g2 = SAMPLE_TRFN_XML
      .replace('<group id="1" description="Rules"', '<group id="2" description="Rules"')
      .replace(/#\/\/\/group1\//g, "#///group2/")
    const next = addRule(g2, { type: "CONSTANT", targetField: "ZACCOUNT2", constant: "K" })
    expect(next).toContain("#///group2/rule2/target1")
    expect(next).not.toContain("#///group1/rule")
  })

  test("目标字段不存在时报错", () => {
    expect(() =>
      addRule(SAMPLE_TRFN_XML, { type: "INITIAL", targetField: "NOT_IN_TARGET" })
    ).toThrow(/Target field "NOT_IN_TARGET" not found/)
  })

  test("rule id 保持全局唯一 (已有 id=1 的组外无其他规则时取 2)", () => {
    const next = addRule(SAMPLE_TRFN_XML, { type: "INITIAL", targetField: "ZXMBH" })
    const ids = [...next.matchAll(/<rule description="" id="(\d+)"/g)].map(m => m[1])
    expect(new Set(ids).size).toBe(ids.length)
  })
})
