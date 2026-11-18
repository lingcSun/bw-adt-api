import { AdtHTTP, isHttpClientException } from "../AdtHTTP"
import * as adso from "../api/adso"
import * as bwObject from "../api/bwObject"

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

  /**
   * ADSO 是否存在。转发 validateADSOExists 并归一为 boolean。
   * 存在 → true；不存在时 validation 端点常直接报错（非 valid=false）→ 归 false。
   * HttpClientException（网络/会话失败）原样重抛，不伪装成「不存在」。
   */
  async exists(adsoId: string) {
    try {
      const result = await adso.validateADSOExists(this.h, adsoId)
      return result.valid
    } catch (e) {
      if (isHttpClientException(e)) throw e
      return false
    }
  }

  /**
   * 激活 ADSO（自管锁）：重激活已保存对象。
   * lock → activate（可选 transport 作 corrNr，须为请求号）→ 始终 unlock；
   * unlock 失败吞错。调用方持锁用 `.advanced.activate`。
   */
  async activate(adsoId: string, options?: { transport?: string }) {
    const lock = await adso.lockADSO(this.h, adsoId)
    try {
      return await adso.activateADSO(
        this.h,
        adsoId,
        lock.lockHandle,
        options?.transport ?? ""
      )
    } finally {
      try {
        await adso.unlockADSO(this.h, adsoId)
      } catch {
        // 吞错，不掩盖原异常
      }
    }
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

  /** 删除 ADSO 字段（本地 field / IOBJ 挂载通用）。 */
  async removeField(
    adsoId: string,
    fieldName: string,
    options?: adso.SaveAndActivateADSOOptions
  ) {
    const xml = await adso.getADSOXml(this.h, adsoId, true)
    const nextXml = adso.removeADSOFieldFromXml(xml, fieldName)
    return adso.saveAndActivateADSO(this.h, adsoId, nextXml, options)
  }

  /**
   * 给 ADSO 加键定义。默认不激活——
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

  /** @deprecated 使用 `client.infoArea.validate`。 */
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

  /**
   * Advanced 子面：调用方持锁原语（lock/unlock/activate/update/delete）。
   * 与门面自管动词（saveAndActivate/delete）锁契约隔离；不属于 verbs 家族表。
   */
  get advanced() {
    return Object.freeze({
      lock: (adsoId: string) => adso.lockADSO(this.h, adsoId),
      unlock: (adsoId: string) => adso.unlockADSO(this.h, adsoId),
      activate: (adsoId: string, lockHandle?: string, corrNr?: string) =>
        adso.activateADSO(this.h, adsoId, lockHandle ?? "", corrNr ?? ""),
      update: (
        adsoId: string,
        xmlContent: string,
        io: adso.UpdateADSOOptions
      ) => adso.updateADSO(this.h, adsoId, xmlContent, io),
      /** 调用方持锁原样：lockHandle 由调用方 lock() 取得并自行释放。 */
      delete: (
        adsoId: string,
        options: { lockHandle: string; transport?: string }
      ) =>
        bwObject
          .createBWObject(this.h, bwObject.BWObjectType.ADSO, adsoId)
          .delete(options)
    })
  }

  /**
   * 删除 ADSO（自管锁）：lock → BWObject.delete(lockHandle)。
   * 成功路径由 delete 内部 unlock；失败时 best-effort unlock 后上抛。
   * 可选 transport 作 corrNr（须为请求号）。
   */
  async delete(adsoId: string, options?: { transport?: string }) {
    const lock = await adso.lockADSO(this.h, adsoId)
    try {
      return await bwObject
        .createBWObject(this.h, bwObject.BWObjectType.ADSO, adsoId)
        .delete({ lockHandle: lock.lockHandle, transport: options?.transport })
    } catch (e) {
      try {
        await adso.unlockADSO(this.h, adsoId)
      } catch {
        // best-effort：unlock 失败不掩盖 delete 的原异常
      }
      throw e
    }
  }
}
