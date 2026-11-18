import { AdtHTTP, isHttpClientException } from "../AdtHTTP"
import * as dtp from "../api/dtp"
import * as bwObject from "../api/bwObject"

/** Public facade for dataFlow · DTP. */
export class DtpDomain {
  constructor(private readonly h: AdtHTTP) {}

  details(dtpId: string, forceCacheUpdate?: boolean) {
    return dtp.getDTPDetails(this.h, dtpId, forceCacheUpdate)
  }

  xml(dtpId: string, forceCacheUpdate?: boolean) {
    return dtp.getDTPXml(this.h, dtpId, forceCacheUpdate)
  }

  versions(dtpId: string) {
    return dtp.getDTPVersions(this.h, dtpId)
  }

  check(dtpId: string) {
    return dtp.checkDTP(this.h, dtpId)
  }

  /**
   * DTP 是否存在。转发 validateDTPExists 并归一为 boolean。
   * 存在 → true；不存在时 validation 端点常直接报错 → 归 false。
   * HttpClientException 原样重抛，不伪装成「不存在」。
   */
  async exists(dtpId: string) {
    try {
      const result = await dtp.validateDTPExists(this.h, dtpId)
      return result.valid
    } catch (e) {
      if (isHttpClientException(e)) throw e
      return false
    }
  }

  /**
   * Activate DTP（自管锁）：锁→激活→解锁。
   * unlock 失败吞错，不掩盖激活原异常。调用方持锁用 `.advanced.activate`。
   */
  async activate(dtpId: string) {
    const lockResult = await dtp.lockDTP(this.h, dtpId)
    try {
      const result = await dtp.activateDTP(this.h, dtpId, lockResult.lockHandle)
      return { lockHandle: lockResult.lockHandle, ...result }
    } finally {
      try {
        await dtp.unlockDTP(this.h, dtpId)
      } catch {
        // 吞错，不掩盖原异常
      }
    }
  }

  saveAndActivate(
    dtpId: string,
    xmlContent: string,
    options?: dtp.SaveAndActivateDTPOptions
  ) {
    return dtp.saveAndActivateDTP(this.h, dtpId, xmlContent, options)
  }

  execute(dtpId: string) {
    return dtp.executeDTP(this.h, dtpId)
  }

  /**
   * Advanced 子面：调用方持锁原语（lock/unlock/activate/update）。
   * 与门面自管动词锁契约隔离；不属于 verbs 家族表。
   */
  get advanced() {
    return Object.freeze({
      lock: (dtpId: string) => dtp.lockDTP(this.h, dtpId),
      unlock: (dtpId: string) => dtp.unlockDTP(this.h, dtpId),
      activate: (dtpId: string, lockHandle?: string, corrNr?: string) =>
        dtp.activateDTP(this.h, dtpId, lockHandle ?? "", corrNr ?? ""),
      update: (
        dtpId: string,
        xmlContent: string,
        io: { lockHandle: string; transport?: string }
      ) => dtp.updateDTP(this.h, dtpId, xmlContent, io)
    })
  }

  /**
   * 删除 DTP（自管锁）：lock → BWObject.delete(lockHandle)。
   * 成功路径由 delete 内部 unlock；失败时 best-effort unlock 后上抛。
   * 可选 transport 作 corrNr（须为请求号）。
   */
  async delete(dtpId: string, options?: { transport?: string }) {
    const lock = await dtp.lockDTP(this.h, dtpId)
    try {
      return await bwObject
        .createBWObject(this.h, bwObject.BWObjectType.DTP, dtpId)
        .delete({ lockHandle: lock.lockHandle, transport: options?.transport })
    } catch (e) {
      try {
        await dtp.unlockDTP(this.h, dtpId)
      } catch {
        // best-effort：unlock 失败不掩盖 delete 的原异常
      }
      throw e
    }
  }
}
