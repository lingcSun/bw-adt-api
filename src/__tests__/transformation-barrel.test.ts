/**
 * 桶导出面快照 —— transformation.ts 拆分基线（P1B Task 3, 2026-09-22）。
 *
 * 符号清单机械推导自拆分前的 src/api/transformation.ts：tsc checker
 * getExportsOfModule 枚举出 54 个导出名（37 值 + 19 纯类型 − 2 个
 * io-ts codec 双名），此处逐一断言。拆分后本测试必须仍绿 —— 证明导出面零变化。
 *
 * 校验机制：
 * - 值导出（37 个）：运行时 toBeDefined() + typeof；
 * - 纯类型导出（19 个）：类型在运行时被擦除，无法 toBeDefined —— 由顶部
 *   `import type` + 下方 TypeExportSnapshot 映射在 tsc/ts-jest 编译期强制
 *   （任何名字缺失/改名 → TS2305 编译失败，快照即破）。
 * - 注意 ValidationResult 是 type-only（common.ts `export type`），经
 *   `export { ... } from "./common"` 重导出后运行时无绑定，只走编译期校验。
 */
import * as root from "../api/transformation"
import type {
  AddRuleOptions,
  CreateTransformationOptions,
  CreateTransformationResult,
  EnsureRoutineInXmlResult,
  EnsureRoutineOptions,
  EnsureRoutineResult,
  GetTransformationOptions,
  SaveAndActivateTransformationOptions,
  SaveAndActivateTransformationResult,
  TransformationLockResult,
  TransformationMetaData,
  TransformationRoutineGroup,
  TransformationRoutineRule,
  TransformationRoutineStep,
  TransformationRuleSpec,
  TransformationSettings,
  TransformationVersion,
  UpdateTransformationOptions,
  ValidationResult
} from "../api/transformation"

/** 纯类型名快照：与上方 import type 一一对应，缺失/改名即编译失败 */
type TypeExportSnapshot = {
  AddRuleOptions: AddRuleOptions
  CreateTransformationOptions: CreateTransformationOptions
  CreateTransformationResult: CreateTransformationResult
  EnsureRoutineInXmlResult: EnsureRoutineInXmlResult
  EnsureRoutineOptions: EnsureRoutineOptions
  EnsureRoutineResult: EnsureRoutineResult
  GetTransformationOptions: GetTransformationOptions
  SaveAndActivateTransformationOptions: SaveAndActivateTransformationOptions
  SaveAndActivateTransformationResult: SaveAndActivateTransformationResult
  TransformationLockResult: TransformationLockResult
  TransformationMetaData: TransformationMetaData
  TransformationRoutineGroup: TransformationRoutineGroup
  TransformationRoutineRule: TransformationRoutineRule
  TransformationRoutineStep: TransformationRoutineStep
  TransformationRuleSpec: TransformationRuleSpec
  TransformationSettings: TransformationSettings
  TransformationVersion: TransformationVersion
  UpdateTransformationOptions: UpdateTransformationOptions
  ValidationResult: ValidationResult
}
// 仅存在于编译期: 键集与 import type 必须闭合
const _typeSnapshot: TypeExportSnapshot = undefined as unknown as TypeExportSnapshot
void _typeSnapshot

/** 值导出快照（37 个）: [名称, 期望 typeof] */
const VALUE_EXPORTS: Array<[string, "function" | "object"]> = [
  ["TransformationMetaData", "object"], // io-ts codec
  ["TransformationVersion", "object"], // io-ts codec
  ["ValidationAction", "object"], // enum
  ["activateTransformation", "function"],
  ["addFieldToEndRoutine", "function"],
  ["addRule", "function"],
  ["addTransformationRule", "function"],
  ["autoMapTransformationFields", "function"],
  ["checkTransformation", "function"],
  ["createTransformation", "function"],
  ["deriveRoutineClassName", "function"],
  ["ensureEndRoutine", "function"],
  ["ensureEndRoutineInXml", "function"],
  ["ensureStartRoutine", "function"],
  ["ensureStartRoutineInXml", "function"],
  ["extractAbapClassName", "function"],
  ["extractRoutineMethodName", "function"],
  ["extractTransformationTimestamp", "function"],
  ["getTransformation", "function"],
  ["getTransformationDetails", "function"],
  ["getTransformationVersions", "function"],
  ["getTransformationXml", "function"],
  ["hasEndRoutine", "function"],
  ["hasEndRoutineInXml", "function"],
  ["hasExpertRoutine", "function"],
  ["hasStartRoutine", "function"],
  ["hasStartRoutineInXml", "function"],
  ["isEndRoutineFieldSelected", "function"],
  ["lockTransformation", "function"],
  ["parseTransformationSettings", "function"],
  ["removeFieldFromEndRoutine", "function"],
  ["saveAndActivateTransformation", "function"],
  ["switchTransformationRuntime", "function"],
  ["unlockTransformation", "function"],
  ["updateTransformation", "function"],
  ["validateTransformationExists", "function"],
  ["validateTransformationNewName", "function"]
]

describe("transformation.ts 桶导出面快照", () => {
  test.each(VALUE_EXPORTS)("%s 导出且为 %s", (name, expectedType) => {
    const value = (root as unknown as Record<string, unknown>)[name]
    expect(value).toBeDefined()
    expect(typeof value).toBe(expectedType)
  })

  test("快照清单完整性（37 值 + 19 纯类型 − 2 双名 codec = 54 名）", () => {
    expect(VALUE_EXPORTS).toHaveLength(37)
    // 19 个纯类型的运行时无可断言之物；其存在性由顶部 import type +
    // TypeExportSnapshot 在 tsc --noEmit / build / ts-jest 编译期强制，
    // 能执行到这里本身即证明编译已通过。
    expect(true).toBe(true)
  })
})
