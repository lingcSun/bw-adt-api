import * as t from "io-ts"
import { fullParse, xmlArray, orUndefined } from "../utilities"
import { AdtHTTP } from "../AdtHTTP"
import { ActivationResult, LockResult, parseActivationResponse, ValidationResult } from "./common"
import { BWObject, BWObjectType } from "./bwObject"
import { TransformationDetails } from "./types"
import { withWriteSession } from "./writeSession"
import { deriveRoutineClassName, extractTransformationTimestamp } from "./trfn/shared"

// ============================================================================
// CREATE: 已支持 —— createTransformation() 走 Eclipse 同款 8TRANSIENT 瞬态流
// （铸 id → stateful+CREA lock → POST 极简 XML → 服务器按源/目标提供者水合）。
// 旧结论"创建必须 JCo/ModalContext、8TRANSIENT 手动补全仍 dump"已被证伪
// （2026-09-11 ZL_FID44 变更 REST 全程创建成功）。彼时失败的根因是保存体未与
// Eclipse 序列化对齐：缺 createdAt/createdBy、packageRef 属性不全（需
// name/type/uri 三属性）、source/target 带了 segment/element（应自闭合空节点）。
//
// 支持的操作：
// -----------
// - create (8TRANSIENT 瞬态流创建，见 createTransformation)
// - read (读取 TRFN 详情、字段映射)
// - update (修改 TRFN 内容，需先 lock)
// - activate (激活 TRFN)
// - delete (删除 TRFN，需先 lock)
// - lock/unlock (锁定/解锁 TRFN)
// - check (检查 TRFN 一致性)
// - getVersions (获取版本历史)
// ============================================================================

// ============================================================================
// Types and Codecs for Transformation
// ============================================================================

// Re-export common types as Transformation-specific types for compatibility
export type TransformationLockResult = LockResult

// Re-export Validation types for convenience
export { ValidationAction, ValidationResult } from "./common"
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

  // Eclipse setFields: PUT .../m?lockHandle=... + Transport-Lock-Holder
  const qs: Record<string, string> = { lockHandle }
  if (corrNr) qs["corrNr"] = corrNr

  const headers: Record<string, string> = {
    "Content-Type": "application/xml, application/vnd.sap.bw.modeling.trfn-v1_0_0+xml",
    "Accept": "application/vnd.sap.bw.modeling.trfn-v1_0_0+xml"
  }

  if (timestamp) {
    headers["timestamp"] = timestamp
  }
  if (corrNr) {
    headers["Transport-Lock-Holder"] = corrNr
  }

  const response = await client.request(
    `/sap/bw/modeling/trfn/${trfnId.toLowerCase()}/${version}`,
    {
      method: "PUT",
      qs,
      headers,
      body: xmlContent
    }
  )

  return parseActivationResponse(response.body)
}

export interface SaveAndActivateTransformationOptions {
  transport?: string
  createTransport?: boolean
  transportDescription?: string
  autoActivate?: boolean
  timestamp?: string
}

export interface SaveAndActivateTransformationResult {
  lockHandle: string
  transport?: string
  updateResult: ActivationResult
  activated: boolean
  activateResult?: ActivationResult
}

/**
 * Save and Activate Transformation - lock → transport → PUT → activate → unlock.
 * Session model: lock/unlock stateful; PUT/activation/transport stateless (no contextid).
 */
export async function saveAndActivateTransformation(
  client: AdtHTTP,
  trfnId: string,
  xmlContent: string,
  options?: SaveAndActivateTransformationOptions
): Promise<SaveAndActivateTransformationResult> {
  return withWriteSession(client, {
    lock: c => lockTransformation(c, trfnId),
    update: (c, xml, io) =>
      updateTransformation(c, trfnId, xml, {
        lockHandle: io.lockHandle,
        corrNr: io.corrNr,
        timestamp: io.timestamp ?? extractTransformationTimestamp(xml),
      }),
    activate: (c, lockHandle) => activateTransformation(c, trfnId, lockHandle),
    unlock: c => unlockTransformation(c, trfnId),
  }, {
    uri: `/sap/bw/modeling/trfn/${trfnId.toLowerCase()}/m`,
    xml: xmlContent,
    autoActivate: options?.autoActivate,
    timestamp: options?.timestamp,
    transport: options?.transport,
    createTransport: options?.createTransport,
    transportDescription: options?.transportDescription || "API TRFN update",
  })
}
/**
 * Get Transformation Raw XML - 获取原始 XML 字符串 (供 PUT 使用)
 */
export async function getTransformationXml(
  client: AdtHTTP,
  trfnId: string,
  version: "m" | "a" | "d" = "m",
  options?: GetTransformationOptions
): Promise<string> {
  const qs: Record<string, string> = {}
  if (options?.forceCacheUpdate) {
    qs.forceCacheUpdate = "true"
  }

  const response = await client.request(
    `/sap/bw/modeling/trfn/${trfnId.toLowerCase()}/${version}`,
    {
      method: "GET",
      qs,
      headers: {
        Accept: "application/vnd.sap.bw.modeling.trfn-v1_0_0+xml"
      }
    }
  )
  return response.body
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
  trfnId: string,
  lockHandle: string = ""
): Promise<ActivationResult> {
  const obj = new BWObject(client, BWObjectType.TRANSFORMATION, trfnId)
  return obj.activate(lockHandle)
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
    try {
      return deriveRoutineClassName(trfnName)
    } catch {
      return undefined
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

// ============================================================================
// Re-exports —— 拆分至 src/api/trfn/ 的符号按名重导出（兼容面不变, 2026-09-22）。
// 下游一律继续 import "./transformation" / "../api/transformation"。
// ============================================================================

// shared: 低层共享（codec / timestamp / 例程类名约定 / settings 解析）
export {
  TransformationMetaData,
  TransformationRoutineGroup,
  TransformationRoutineRule,
  TransformationRoutineStep,
  TransformationSettings,
  deriveRoutineClassName,
  extractRoutineMethodName,
  extractTransformationTimestamp,
  hasEndRoutine,
  hasExpertRoutine,
  hasStartRoutine,
  parseTransformationSettings
} from "./trfn/shared"

// create: 8TRANSIENT 瞬态流创建
export {
  CreateTransformationOptions,
  CreateTransformationResult,
  createTransformation
} from "./trfn/create"

// rules: 字段映射与通用规则构造
export {
  AddRuleOptions,
  TransformationRuleSpec,
  addRule,
  addTransformationRule,
  autoMapTransformationFields
} from "./trfn/rules"

// routines: 例程 ensure（HTTP 链路）与例程字段/纯 XML 构造
export {
  EnsureRoutineInXmlResult,
  EnsureRoutineOptions,
  EnsureRoutineResult,
  addFieldToEndRoutine,
  ensureEndRoutine,
  ensureEndRoutineInXml,
  ensureStartRoutine,
  ensureStartRoutineInXml,
  hasEndRoutineInXml,
  hasStartRoutineInXml,
  isEndRoutineFieldSelected,
  removeFieldFromEndRoutine
} from "./trfn/routines"
