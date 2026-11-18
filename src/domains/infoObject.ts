import { AdtHTTP } from "../AdtHTTP"
import * as iobj from "../api/infoobject"

/** Public facade for infoObject. */
export class InfoObjectDomain {
  constructor(private readonly h: AdtHTTP) {}

  async get(iobjName: string, options?: iobj.GetInfoObjectOptions) {
    const [active, metadata] = await Promise.all([
      iobj.getInfoObject(this.h, iobjName, options),
      iobj.getInfoObjectMetadata(this.h, iobjName).catch(() => undefined)
    ])
    return { ...active, metadata }
  }

  validateExists(iobjName: string) {
    return iobj.validateInfoObjectExists(this.h, iobjName)
  }

  validateNewName(iobjName: string) {
    return iobj.validateInfoObjectNewName(this.h, iobjName)
  }

  /**
   * 创建关键指标（KYF）：validate → lock(CREA) → POST Keyfigure → PUT 单位/描述 → 激活。
   * $TMP 或真实包+transport 均可。
   */
  create(options: iobj.InfoObjectCreateOptions & { autoActivate?: boolean; responsible?: string }) {
    return iobj.createInfoObjectFull(this.h, {
      ...options,
      masterLanguage: options.masterLanguage ?? this.h.language ?? "ZH",
      responsible: options.responsible || this.h.username || "",
      masterSystem: options.masterSystem ?? "BPD"
    })
  }

  /**
   * 创建特征（CHA）：校验 → lock(CREA) → POST 骨架 → PUT 属性 →（可选激活）。
   * dataType 恒为 CHAR；length 缺省 5。
   */
  createCha(options: iobj.InfoObjectChaCreateOptions & { responsible?: string }) {
    return iobj.createInfoObjectChaFull(this.h, {
      ...options,
      masterLanguage: options.masterLanguage ?? this.h.language ?? "ZH",
      responsible: options.responsible || this.h.username || "",
      masterSystem: options.masterSystem ?? "BPD"
    })
  }

  /**
   * 创建单位/币种（UNI）：校验 → lock(CREA) → POST Unit →（可选激活）。
   * 默认 unitType=CUR、dataType=CUKY、引用 0CURRENCY。
   */
  createUnit(options: iobj.InfoObjectUnitCreateOptions & { responsible?: string }) {
    return iobj.createInfoObjectUnitFull(this.h, {
      ...options,
      masterLanguage: options.masterLanguage ?? this.h.language ?? "ZH",
      responsible: options.responsible || this.h.username || "",
      masterSystem: options.masterSystem ?? "BPD"
    })
  }

  /** Raw IOBJ XML for PUT (GET /iobj/{name}/m). */
  xml(iobjName: string, forceCacheUpdate?: boolean) {
    return iobj.getInfoObjectXml(this.h, iobjName, forceCacheUpdate)
  }

  versions(iobjName: string) {
    return iobj.getInfoObjectVersions(this.h, iobjName)
  }

  check(iobjName: string) {
    return iobj.checkInfoObject(this.h, iobjName)
  }

  /** Save and Activate InfoObject — lock → transport → PUT → activate → unlock。 */
  saveAndActivate(
    iobjName: string,
    xmlContent: string,
    options?: iobj.SaveAndActivateInfoObjectOptions
  ) {
    return iobj.saveAndActivateInfoObject(this.h, iobjName, xmlContent, options)
  }

  /**
   * Advanced 子面：调用方持锁原语（lock/unlock/activate/update）。
   */
  get advanced() {
    return Object.freeze({
      lock: (iobjName: string) => iobj.lockInfoObject(this.h, iobjName),
      unlock: (iobjName: string) => iobj.unlockInfoObject(this.h, iobjName),
      activate: (iobjName: string, lockHandle: string, corrNr?: string) =>
        iobj.activateInfoObject(this.h, iobjName, lockHandle, corrNr),
      update: (
        iobjName: string,
        xmlContent: string,
        io: { lockHandle: string; corrNr?: string; timestamp?: string }
      ) => iobj.updateInfoObject(this.h, iobjName, xmlContent, io)
    })
  }
}
