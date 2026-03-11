import * as t from "io-ts"
import { fullParse, xmlNodeAttr, xmlArray, xmlNode, orUndefined } from "../utilities"
import { AdtHTTP } from "../AdtHTTP"
import { ActivationResult, ActivationMessage, LockResult, activateObject, parseActivationResponse, parseLockResponse, parseObjectVersions, ValidationAction, ValidationResult } from "./common"
import { BWObject, BWObjectType } from "./bwObject"
import { TransformationDetails } from "./types"

// ============================================================================
// Types and Codecs for Transformation
// ============================================================================

// Re-export common types as Transformation-specific types for compatibility
export type TransformationLockResult = LockResult

// Re-export Validation types for convenience
export { ValidationAction, ValidationResult } from "./common"

/**
 * Transformation Metadata
 */
export const TransformationMetaData = t.type({
  name: t.string,
  source: t.string,      // 源对象
  target: t.string,      // 目标对象
  description: orUndefined(t.string),
  objVers: orUndefined(t.string)  // M=Active, A=Modified, D=Revised
})

export type TransformationMetaData = t.OutputOf<typeof TransformationMetaData>

/**
 * Transformation Version - 转换版本信息
 */
export const TransformationVersion = t.type({
  version: t.string,           // m=active, a=modified, d=revised
  uri: t.string,
  created: orUndefined(t.string),
  user: orUndefined(t.string),
  description: orUndefined(t.string)
})

export type TransformationVersion = t.OutputOf<typeof TransformationVersion>

// TransformationDetails is now imported from types.ts to avoid duplication

// ============================================================================
// API Functions
// ============================================================================

/**
 * Lock Transformation - 锁定转换
 *
 * 对应请求: POST /sap/bw/modeling/trfn/{trfn_id}?action=lock
 *
 * @param client - ADT HTTP 客户端
 * @param trfnId - Transformation ID
 * @returns 锁定结果（包含 lockHandle）
 */
export async function lockTransformation(
  client: AdtHTTP,
  trfnId: string
): Promise<TransformationLockResult> {
  const obj = new BWObject(client, BWObjectType.TRANSFORMATION, trfnId)
  return obj.lock()
}

/**
 * Unlock Transformation - 解锁转换
 *
 * 对应请求: POST /sap/bw/modeling/trfn/{trfn_id}?action=unlock
 *
 * @param client - ADT HTTP 客户端
 * @param trfnId - Transformation ID
 */
export async function unlockTransformation(
  client: AdtHTTP,
  trfnId: string
): Promise<void> {
  const obj = new BWObject(client, BWObjectType.TRANSFORMATION, trfnId)
  return obj.unlock()
}

/**
 * Get Transformation Options - 获取转换选项
 */
export interface GetTransformationOptions {
  forceCacheUpdate?: boolean
}

/**
 * Get Transformation Metadata - 获取转换元数据
 *
 * 对应请求: GET /sap/bw/modeling/trfn/{trfn_id}/{version}?forceCacheUpdate=true
 *
 * @param client - ADT HTTP 客户端
 * @param trfnId - Transformation ID
 * @param version - 版本 (m=active, a=modified, d=revised)
 * @param options - 获取选项
 * @returns Transformation 元数据
 */
export async function getTransformation(
  client: AdtHTTP,
  trfnId: string,
  version: "m" | "a" | "d" = "m",
  options?: GetTransformationOptions
): Promise<any> {
  const qs: Record<string, string> = {}
  if (options?.forceCacheUpdate) {
    qs.forceCacheUpdate = "true"
  }

  const response = await client.request(`/sap/bw/modeling/trfn/${trfnId}/${version}`, {
    method: "GET",
    qs,
    headers: {
      "Accept": "application/vnd.sap.bw.modeling.trfn-v1_0_0+xml"
    }
  })

  return fullParse(response.body)
}

/**
 * Get Transformation Details - 获取转换详细信息（解析后）
 *
 * @param client - ADT HTTP 客户端
 * @param trfnId - Transformation ID
 * @param version - 版本 (m=active, a=modified, d=revised)
 * @param options - 获取选项
 * @returns 转换详细信息
 */
export async function getTransformationDetails(
  client: AdtHTTP,
  trfnId: string,
  version: "m" | "a" | "d" = "m",
  options?: GetTransformationOptions
): Promise<TransformationDetails> {
  const raw = await getTransformation(client, trfnId, version, options)
  return parseTransformationDetails(raw)
}

/**
 * Get Transformation Versions - 获取转换版本历史
 *
 * 对应请求: GET /sap/bw/modeling/trfn/{trfn_id}/versions
 *
 * @param client - ADT HTTP 客户端
 * @param trfnId - Transformation ID
 * @returns 版本历史列表
 */
export async function getTransformationVersions(
  client: AdtHTTP,
  trfnId: string
): Promise<TransformationVersion[]> {
  const obj = new BWObject(client, BWObjectType.TRANSFORMATION, trfnId)
  return obj.getVersions()
}

// ============================================================================
// Validation Functions (using BWObject base class)
// ============================================================================

/**
 * Validate Transformation Exists - 验证转换是否存在
 *
 * @param client - ADT HTTP 客户端
 * @param trfnId - Transformation ID
 * @returns 验证结果
 */
export async function validateTransformationExists(
  client: AdtHTTP,
  trfnId: string
): Promise<ValidationResult> {
  const obj = new BWObject(client, BWObjectType.TRANSFORMATION, trfnId)
  return obj.exists()
}

/**
 * Validate New Transformation Name - 验证新转换名称是否可用
 *
 * @param client - ADT HTTP 客户端
 * @param trfnId - Transformation ID
 * @returns 验证结果
 */
export async function validateTransformationNewName(
  client: AdtHTTP,
  trfnId: string
): Promise<ValidationResult> {
  const obj = new BWObject(client, BWObjectType.TRANSFORMATION, trfnId)
  return obj.isNewNameAvailable()
}

/**
 * Validate Transformation Can Delete - 验证转换是否可删除
 *
 * @param client - ADT HTTP 客户端
 * @param trfnId - Transformation ID
 * @returns 验证结果
 */
export async function validateTransformationCanDelete(
  client: AdtHTTP,
  trfnId: string
): Promise<ValidationResult> {
  const obj = new BWObject(client, BWObjectType.TRANSFORMATION, trfnId)
  return obj.canDelete()
}

/**
 * Validate Transformation Can Activate - 验证转换是否可激活
 *
 * @param client - ADT HTTP 客户端
 * @param trfnId - Transformation ID
 * @returns 验证结果
 */
export async function validateTransformationCanActivate(
  client: AdtHTTP,
  trfnId: string
): Promise<ValidationResult> {
  const obj = new BWObject(client, BWObjectType.TRANSFORMATION, trfnId)
  return obj.canActivate()
}

/**
 * Check Transformation - 检查转换一致性
 *
 * 对应请求: POST /sap/bw/modeling/activation (检查模式)
 *
 * @param client - ADT HTTP 客户端
 * @param trfnId - Transformation ID
 * @returns 检查结果
 */
export async function checkTransformation(
  client: AdtHTTP,
  trfnId: string
): Promise<ActivationResult> {
  const obj = new BWObject(client, BWObjectType.TRANSFORMATION, trfnId)
  return obj.check()
}

/**
 * Update Transformation Options - 更新转换选项
 */
export interface UpdateTransformationOptions {
  lockHandle: string
  corrNr?: string
  timestamp?: string
}

/**
 * Update Transformation - 更新转换内容
 *
 * 对应请求: PUT /sap/bw/modeling/trfn/{trfn_id}/{version}?lockHandle={lockHandle}
 *
 * @param client - ADT HTTP 客户端
 * @param trfnId - Transformation ID
 * @param xmlContent - Transformation XML 内容（完整的 transformation 定义）
 * @param options - 更新选项
 * @returns 更新结果
 */
export async function updateTransformation(
  client: AdtHTTP,
  trfnId: string,
  xmlContent: string,
  options: UpdateTransformationOptions,
  version: "m" | "a" | "d" = "m"
): Promise<ActivationResult> {
  const { lockHandle, corrNr, timestamp } = options

  const qs: Record<string, string> = {
    lockHandle
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/xml, application/vnd.sap.bw.modeling.trfn-v1_0_0+xml",
    "Accept": "application/vnd.sap.bw.modeling.trfn-v1_0_0+xml"
  }

  if (timestamp) {
    headers["timestamp"] = timestamp
  }

  const response = await client.request(
    `/sap/bw/modeling/trfn/${trfnId}/${version}`,
    {
      method: "PUT",
      qs,
      headers,
      body: xmlContent
    }
  )

  return parseActivationResponse(response.body)
}

/**
 * Activate Transformation - 激活转换
 *
 * @param client - ADT HTTP 客户端
 * @param trfnId - Transformation ID
 * @returns 激活结果
 */
export async function activateTransformation(
  client: AdtHTTP,
  trfnId: string
): Promise<ActivationResult> {
  const obj = new BWObject(client, BWObjectType.TRANSFORMATION, trfnId)
  return obj.activate()
}

/**
 * Parse Transformation Versions Response - 解析转换版本历史响应
 */
function parseTransformationVersions(body: string): TransformationVersion[] {
  const parsed = fullParse(body)
  const feed = xmlNode(parsed, "atom:feed")

  if (!feed) {
    return []
  }

  const entries = xmlArray(feed, "atom:entry")

  return entries.map((entry: any) => {
    const id = xmlNode(entry, "atom:id") || ""
    const title = xmlNode(entry, "atom:title") || ""
    const updated = xmlNode(entry, "atom:updated") || ""
    const author = xmlNode(entry, "atom:author")
    const userName = author ? xmlNode(author, "atom:name") : undefined
    const links = xmlArray(entry, "atom:link")

    // Extract version from URI or link
    const selfLink = links.find((link: any) => link["@_rel"] === "self")
    let uri = (selfLink as any)?.["@_href"] || id
    // 确保 uri 是字符串
    if (uri && typeof uri !== "string") {
      uri = String(uri)
    }

    // Parse version from URI (last segment like /m, /a, /d)
    const versionMatch = uri.match(/\/([mad])$/)
    const version = versionMatch ? versionMatch[1] : "m"

    // Map version codes to descriptions
    const versionMap: Record<string, string> = {
      "m": "Active",
      "a": "Modified",
      "d": "Revised"
    }

    return {
      version,
      uri,
      description: versionMap[version] || version,
      created: updated,
      user: userName
    }
  })
}

/**
 * Parse Transformation Details - 解析转换详细信息
 */
function parseTransformationDetails(raw: any): TransformationDetails {
  // The raw response structure may vary, extract key information
  // This is a simplified parser - adjust based on actual response format

  const root = raw["trfn:transformation"] || raw
  const name = root["trfn:name"] || root["name"] || ""

  return {
    name,
    technicalName: name,  // Use same value for technicalName
    source: root["trfn:source"] || root["source"] || "",
    target: root["trfn:target"] || root["target"] || "",
    description: root["trfn:description"] || root["description"],
    objVers: root["trfn:objVers"] || root["objVers"] || "M",
    sourceType: root["trfn:sourceType"],
    targetType: root["trfn:targetType"],
    ruleCount: root["trfn:ruleCount"],
    status: root["trfn:status"]
  }
}

// ============================================================================
// Helper Functions for Transformation Routine Management
// ============================================================================

/**
 * Transformation Routine Step - 转换例程步骤信息
 */
export interface TransformationRoutineStep {
  type: string          // ROUTINE, DIRECT, etc.
  classNameM?: string   // ABAP 类名 (当 type=ROUTINE 时)
  methodNameM?: string  // ABAP 方法名 (当 type=ROUTINE 时)
  hanaRuntime?: boolean // HANA 运行时标志
  rank?: string         // MAIN, BEFORE, AFTER
}

/**
 * Transformation Routine Rule - 转换例程规则
 */
export interface TransformationRoutineRule {
  id: string
  description?: string
  routineType?: string  // START, END, EXPERT
  step?: TransformationRoutineStep
}

/**
 * Transformation Routine Group - 转换例程组
 */
export interface TransformationRoutineGroup {
  id: string
  description?: string
  type: string          // G=Routine Group, S=Standard Rules, T=Technical Rules
  rules?: TransformationRoutineRule[]
}

/**
 * Parsed Transformation Settings - 解析后的转换设置
 */
export interface TransformationSettings {
  name: string
  description: string
  hanaRuntime: boolean  // HANARuntime attribute
  abapProgram: string   // abapProgram attribute
  hapProgram: string    // hapProgram attribute
  startRoutine: string  // startRoutine attribute
  endRoutine: string    // endRoutine attribute
  expertRoutine: string // expertRoutine attribute
  allowCurrencyAndUnitConversion: boolean
  enableCurrencyAndUnitConversion: boolean
  enableErrorHandlingInRoutines: boolean
  // 新增：例程相关信息
  routineClassName?: string    // 从 Routine Group 的 step 中提取的类名
  routineMethodName?: string   // 从 Routine Group 的 step 中提取的方法名
  hasStartRoutine?: boolean    // 是否存在开始例程
  hasEndRoutine?: boolean      // 是否存在结束例程
  hasExpertRoutine?: boolean   // 是否存在专家例程
}

/**
 * Parse Transformation Settings - 解析转换设置（从完整 XML）
 *
 * 从转换 XML 中提取关键设置，包括运行时模式和 ABAP 类名
 *
 * @param raw - 原始转换 XML 解析结果
 * @returns 解析后的转换设置
 */
export function parseTransformationSettings(raw: any): TransformationSettings | undefined {
  const root = raw["trfn:transformation"] || raw
  if (!root) return undefined

  // 提取 Routine Group 中的类名和方法名
  const routineInfo = extractRoutineInfo(root)

  return {
    name: root["@_name"] || root["name"] || "",
    description: root["@_description"] || root["description"] || "",
    hanaRuntime: root["@_HANARuntime"] === "true" || root["@_HANARuntime"] === true,
    abapProgram: root["@_abapProgram"] || root["abapProgram"] || "",
    hapProgram: root["@_hapProgram"] || root["hapProgram"] || "",
    startRoutine: root["@_startRoutine"] || root["startRoutine"] || "",
    endRoutine: root["@_endRoutine"] || root["endRoutine"] || "",
    expertRoutine: root["@_expertRoutine"] || root["expertRoutine"] || "",
    allowCurrencyAndUnitConversion: root["@_allowCurrencyAndUnitConversion"] === "true" || root["@_allowCurrencyAndUnitConversion"] === true,
    enableCurrencyAndUnitConversion: root["@_enableCurrencyAndUnitConversion"] === "true" || root["@_enableCurrencyAndUnitConversion"] === true,
    enableErrorHandlingInRoutines: root["@_enableErrorHandlingInRoutines"] === "true" || root["@_enableErrorHandlingInRoutines"] === true,
    routineClassName: routineInfo.className,
    routineMethodName: routineInfo.methodName,
    hasStartRoutine: routineInfo.hasStartRoutine,
    hasEndRoutine: routineInfo.hasEndRoutine,
    hasExpertRoutine: routineInfo.hasExpertRoutine
  }
}

/**
 * Extract Routine Info - 从 Routine Group 中提取例程信息
 *
 * @param root - Transformation XML 根节点
 * @returns 例程信息
 */
function extractRoutineInfo(root: any): {
  className?: string
  methodName?: string
  hasStartRoutine: boolean
  hasEndRoutine: boolean
  hasExpertRoutine: boolean
} {
  const groups = xmlArray(root, "group") || xmlArray(root, "trfn:group")

  let className: string | undefined
  let methodName: string | undefined
  let hasStartRoutine = false
  let hasEndRoutine = false
  let hasExpertRoutine = false

  for (const group of groups) {
    const g = group as any
    const groupType = g["@_type"] || g["type"]

    // Routine Group (type="G") 包含例程信息
    if (groupType === "G") {
      const rules = xmlArray(g, "rule") || xmlArray(g, "trfn:rule")
      for (const rule of rules) {
        const r = rule as any
        const routineType = r["@_routinetype"] || r["routinetype"]
        const steps = xmlArray(r, "step") || xmlArray(r, "trfn:step")

        for (const step of steps) {
          const s = step as any
          const stepType = s["@_type"] || s["type"]
          if (stepType === "ROUTINE") {
            className = s["@_classNameM"] || s["classNameM"]
            methodName = s["@_methodNameM"] || s["methodNameM"]

            if (routineType === "START") hasStartRoutine = true
            if (routineType === "END") hasEndRoutine = true
            if (routineType === "EXPERT") hasExpertRoutine = true
          }
        }
      }
    }
  }

  return { className, methodName, hasStartRoutine, hasEndRoutine, hasExpertRoutine }
}

/**
 * Extract ABAP Class Name from Transformation - 从转换中提取 ABAP 类名
 *
 * 优先级：
 * 1. 从 Routine Group 的 step.classNameM 属性提取（最可靠）
 * 2. 通过命名约定从 Transformation ID 推导
 *
 * @param raw - 原始转换 XML 解析结果
 * @returns ABAP 类名或 undefined
 */
export function extractAbapClassName(raw: any): string | undefined {
  const root = raw["trfn:transformation"] || raw
  if (!root) return undefined

  // 方法1: 优先从 Routine Group 的 step.classNameM 提取
  const groups = xmlArray(root, "group") || xmlArray(root, "trfn:group")
  for (const group of groups) {
    const g = group as any
    const groupType = g["@_type"] || g["type"]
    if (groupType === "G") {
      const rules = xmlArray(g, "rule") || xmlArray(g, "trfn:rule")
      for (const rule of rules) {
        const r = rule as any
        const steps = xmlArray(r, "step") || xmlArray(r, "trfn:step")
        for (const step of steps) {
          const s = step as any
          const stepType = s["@_type"] || s["type"]
          if (stepType === "ROUTINE") {
            const className = s["@_classNameM"] || s["classNameM"]
            if (className) return className
          }
        }
      }
    }
  }

  // 方法2: 通过命名约定推导
  const trfnName = root["@_name"] || root["name"]
  if (trfnName && typeof trfnName === "string") {
    // 去掉前导 "0"，添加 /BIC/3M 前缀和 _M 后缀
    const suffix = trfnName.startsWith("0") ? trfnName.substring(1) : trfnName
    return `/BIC/3M${suffix}_M`
  }

  return undefined
}

/**
 * Extract Routine Method Name from Transformation - 从转换中提取例程方法名
 *
 * @param raw - 原始转换 XML 解析结果
 * @returns 方法名或 undefined
 */
export function extractRoutineMethodName(raw: any): string | undefined {
  const root = raw["trfn:transformation"] || raw
  if (!root) return undefined

  const groups = xmlArray(root, "group") || xmlArray(root, "trfn:group")
  for (const group of groups) {
    const g = group as any
    const groupType = g["@_type"] || g["type"]
    if (groupType === "G") {
      const rules = xmlArray(g, "rule") || xmlArray(g, "trfn:rule")
      for (const rule of rules) {
        const r = rule as any
        const steps = xmlArray(r, "step") || xmlArray(r, "trfn:step")
        for (const step of steps) {
          const s = step as any
          const stepType = s["@_type"] || s["type"]
          if (stepType === "ROUTINE") {
            const methodName = s["@_methodNameM"] || s["methodNameM"]
            if (methodName) return methodName
          }
        }
      }
    }
  }

  return undefined
}

/**
 * Switch Transformation Runtime Mode - 切换转换运行时模式
 *
 * 修改转换 XML 中的 HANARuntime 属性以切换运行时模式
 *
 * @param xmlContent - 原始转换 XML 内容
 * @param useHanaRuntime - 是否使用 HANA 运行时 (true=HANA, false=ABAP)
 * @returns 修改后的 XML 内容
 */
export function switchTransformationRuntime(xmlContent: string, useHanaRuntime: boolean): string {
  // Replace HANARuntime attribute value
  const hanaPattern = /HANARuntime="(true|false)"/gi
  const replaced = xmlContent.replace(hanaPattern, `HANARuntime="${useHanaRuntime ? "true" : "false"}"`)

  return replaced
}

/**
 * Check if Transformation has Start Routine - 检查转换是否有开始例程
 *
 * @param raw - 原始转换 XML 解析结果
 * @returns 是否有开始例程
 */
export function hasStartRoutine(raw: any): boolean {
  const settings = parseTransformationSettings(raw)
  return !!settings?.hasStartRoutine
}

/**
 * Check if Transformation has End Routine - 检查转换是否有结束例程
 *
 * @param raw - 原始转换 XML 解析结果
 * @returns 是否有结束例程
 */
export function hasEndRoutine(raw: any): boolean {
  const settings = parseTransformationSettings(raw)
  return !!settings?.hasEndRoutine
}

/**
 * Check if Transformation has Expert Routine - 检查转换是否有专家例程
 *
 * @param raw - 原始转换 XML 解析结果
 * @returns 是否有专家例程
 */
export function hasExpertRoutine(raw: any): boolean {
  const settings = parseTransformationSettings(raw)
  return !!settings?.hasExpertRoutine
}
