import { AdtHTTP } from "../AdtHTTP"
import * as adso from "../api/adso"

/** Public facade for infoProvider (ADSO-only in this change). */
export class AdsoDomain {
  constructor(private readonly h: AdtHTTP) {}

  async details(adsoId: string, forceCacheUpdate?: boolean) {
    const details = await adso.getADSODetails(this.h, adsoId, forceCacheUpdate)
    const [configuration, tables, ddicTableName] = await Promise.all([
      adso.getADSOConfiguration(this.h, adsoId).catch(() => undefined),
      adso.getADSOTables(this.h, adsoId).catch(() => undefined),
      import("../api/ddic").then(m =>
        m.getADSODDICTableName(this.h, adsoId).catch(() => undefined)
      )
    ])
    return { ...details, configuration, tables, ddicTableName }
  }

  xml(adsoId: string, forceCacheUpdate?: boolean) {
    return adso.getADSOXml(this.h, adsoId, forceCacheUpdate)
  }

  versions(adsoId: string) {
    return adso.getADSOVersions(this.h, adsoId)
  }

  check(adsoId: string) {
    return adso.checkADSO(this.h, adsoId)
  }

  saveAndActivate(
    adsoId: string,
    xmlContent: string,
    options?: adso.SaveAndActivateADSOOptions
  ) {
    return adso.saveAndActivateADSO(this.h, adsoId, xmlContent, options)
  }

  async addField(
    adsoId: string,
    field: adso.ADSOFieldDefinition,
    options?: adso.SaveAndActivateADSOOptions
  ) {
    const xml = await adso.getADSOXml(this.h, adsoId, true)
    const nextXml = adso.addADSOFieldToXml(xml, field)
    return adso.saveAndActivateADSO(this.h, adsoId, nextXml, options)
  }

  /**
   * 给 ADSO 加键定义（2026-09-20 F3 闭环）。默认不激活——
   * 空白 ADSO 建议先 addKey 再 addField（由 addField 激活）。
   */
  addKey(
    adsoId: string,
    infoObjectName: string,
    options?: adso.AddADSOKeyOptions
  ) {
    return adso.addADSOKey(this.h, adsoId, infoObjectName, options)
  }

  create(
    options: adso.CreateADSOOptions & {
      autoActivate?: boolean
      responsible?: string
    }
  ) {
    return adso.createADSOFull(this.h, options)
  }

  /**
   * @deprecated 使用 `client.infoArea.validate`（P1 Task 2 归位 infoArea 域）。
   */
  validateInfoArea(name: string) {
    return adso.validateInfoArea(this.h, name)
  }

  validateTemplate(name: string) {
    return adso.validateTemplateADSO(this.h, name)
  }

  validateNewName(name: string) {
    return adso.validateNewADSOName(this.h, name)
  }

  /** Advanced: full parse tree */
  getRaw(adsoId: string, forceCacheUpdate?: boolean) {
    return adso.getADSO(this.h, adsoId, forceCacheUpdate)
  }
}
