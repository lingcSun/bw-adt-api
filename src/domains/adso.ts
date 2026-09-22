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
   * ADSO 是否存在（动词族审计补齐）。转发 validateADSOExists 并归一为 boolean。
   * 实测（API_REFERENCE validateADSOExists 行）：存在 → valid=true；
   * 不存在 → validation 端点直接报错而非 valid=false——AdtError（含 not-found
   * 形态；消息可能随 BW_LANGUAGE 本地化，不做消息匹配）归 false。
   * HttpClientException（网络/会话等传输层失败）原样重抛——网络故障不伪装成
   * 「不存在」（语义见 2026-09-22-exists-error-semantics.md）。
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

  /**
   * 删除 ADSO（自管锁）：内部先取域锁（lockADSO，stateful）→ BWObject.delete
   * lockHandle 模式（VERIFIED_APIS §8）→ 成功即返回、**不再**域级 unlock——
   * 删除即释放锁（真机卡带 lock→DELETE /m 全 200，2026-09-22 录制）。
   * delete 失败时锁还挂着，做一次 best-effort unlock（吞错，不掩盖原异常）再上抛。
   * 可选 transport 作 corrNr——必须是请求号而非任务号（见 BWObject.delete）。
   * 0.x 行为变化（2026-09-22）：lockHandle 不再是调用方输入；此前只能经已弃用的
   * flat client.lockADSO 自取锁，锁的获取倒挂在调用方身上。
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
