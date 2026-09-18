import { parseInfoObjectDetails } from "../api/infoobject"

/**
 * Offline unit tests for InfoObject details parsing.
 *
 * Two real defects are locked in here:
 *  1. `/a` returns a raw XML STRING; the parser used to walk it as a tree, so
 *     every field came back undefined (name "", length = string length).
 *  2. Namespaced / BPC-style names ("/CPMB/A2D0O93") need URL encoding at the
 *     call site; this suite pins the parser contract that makes that usable.
 *
 * The fixture is a real /CPMB/A2D0O93 response captured from the dev system.
 */

const REAL_XML = `<?xml version="1.0" encoding="utf-8"?><iobj:infoObject name="/CPMB/A2D0O93" xsi:type="iobj:Characteristic" fieldName="/B28/S_A2D0O93" withLowerCaseLetters="true" outputLength="32" infoProvider="true" enhancedMasterDataUpdate="0" objectSpecificDataType="CHAR" xmlns:iobj="http://www.sap.com/bw/modeling/BwIobj.ecore" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:adtcore="http://www.sap.com/adt/core" xmlns:atom="http://www.w3.org/2005/Atom"><infoObjectType>CHA</infoObjectType><dataElement name="/B28/OIA2D0O93" status="A"/><dataType>CHAR</dataType><longDescription>CC_RPTCCY</longDescription><shortDescription>CC_RPTCCY</shortDescription><texts language="1" shortText="CC_RPTCCY" longText="CC_RPTCCY"/><tlogoProperties adtcore:responsible="SAP" adtcore:masterLanguage="ZH" adtcore:masterSystem="BPD" adtcore:name="/CPMB/A2D0O93" adtcore:type="IOBJ" adtcore:description="CC_RPTCCY" adtcore:language="ZH"><atom:link href="/sap/bw/modeling/iobj/%24cpmb%24a2d0o93/m" rel="self" type="application/vnd.sap-bw-modeling.infoobject+xml" title="self"/><adtcore:packageRef adtcore:uri="/sap/bc/adt/packages/%24tmp" adtcore:type="DEVC/K" adtcore:name="$TMP"/><infoArea>/CPMB/GLODON_CONSOL</infoArea><objectVersion>A</objectVersion><objectStatus>active</objectStatus><contentState>ACT</contentState></tlogoProperties><length>32</length><displayProperties><bexDescription>0</bexDescription></displayProperties><unitsOfMeasureForCharacteristic status="D"/><currencyAttribute infoObjectType="CHA"/><masterDataProperties withMasterData="true"><timeDependentAttributeSIDTable name="/B28/YA2D0O93" status="E"/><attributeSIDTable name="/B28/XA2D0O93" status="A"/><masterDataView name="/B28/MA2D0O93" status="A"/><masterDataTable name="/B28/PA2D0O93" status="A"/><timeDependentMasterDataTable name="/B28/QA2D0O93" status="E"/></masterDataProperties><textProperties withTexts="true" longTextAvailable="true"><textTable name="/B28/TA2D0O93" status="A"/></textProperties><hierarchyProperties withHierarchies="true" type="GEN"><hierarchyTable name="/B28/HA2D0O93" status="A"/></hierarchyProperties><attributeN name="/CPMB/A2PFCKZ" infoObjectType="CHA" dataType="CHAR" length="1" type="NAV"/><attributeN name="/CPMB/CALC" infoObjectType="CHA" dataType="CHAR" length="1" type="NAV"/><runtimeProperties cacheMode="D" readMode="H"/><hanaAttributeMapping type="01"><sourceField name="/CPMB/A2D0O93"/></hanaAttributeMapping><sidTable name="/B28/SA2D0O93" status="A"/><numberRangeObject id="BIM0000416" type="BIM"/></iobj:infoObject>`

describe("parseInfoObjectDetails", () => {
  test("accepts a raw XML string (the /a response shape)", () => {
    const d = parseInfoObjectDetails(REAL_XML)
    expect(d.infoObjectType).toBe("CHA")
    expect(d.dataType).toBe("CHAR")
    expect(d.length).toBe(32)
    expect(d.infoArea).toBe("/CPMB/GLODON_CONSOL")
    expect(d.objectStatus).toBe("active")
  })

  test("does not mistake XML string length for the IOBJ length", () => {
    const d = parseInfoObjectDetails(REAL_XML)
    // Regression guard: a failed parse returned length === raw string length.
    expect(d.length).not.toBe(REAL_XML.length)
    expect(d.length).toBe(32)
  })

  test("parses master data / text / hierarchy properties", () => {
    const d = parseInfoObjectDetails(REAL_XML)
    expect(d.withMasterData).toBe(true)
    expect(d.masterDataTable).toBe("/B28/PA2D0O93")
    expect(d.masterDataView).toBe("/B28/MA2D0O93")
    expect(d.timeDependentMasterDataTable).toBe("/B28/QA2D0O93")
    expect(d.withTexts).toBe(true)
    expect(d.longTextAvailable).toBe(true)
    expect(d.textTable).toBe("/B28/TA2D0O93")
    expect(d.withHierarchies).toBe(true)
    expect(d.hierarchyTable).toBe("/B28/HA2D0O93")
  })

  test("exposes unit/currency semantics (drives amount-unit pairing)", () => {
    const d = parseInfoObjectDetails(REAL_XML)
    expect(d.unitsOfMeasureForCharacteristic).toBe("D")
    expect(d.currencyAttribute).toBe("CHA")
  })

  test("collects repeated nodes", () => {
    const d = parseInfoObjectDetails(REAL_XML)
    expect(d.attributeN).toHaveLength(2)
    expect(d.numberRangeObjects).toHaveLength(1)
    expect(d.hanaAttributeMapping).toHaveLength(1)
    expect(d.runtimeProperties).toBeDefined()
    expect(d.displayProperties).toBeDefined()
  })

  test("still accepts an already-parsed tree", () => {
    const tree = {
      "iobj:infoObject": {
        "@_name": "0COMP_CODE",
        infoObjectType: "CHA",
        dataType: "CHAR",
        length: 4,
      },
    }
    const d = parseInfoObjectDetails(tree)
    expect(d.infoObjectType).toBe("CHA")
    expect(d.dataType).toBe("CHAR")
    expect(d.length).toBe(4)
  })

  test("tolerates a minimal document without optional nodes", () => {
    const d = parseInfoObjectDetails(
      `<iobj:infoObject name="X"><infoObjectType>KYF</infoObjectType></iobj:infoObject>`,
    )
    expect(d.infoObjectType).toBe("KYF")
    expect(d.withMasterData).toBeUndefined()
    expect(d.unitsOfMeasureForCharacteristic).toBeUndefined()
  })

  test("keeps 0 as a real length instead of coercing it to undefined", () => {
    const d = parseInfoObjectDetails(
      `<iobj:infoObject name="K"><infoObjectType>KYF</infoObjectType><length>0</length></iobj:infoObject>`,
    )
    expect(d.length).toBe(0)
  })

  test("a KEY figure with no <length> element stays undefined", () => {
    const d = parseInfoObjectDetails(
      `<iobj:infoObject name="K"><infoObjectType>KYF</infoObjectType><dataType>QUAN</dataType></iobj:infoObject>`,
    )
    expect(d.length).toBeUndefined()
    expect(d.dataType).toBe("QUAN")
  })

  test("prefers the flat <length> when inlineType is absent (the /a shape)", () => {
    const d = parseInfoObjectDetails(
      `<iobj:infoObject name="A"><infoObjectType>CHA</infoObjectType><dataType>CHAR</dataType><length>10</length></iobj:infoObject>`,
    )
    expect(d.length).toBe(10)
    expect(d.dataType).toBe("CHAR")
  })
})
