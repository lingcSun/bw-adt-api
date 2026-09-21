import { AdtHTTP } from "../AdtHTTP"
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
   * 异常统一归 false。
   */
  async exists(trfnId: string) {
    try {
      const result = await trfn.validateTransformationExists(this.h, trfnId)
      return result.valid
    } catch {
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
   * 删除 Transformation（动词族审计补齐）：BWObject 通用删除路径，lockHandle 模式
   * （实测：VERIFIED_APIS 第 6/8 节，lock → DELETE /m?lockHandle → unlock）。
   * options 原样透传 BWObject.delete——必须 { lockHandle }（lock() 取），
   * 可选 transport 作 corrNr；缺 lockHandle 由 BWObject.delete 给出可操作报错。
   */
  delete(
    trfnId: string,
    options?: { lockHandle?: string; transport?: string }
  ) {
    return bwObject
      .createBWObject(this.h, bwObject.BWObjectType.TRANSFORMATION, trfnId)
      .delete(options ?? {})
  }
}
