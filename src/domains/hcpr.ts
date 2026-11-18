import { AdtHTTP, isHttpClientException } from "../AdtHTTP"
import * as hcpr from "../api/hcpr"
import * as bwObject from "../api/bwObject"

/** Public facade for CompositeProvider (HCPR). */
export class HcprDomain {
  constructor(private readonly h: AdtHTTP) {}

  details(hcprId: string, forceCacheUpdate?: boolean) {
    return hcpr.getHCPRDetails(this.h, hcprId, forceCacheUpdate)
  }

  xml(hcprId: string, forceCacheUpdate?: boolean) {
    return hcpr.getHCPRXml(this.h, hcprId, forceCacheUpdate)
  }

  versions(hcprId: string) {
    return hcpr.getHCPRVersions(this.h, hcprId)
  }

  check(hcprId: string) {
    return hcpr.checkHCPR(this.h, hcprId)
  }

  /**
   * HCPR 是否存在。不存在时 validation 端点直接报错 → false；
   * HttpClientException 原样重抛。
   */
  async exists(hcprId: string) {
    try {
      const result = await hcpr.validateHCPRExists(this.h, hcprId)
      return result.valid
    } catch (e) {
      if (isHttpClientException(e)) throw e
      return false
    }
  }

  /**
   * 重激活已保存 HCPR（自管锁）：lock → activate → finally unlock。
   */
  async activate(hcprId: string, options?: { transport?: string }) {
    const lock = await hcpr.lockHCPR(this.h, hcprId)
    try {
      return await hcpr.activateHCPR(
        this.h,
        hcprId,
        lock.lockHandle,
        options?.transport ?? ""
      )
    } finally {
      try {
        await hcpr.unlockHCPR(this.h, hcprId)
      } catch {
        // 吞错，不掩盖原异常
      }
    }
  }

  saveAndActivate(
    hcprId: string,
    xmlContent: string,
    options?: hcpr.SaveAndActivateHCPROptions
  ) {
    return hcpr.saveAndActivateHCPR(this.h, hcprId, xmlContent, options)
  }

  /**
   * Advanced 子面：调用方持锁原语（lock/unlock/activate/update）。
   */
  get advanced() {
    return Object.freeze({
      lock: (hcprId: string) => hcpr.lockHCPR(this.h, hcprId),
      unlock: (hcprId: string) => hcpr.unlockHCPR(this.h, hcprId),
      activate: (hcprId: string, lockHandle?: string, corrNr?: string) =>
        hcpr.activateHCPR(this.h, hcprId, lockHandle ?? "", corrNr ?? ""),
      update: (
        hcprId: string,
        xmlContent: string,
        io: { lockHandle: string; corrNr?: string; timestamp?: string }
      ) => hcpr.updateHCPR(this.h, hcprId, xmlContent, io)
    })
  }

  /**
   * 删除 HCPR（自管锁）：lock → BWObject.delete(lockHandle)。
   * 删除路径与 ADSO/TRFN/DTP 同形。
   */
  async delete(hcprId: string, options?: { transport?: string }) {
    const lock = await hcpr.lockHCPR(this.h, hcprId)
    const obj = new bwObject.BWObject(this.h, bwObject.BWObjectType.HCPR, hcprId)
    return obj.delete({
      lockHandle: lock.lockHandle,
      transport: options?.transport
    })
  }
}
