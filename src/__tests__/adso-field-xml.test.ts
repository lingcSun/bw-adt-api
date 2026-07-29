import {
  buildADSOFieldElementXml,
  addADSOFieldToXml,
  removeADSOFieldFromXml,
  extractADSOTimestamp
} from "../api/adso"

/**
 * 纯 XML 辅助函数测试 — 对照 Eclipse PUT body 中的 field 类型节点
 * (无 infoObjectName, sidDeterminationMode="N", localProperties/descriptions)
 */

const SAMPLE_ADSO_XML = `<?xml version="1.0" encoding="UTF-8"?>
<adso:dataStore xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:BwCore="http://www.sap.com/bw/modeling/BwCore.ecore" xmlns:adso="http://www.sap.com/bw/modeling/adso.ecore" xmlns:adtcore="http://www.sap.com/adt/core" name="ZL_FID37">
  <element xsi:type="adso:AdsoElement" name="AUGBL" dimension="#///CHA§" sidDeterminationMode="N">
    <inlineType name="CHAR" length="10" semanticType="empty"/>
    <localProperties xsi:type="BwCore:LocalCharacteristicProperties">
      <descriptions label="清账凭证号"/>
    </localProperties>
  </element>
  <keyElement>#///0AC_LEDGER</keyElement>
  <tlogoProperties adtcore:changedAt="2025-06-12T09:56:38Z" adtcore:name="ZL_FID37" adtcore:type="ADSO"/>
</adso:dataStore>`

describe("ADSO field-type XML helpers", () => {
  test("buildADSOFieldElementXml() - CHAR field 对照 AUGBL 形态", () => {
    const xml = buildADSOFieldElementXml({
      name: "ZAPI_FLD",
      dataType: "CHAR",
      length: 20,
      label: "API测试字段"
    })

    expect(xml).toContain('name="ZAPI_FLD"')
    expect(xml).toContain('dimension="#///CHA§"')
    expect(xml).toContain('sidDeterminationMode="N"')
    expect(xml).toContain('name="CHAR" length="20" semanticType="empty"')
    expect(xml).toContain('label="API测试字段"')
    expect(xml).not.toContain("infoObjectName")
    expect(xml).not.toContain("atom:link")
  })

  test("buildADSOFieldElementXml() - DATS field 对照 ETL_DATE 形态", () => {
    const xml = buildADSOFieldElementXml({
      name: "ETL_DATE2",
      dataType: "DATS"
    })

    expect(xml).toContain('name="DATS" length="8" semanticType="date"')
    expect(xml).toContain("<descriptions/>")
  })

  test("addADSOFieldToXml() - 插在 keyElement 之前", () => {
    const next = addADSOFieldToXml(SAMPLE_ADSO_XML, {
      name: "ZAPI_FLD",
      length: 12,
      label: "测试"
    })

    const fieldPos = next.indexOf('name="ZAPI_FLD"')
    const keyPos = next.indexOf("<keyElement>")
    expect(fieldPos).toBeGreaterThan(0)
    expect(keyPos).toBeGreaterThan(fieldPos)
    expect(next).toContain('name="AUGBL"')
  })

  test("addADSOFieldToXml() - 重名字段抛错", () => {
    expect(() =>
      addADSOFieldToXml(SAMPLE_ADSO_XML, { name: "AUGBL", length: 10 })
    ).toThrow(/already exists/)
  })

  test("removeADSOFieldFromXml() - 移除后可再添加", () => {
    const removed = removeADSOFieldFromXml(SAMPLE_ADSO_XML, "AUGBL")
    expect(removed).not.toContain('name="AUGBL"')
    expect(removed).toContain("<keyElement>")

    const readded = addADSOFieldToXml(removed, {
      name: "AUGBL",
      length: 10,
      label: "清账凭证号"
    })
    expect(readded).toContain('name="AUGBL"')
  })

  test("extractADSOTimestamp() - 从 changedAt 生成 PUT timestamp 头", () => {
    expect(extractADSOTimestamp(SAMPLE_ADSO_XML)).toBe("20250612095638")
  })
})
