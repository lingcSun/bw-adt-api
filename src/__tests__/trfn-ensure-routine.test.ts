import {
  ensureEndRoutineInXml,
  ensureStartRoutineInXml,
  hasEndRoutineInXml,
  hasStartRoutineInXml,
  deriveRoutineClassName,
} from "../api/transformation"

/**
 * ensureEnd/StartRoutine XML helpers — 对照 2026-09-21 Eclipse 抓包
 * ZVSTG91→ZVSTD91 TRFN 0OWVFWFXS8GE8R2VTBF9YQX4QMQST1TV
 */

const NO_ROUTINE = `<?xml version="1.0" encoding="UTF-8"?>
<trfn:transformation xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:trfn="http://www.sap.com/bw/modeling/Trfn.ecore" xmlns:adtcore="http://www.sap.com/adt/core" name="0OWVFWFXS8GE8R2VTBF9YQX4QMQST1TV" description="ADSO ZVSTG91 -&gt; ADSO ZVSTD91" startRoutine="" endRoutine="">
  <tlogoProperties adtcore:name="0OWVFWFXS8GE8R2VTBF9YQX4QMQST1TV" adtcore:type="TRFN"/>
  <source name="ZVSTG91" type="ADSO">
    <segment id="1">
      <element name="ZFLD1" dimension="#///source/segment1/CHA§"><inlineType name="CHAR" length="10"/></element>
    </segment>
  </source>
  <target name="ZVSTD91" type="ADSO">
    <segment id="1">
      <element name="ZFLD1" dimension="#///target/segment1/CHA§"><endUserTexts label="f1"/><inlineType name="CHAR" length="10" semanticType="empty"/></element>
      <element name="ZFLD2" dimension="#///target/segment1/CHA§"><endUserTexts label="f2"/><inlineType name="CHAR" length="5" semanticType="empty"/></element>
    </segment>
  </target>
  <group id="1" description="Rules" sourceSegment="#///source/segment1" targetSegment="#///target/segment1" type="S">
    <rule id="1" description="">
      <target id="1"><output>#///group1/rule1/step1/output1</output><elementRef>#///target/segment1/ZFLD1</elementRef></target>
      <step xsi:type="trfn:StepDirect" id="1" type="DIRECT"/>
    </rule>
  </group>
</trfn:transformation>`

describe("deriveRoutineClassName", () => {
  test("slice(12)+_M 对齐抓包类名", () => {
    expect(deriveRoutineClassName("0OWVFWFXS8GE8R2VTBF9YQX4QMQST1TV")).toBe(
      "/BIC/8R2VTBF9YQX4QMQST1TV_M"
    )
    expect(deriveRoutineClassName("0BE9X06HU3MN3FB1TO6MNLEGQI6XIJEO")).toBe(
      "/BIC/3FB1TO6MNLEGQI6XIJEO_M"
    )
  })
})

describe("ensureEndRoutineInXml", () => {
  test("无 END 时注入 G 组 + END 规则（含 classNameM/GLOBAL_END）", () => {
    expect(hasEndRoutineInXml(NO_ROUTINE)).toBe(false)
    const { xml, created, className } = ensureEndRoutineInXml(NO_ROUTINE)
    expect(created).toBe(true)
    expect(className).toBe("/BIC/8R2VTBF9YQX4QMQST1TV_M")
    expect(hasEndRoutineInXml(xml)).toBe(true)
    expect(xml).toMatch(/routinetype="END"/)
    expect(xml).toContain('classNameM="/BIC/8R2VTBF9YQX4QMQST1TV_M"')
    expect(xml).toContain('methodNameM="GLOBAL_END"')
    expect(xml).toMatch(/<group\b[^>]*type="G"/)
    // S 组仍在
    expect(xml).toMatch(/type="S"/)
  })

  test("可同时挂初始 target 字段", () => {
    const { xml } = ensureEndRoutineInXml(NO_ROUTINE, {
      targetFields: ["ZFLD1", "ZFLD2"],
    })
    const end = (xml.match(/<rule\b[^>]*routinetype="END"[\s\S]*?<\/rule>/) || [""])[0]
    expect(end).toContain("#///target/segment1/ZFLD1")
    expect(end).toContain("#///target/segment1/ZFLD2")
  })

  test("已有 END 时幂等（created=false，XML 不变）", () => {
    const once = ensureEndRoutineInXml(NO_ROUTINE)
    const twice = ensureEndRoutineInXml(once.xml)
    expect(twice.created).toBe(false)
    expect(twice.xml).toBe(once.xml)
  })
})

describe("ensureStartRoutineInXml", () => {
  test("无 START 时注入 START 规则（同 classNameM + GLOBAL_START）", () => {
    expect(hasStartRoutineInXml(NO_ROUTINE)).toBe(false)
    const { xml, created, className } = ensureStartRoutineInXml(NO_ROUTINE, {
      sourceFields: ["ZFLD1"],
    })
    expect(created).toBe(true)
    expect(className).toBe("/BIC/8R2VTBF9YQX4QMQST1TV_M")
    expect(hasStartRoutineInXml(xml)).toBe(true)
    expect(xml).toMatch(/routinetype="START"/)
    expect(xml).toContain('methodNameM="GLOBAL_START"')
    expect(xml).toContain('classNameM="/BIC/8R2VTBF9YQX4QMQST1TV_M"')
    expect(xml).toContain("#///source/segment1/ZFLD1")
  })

  test("已有 START 时幂等", () => {
    const once = ensureStartRoutineInXml(NO_ROUTINE)
    const twice = ensureStartRoutineInXml(once.xml)
    expect(twice.created).toBe(false)
    expect(twice.xml).toBe(once.xml)
  })

  test("先 END 再 START 共用同一 G 组", () => {
    const withEnd = ensureEndRoutineInXml(NO_ROUTINE).xml
    const { xml } = ensureStartRoutineInXml(withEnd, { sourceFields: ["ZFLD1"] })
    const gCount = (xml.match(/<group\b[^>]*type="G"/g) || []).length
    expect(gCount).toBe(1)
    expect(hasEndRoutineInXml(xml)).toBe(true)
    expect(hasStartRoutineInXml(xml)).toBe(true)
  })
})
