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
   * DTP 是否存在（动词族审计补齐）。转发 validateDTPExists 并归一为 boolean。
   * 实测（API_REFERENCE validateDTPExists 行）：存在 → valid=true；
   * 不存在 → validation 端点直接报错而非 valid=false——AdtError（含 not-found
   * 形态；消息可能随 BW_LANGUAGE 本地化，不做消息匹配）归 false。
   * HttpClientException（网络/会话等传输层失败）原样重抛——网络故障不伪装成
   * 「不存在」（语义见 2026-09-22-exists-error-semantics.md）。
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
   * Advanced 子面：调用方持锁原语（lock/unlock/activate/update），逐参镜像
   * api 层裸函数——锁的获取与释放归调用方，与门面自管动词
   * （activate/saveAndActivate/delete：内部 lock→…→unlock/finally）的锁契约
   * 相互隔离。子面访问器，不属于 verbs 家族表（domain-registry 一致性断言
   * 显式排除 `advanced`）。弃用的 flat 方法（client.lockDTP 等）由此有了
   * 正名入口。
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
   * 删除 DTP（自管锁）：内部先取域锁（lockDTP，stateful）→ BWObject.delete
   * lockHandle 模式（VERIFIED_APIS §8 W1——本地 DTP 实测 200 + 回读消失）→
   * 成功即返回、**不再**域级 unlock——删除即释放锁（真机卡带 lock→DELETE /m
   * 全 200）。delete 失败时锁还挂着，做一次 best-effort unlock（吞错，不掩盖
   * 原异常）再上抛。可选 transport 作 corrNr——必须是请求号而非任务号
   * （见 BWObject.delete）。0.x 行为变化（2026-09-22）：lockHandle 不再是调用方
   * 输入；此前只能经已弃用的 flat client.lockDTP 自取锁，锁的获取倒挂在调用方身上。
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
