import { AdtHTTP, isHttpClientException } from "../AdtHTTP"
import * as trfn from "../api/transformation"
import * as bwObject from "../api/bwObject"

/** Public facade for dataFlow · Transformation. */
export class TrfnDomain {
  constructor(private readonly h: AdtHTTP) {}

  details(trfnId: string, version?: "m" | "a" | "d", options?: trfn.GetTransformationOptions) {
    return trfn.getTransformationDetails(this.h, trfnId, version, options)
  }

  xml(trfnId: string, version?: "m" | "a" | "d", options?: trfn.GetTransformationOptions) {
    return trfn.getTransformationXml(this.h, trfnId, version ?? "m", options)
  }

  versions(trfnId: string) {
    return trfn.getTransformationVersions(this.h, trfnId)
  }

  check(trfnId: string) {
    return trfn.checkTransformation(this.h, trfnId)
  }

  /**
   * Transformation 是否存在（动词族审计补齐）。转发 validateTransformationExists
   * 并归一为 boolean。实测（API_REFERENCE validateTransformationExists 行）：
   * 存在 → valid=true；不存在 → validation 端点直接报错而非 valid=false——
   * AdtError（含 not-found 形态；消息可能随 BW_LANGUAGE 本地化，不做消息匹配）
   * 归 false。HttpClientException（传输层失败）原样重抛——网络故障不伪装成
   * 「不存在」（语义见 2026-09-22-exists-error-semantics.md）。
   */
  async exists(trfnId: string) {
    try {
      const result = await trfn.validateTransformationExists(this.h, trfnId)
      return result.valid
    } catch (e) {
      if (isHttpClientException(e)) throw e
      return false
    }
  }

  saveAndActivate(
    trfnId: string,
    xmlContent: string,
    options?: trfn.SaveAndActivateTransformationOptions
  ) {
    return trfn.saveAndActivateTransformation(this.h, trfnId, xmlContent, options)
  }

  /**
   * 创建 TRFN（8TRANSIENT 瞬态流，api 层 createTransformation 的门面转发）。
   * 2026-09-19 复测 F6：门面此前缺创建入口，只能绕到 client/BWAdtClient。
   */
  create(options: trfn.CreateTransformationOptions) {
    return trfn.createTransformation(this.h, options)
  }

  async setEndRoutineFields(
    trfnId: string,
    fieldNames: string[],
    options?: trfn.SaveAndActivateTransformationOptions
  ) {
    let xml = await trfn.getTransformationXml(this.h, trfnId, "m", {
      forceCacheUpdate: true
    })
    for (const name of fieldNames) {
      xml = trfn.addFieldToEndRoutine(xml, name)
    }
    return trfn.saveAndActivateTransformation(this.h, trfnId, xml, {
      ...options,
      transportDescription:
        options?.transportDescription ||
        `API set end routine fields: ${fieldNames.join(",")}`
    })
  }

  ensureEndRoutine(trfnId: string, options?: trfn.EnsureRoutineOptions) {
    return trfn.ensureEndRoutine(this.h, trfnId, options)
  }

  ensureStartRoutine(trfnId: string, options?: trfn.EnsureRoutineOptions) {
    return trfn.ensureStartRoutine(this.h, trfnId, options)
  }

  switchRuntime(xmlContent: string, useHanaRuntime: boolean) {
    return trfn.switchTransformationRuntime(xmlContent, useHanaRuntime)
  }

  /**
   * Advanced 子面：调用方持锁原语（lock/unlock/activate/update），逐参镜像
   * api 层裸函数——锁的获取与释放归调用方，与门面自管动词
   * （saveAndActivate/delete：内部 lock→…→unlock/finally）的锁契约相互隔离。
   * 子面访问器，不属于 verbs 家族表（domain-registry 一致性断言显式排除
   * `advanced`）。弃用的 flat 方法（client.lockTransformation 等）由此有了
   * 正名入口。
   */
  get advanced() {
    return Object.freeze({
      lock: (trfnId: string) => trfn.lockTransformation(this.h, trfnId),
      unlock: (trfnId: string) => trfn.unlockTransformation(this.h, trfnId),
      activate: (trfnId: string, lockHandle?: string) =>
        trfn.activateTransformation(this.h, trfnId, lockHandle ?? ""),
      update: (
        trfnId: string,
        xmlContent: string,
        io: trfn.UpdateTransformationOptions,
        version: "m" | "a" | "d" = "m"
      ) => trfn.updateTransformation(this.h, trfnId, xmlContent, io, version)
    })
  }

  /**
   * 删除 Transformation（自管锁）：内部先取域锁（lockTransformation，stateful）→
   * BWObject.delete lockHandle 模式（VERIFIED_APIS 第 6/8 节端到端实测）→ 成功即
   * 返回、不追加门面级 unlock——BWObject.delete 内部已含一次吞错的 unlock
   * （bwObject.ts），卡带证据为 lock→DELETE→unlock 全 200；delete 失败时锁还
   * 挂着，做一次 best-effort unlock（吞错，不掩盖原异常）再上抛。
   * 可选 transport 作 corrNr——必须是请求号而非任务号（见 BWObject.delete）。
   * 0.x 行为变化（2026-09-22）：lockHandle 不再是调用方输入；此前只能经已弃用的
   * flat client.lockTransformation 自取锁，锁的获取倒挂在调用方身上。
   */
  async delete(trfnId: string, options?: { transport?: string }) {
    const lock = await trfn.lockTransformation(this.h, trfnId)
    try {
      return await bwObject
        .createBWObject(this.h, bwObject.BWObjectType.TRANSFORMATION, trfnId)
        .delete({ lockHandle: lock.lockHandle, transport: options?.transport })
    } catch (e) {
      try {
        await trfn.unlockTransformation(this.h, trfnId)
      } catch {
        // best-effort：unlock 失败不掩盖 delete 的原异常
      }
      throw e
    }
  }
}
