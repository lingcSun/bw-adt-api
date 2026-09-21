/**
 * TRFN 子域共享层 —— 低层共享助手与 settings 解析。
 *
 * P1B Task 3 从 src/api/transformation.ts 机械搬迁（函数体零修改）。
 * 家族内依赖方向: create/rules/routines → shared → (仅 utilities/io-ts)；
 * shared 不依赖 transformation.ts 及任何兄弟子域。
 */
import * as t from "io-ts"
import { orUndefined, xmlArray } from "../../utilities"

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

export function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * 计算下一条 rule 的 id (现有最大 rule id + 1)。
 * 属性顺序陷阱: 服务器水合的 rule 是 <rule description="" id="N"> (description 在前),
 * 库生成的是 <rule id="N" description=""。匹配必须容忍任意属性序, 否则对水合规则全盲。
 */
export function nextRuleId(trfnXml: string): number {
  const ids = [...trfnXml.matchAll(/<rule\b[^>]*\bid="(\d+)"/g)].map(m => parseInt(m[1], 10))
  return (ids.length ? Math.max(...ids) : 0) + 1
}

/**
 * 从 tlogoProperties/@adtcore:changedAt 提取 PUT 所需 timestamp 头
 * 例: 2026-07-15T11:59:14Z → 20260715115914
 */
export function extractTransformationTimestamp(trfnXml: string): string | undefined {
  const m = trfnXml.match(
    /adtcore:changedAt="(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/
  )
  if (!m) return undefined
  return `${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}${m[6]}`
}

/**
 * 例程 AMDP 类名约定：`/BIC/` + TRFN id 从第 13 字符起 + `_M`
 * 已验证：0OWVFWFXS8GE8R2VTBF9YQX4QMQST1TV → /BIC/8R2VTBF9YQX4QMQST1TV_M
 */
export function deriveRoutineClassName(trfnId: string): string {
  const id = String(trfnId || "").trim()
  if (id.length < 20) {
    throw new Error(
      `deriveRoutineClassName: TRFN id too short (${id.length}): ${JSON.stringify(id)}`
    )
  }
  return `/BIC/${id.slice(12)}_M`
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
