/** UNI（Unit）创建 POST body 形态。 */
import { buildInfoObjectUnitXml } from "../api/infoobject"

describe("buildInfoObjectUnitXml", () => {
  test("币种 Unit POST 形态", () => {
    const xml = buildInfoObjectUnitXml({
      name: "ZC_RWCUR",
      description: "交易币种",
      infoArea: "ZBW_MDL",
      packageName: "ZBW",
      responsible: "10031990",
      masterLanguage: "ZH",
      masterSystem: "BPD"
    })

    expect(xml).toContain('xsi:type="InfoObject:Unit"')
    expect(xml).toContain('name="ZC_RWCUR"')
    expect(xml).toContain('unitType="CUR"')
    expect(xml).toContain("shortDescriptionSet=\"false\"")
    expect(xml).toContain("<infoObjectType>UNI</infoObjectType>")
    expect(xml).toContain("<dataType>CUKY</dataType>")
    expect(xml).toContain("<longDescription>交易币种</longDescription>")
    expect(xml).toContain("<shortDescription>交易币种</shortDescription>")
    expect(xml).toContain("<infoArea>ZBW_MDL</infoArea>")
    expect(xml).toContain('adtcore:name="ZBW"')
    expect(xml).toContain('<referencedInfoObject name="0CURRENCY"/>')
    expect(xml).toContain("<displayProperties/>")
    expect(xml).toContain("<sidTable/>")
    expect(xml).not.toContain("Keyfigure")
  })

  test("缺省 referencedInfoObject = 0CURRENCY", () => {
    const xml = buildInfoObjectUnitXml({
      name: "ZC_X",
      description: "x",
      infoArea: "ZBW_MDL"
    })
    expect(xml).toContain('<referencedInfoObject name="0CURRENCY"/>')
  })

  test("$TMP 也写 packageRef name", () => {
    const xml = buildInfoObjectUnitXml({
      name: "ZC_CUR",
      description: "货币码",
      infoArea: "ZGLD_TEST",
      packageName: "$TMP"
    })
    expect(xml).toContain('adtcore:name="$TMP"')
    expect(xml).toContain("<infoArea>ZGLD_TEST</infoArea>")
  })
})
