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

  create(
    options: adso.CreateADSOOptions & {
      autoActivate?: boolean
      responsible?: string
    }
  ) {
    return adso.createADSOFull(this.h, options)
  }

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
