/** KYF 创建 POST body 形态。 */
import { buildInfoObjectXml } from "../api/infoobject"

describe("buildInfoObjectXml", () => {
  test("POST 形态：Keyfigure、无 packageRef、空单位引用", () => {
    const xml = buildInfoObjectXml({
      name: "ZK_AMT",
      description: "",
      infoArea: "ZGLD_TEST",
      responsible: "10031990",
      masterLanguage: "ZH",
      masterSystem: "BPD"
    })
    expect(xml).toContain('xsi:type="InfoObject:Keyfigure"')
    expect(xml).toContain('keyfigureType="AMO"')
    expect(xml).toContain('objectSpecificDataType="CURR"')
    expect(xml).toContain("<infoObjectType>KYF</infoObjectType>")
    expect(xml).toContain("<infoArea>ZGLD_TEST</infoArea>")
    expect(xml).toContain("<unitCurrencyInfoObjectRef/>")
    expect(xml).toContain("<aggregationType>SUM</aggregationType>")
    expect(xml).not.toContain("packageRef")
    expect(xml).not.toContain("Unit")
  })
})
