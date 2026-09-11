import { AdtHTTP } from "../AdtHTTP"
import * as dtp from "../api/dtp"

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
   * Activate DTP with lock/unlock - 独立激活（锁→激活→解锁）。
   * 用于转换修改后 DTP 被取消激活的场景，无需改动 DTP 内容。
   */
  async activate(dtpId: string) {
    const lockResult = await dtp.lockDTP(this.h, dtpId)
    try {
      const result = await dtp.activateDTP(this.h, dtpId, lockResult.lockHandle)
      return { lockHandle: lockResult.lockHandle, ...result }
    } finally {
      await dtp.unlockDTP(this.h, dtpId)
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
}
