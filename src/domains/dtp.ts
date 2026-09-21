import { AdtHTTP } from "../AdtHTTP"
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
   * DTP 是否存在（动词族审计补齐）。转发 validateDTPExists 并归一为 boolean。
   * 实测（API_REFERENCE validateDTPExists 行）：存在 → valid=true；
   * 不存在 → validation 端点直接报错而非 valid=false——异常统一归 false。
   */
  async exists(dtpId: string) {
    try {
      const result = await dtp.validateDTPExists(this.h, dtpId)
      return result.valid
    } catch {
      return false
    }
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

  /**
   * 删除 DTP（动词族审计补齐）：BWObject 通用删除路径，lockHandle 模式
   * （实测：VERIFIED_APIS §8 W1——本地 DTP 走 lock → DELETE /dtpa/{id}/m?lockHandle
   * → unlock，200 + 回读消失）。options 原样透传 BWObject.delete——必须
   * { lockHandle }（lock() 取），可选 transport 作 corrNr；缺 lockHandle 由
   * BWObject.delete 给出可操作报错。
   */
  delete(
    dtpId: string,
    options?: { lockHandle?: string; transport?: string }
  ) {
    return bwObject
      .createBWObject(this.h, bwObject.BWObjectType.DTP, dtpId)
      .delete(options ?? {})
  }
}
