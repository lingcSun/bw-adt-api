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
   * Transformation 是否存在。转发 validateTransformationExists 并归一为 boolean。
   * 存在 → true；不存在时 validation 端点常直接报错 → 归 false。
   * HttpClientException 原样重抛，不伪装成「不存在」。
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

  /**
   * 激活 Transformation（自管锁）：重激活已保存对象。
   * lock → activate → 始终 unlock；unlock 失败吞错。
   * 调用方持锁用 `.advanced.activate`。
   */
  async activate(trfnId: string) {
    const lock = await trfn.lockTransformation(this.h, trfnId)
    try {
      return await trfn.activateTransformation(this.h, trfnId, lock.lockHandle)
    } finally {
      try {
        await trfn.unlockTransformation(this.h, trfnId)
      } catch {
        // 吞错，不掩盖原异常
      }
    }
  }

  saveAndActivate(
    trfnId: string,
    xmlContent: string,
    options?: trfn.SaveAndActivateTransformationOptions
  ) {
    return trfn.saveAndActivateTransformation(this.h, trfnId, xmlContent, options)
  }

  /** 创建 TRFN（8TRANSIENT 瞬态流）。 */
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
   * Advanced 子面：调用方持锁原语（lock/unlock/activate/update）。
   * 与门面自管动词锁契约隔离；不属于 verbs 家族表。
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
   * 删除 Transformation（自管锁）：lock → BWObject.delete(lockHandle)。
   * 成功路径由 delete 内部 unlock；失败时 best-effort unlock 后上抛。
   * 可选 transport 作 corrNr（须为请求号）。
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
