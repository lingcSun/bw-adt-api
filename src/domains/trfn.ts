import { AdtHTTP } from "../AdtHTTP"
import * as trfn from "../api/transformation"

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
}
