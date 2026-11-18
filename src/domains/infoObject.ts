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
   * 创建关键指标（KYF）完整流程（2026-11-17 ZK_AMT）：
   * validate → lock(CREA) → POST Keyfigure(stateless) → PUT 单位/描述 → 激活。
   * 传 unitInfoObject（如 ZC_CUR / ZC_RWCUR）；$TMP 或真实包+transport 均可。
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
   * 创建特征（CHA）完整流程：校验 → lock(parent/CREA) → POST 骨架 →
   * PUT /m 补写属性（描述/长度/InfoArea）→ 回读校验 →（可选激活）→ finally unlock。
   * dataType 恒为 CHAR；length 缺省取服务端骨架值 5。2026-11-12 真机闭环。
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
   * 创建单位/币种（UNI）完整流程：校验 → lock(CREA) → POST Unit XML →
   * 回读校验 →（可选激活）→ finally unlock。
   * 证据：2026-11-17 Eclipse ZC_RWCUR（xsi:type=Unit, unitType=CUR, CUKY, 引用 0CURRENCY）。
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

  /**
   * Save and Activate InfoObject — lock → transport → PUT → activate → unlock.
   * 证据：2026-11-17 ZK_WSL（unitCurrencyInfoObjectRef → ZC_RWCUR）。
   */
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
