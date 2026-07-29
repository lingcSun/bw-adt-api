import * as t from "io-ts"
import { fullParse, xmlNodeAttr, xmlArray, xmlNode, orUndefined } from "../utilities"
import { AdtHTTP } from "../AdtHTTP"
import { ActivationResult, ActivationMessage, LockResult, activateObject, parseActivationResponse, parseLockResponse, parseObjectVersions, ValidationAction, ValidationResult } from "./common"
import { BWObject, BWObjectType } from "./bwObject"
import { TransformationDetails } from "./types"

// ============================================================================
// KNOWN LIMITATION: Transformation CREATE is NOT supported via API.
//
// 技术原因：
// --------
// SAP BW ADT 使用 JCo (Java Connector) 的特殊机制来实现 TRFN 创建，
// 包括 ModalContext 执行上下文和 JCoEnqueueSystemSession (enqueue 模式)。
// 这些机制超出了纯 HTTP/REST 客户端的能力范围。
//
// 具体限制：
// ---------
// 1. JCo Enqueue 机制：
//    - 锁定操作需要在 "stateful,enqueue" 会话中执行
//    - 更新操作需要在特定的 ModalContext 上下文中进行
//    - lockHandle 在不同会话类型间的绑定由 JCo 底层维护
//
// 2. ModalContext 执行上下文：
//    - Eclipse ADT 在 ModalContext 线程中执行创建操作
//    - 该上下文维护了跨会话的状态（lockHandle、临时对象引用等）
//    - 纯 HTTP 客户端无法模拟这种执行模式
//
// 3. 8TRANSIENT 端点的限制：
//    - 返回的 XML 缺少部分必需属性
//    - 即使手动补全，服务端仍会在 CL_RSTRAN_TRFN->GET_PROGID
//      抛出 CX_SY_REF_IS_INITIAL dump
//
// 支持的操作：
// -----------
// - read (读取 TRFN 详情、字段映射)
// - update (修改 TRFN 内容，需先 lock)
// - activate (激活 TRFN)
// - delete (删除 TRFN，需先 lock)
// - lock/unlock (锁定/解锁 TRFN)
// - check (检查 TRFN 一致性)
// - getVersions (获取版本历史)
//
// 替代方案：
// ---------
// - 使用 SAP GUI 手动创建 TRFN
// - 使用 ABAP 程序批量创建
// - 创建后可使用本 API 进行其他操作
// ============================================================================

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
 * 是否已在结束例程 setFields 中勾选该目标字段
 */
export function isEndRoutineFieldSelected(trfnXml: string, fieldName: string): boolean {
  const endRule = extractEndRoutineRule(trfnXml)
  if (!endRule) return false
  return endRule.includes(`#///target/segment1/${fieldName}`)
}

/**
 * 将目标字段勾进结束例程 setFields (对照 Eclipse SetGlobalRoutineFieldsAction)
 *
 * XML 变更点:
 * 1. END rule 增加 <target id="N"><elementRef>#///target/segment1/{field}</elementRef></target>
 * 2. Rules group (type=S) 若尚无该字段映射, 增加 StepNoUpdate 规则
 *
 * 前置: 字段必须已存在于 target segment (通常 ADSO 加字段后 TRFN 结构同步后已有)
 */
export function addFieldToEndRoutine(
  trfnXml: string,
  fieldName: string
): string {
  if (isEndRoutineFieldSelected(trfnXml, fieldName)) {
    return trfnXml
  }

  const targetMeta = extractTargetElementMeta(trfnXml, fieldName)
  if (!targetMeta) {
    throw new Error(
      `Target field "${fieldName}" not found in TRFN target segment. ` +
        `Sync ADSO structure into TRFN first.`
    )
  }

  let next = insertEndRoutineTarget(trfnXml, fieldName)
  if (!hasFieldMappingRule(next, fieldName)) {
    next = insertNoUpdateRule(next, fieldName, targetMeta)
  }
  return next
}

/**
 * 从结束例程 setFields 取消勾选字段 (移除 END target + 对应 NO_UPDATE 规则)
 */
export function removeFieldFromEndRoutine(
  trfnXml: string,
  fieldName: string
): string {
  const endMatch = trfnXml.match(
    /<rule\b[^>]*routinetype="END"[^>]*>[\s\S]*?<\/rule>/
  )
  let next = trfnXml
  if (endMatch && endMatch.index !== undefined) {
    const cleaned = endMatch[0].replace(
      new RegExp(
        `\\s*<target id="\\d+">\\s*<elementRef>#///target/segment1/${fieldName}</elementRef>\\s*</target>`,
        "g"
      ),
      ""
    )
    next =
      trfnXml.slice(0, endMatch.index) +
      cleaned +
      trfnXml.slice(endMatch.index + endMatch[0].length)
  }

  // 移除专指该字段的 NO_UPDATE 规则 (属性顺序不固定: id/description 可能互换)
  return next.replace(
    new RegExp(
      `\\s*<rule\\b[^>]*>\\s*` +
        `<target\\b[^>]*>\\s*` +
        `<output>[^<]*</output>\\s*` +
        `<elementRef>#///target/segment1/${fieldName}</elementRef>\\s*` +
        `</target>\\s*` +
        `<step\\b[^>]*type="NO_UPDATE"[\\s\\S]*?</step>\\s*` +
        `</rule>`,
      "g"
    ),
    ""
  )
}

interface TargetElementMeta {
  name: string
  label: string
  dataType: string
  length?: string
  precision?: string
  scale?: string
  dimension: string
  semanticType: string
}

function extractEndRoutineRule(trfnXml: string): string | undefined {
  const m = trfnXml.match(
    /<rule\b[^>]*routinetype="END"[^>]*>[\s\S]*?<\/rule>/
  )
  return m?.[0]
}

function extractTargetElementMeta(
  trfnXml: string,
  fieldName: string
): TargetElementMeta | undefined {
  // 只在 <target ...> ... </target> 大段内找 (避免命中 source)
  const targetBlock = trfnXml.match(
    /<target\b[^>]*type="ADSO"[^>]*>[\s\S]*?<\/target>\s*<group/
  )
  const scope = targetBlock?.[0] || trfnXml

  const el = scope.match(
    new RegExp(
      `<element\\b[^>]*\\sname="${fieldName}"[^>]*>[\\s\\S]*?</element>`
    )
  )
  if (!el) return undefined

  const block = el[0]
  const label =
    block.match(/<endUserTexts[^>]*\slabel="([^"]*)"/)?.[1] || fieldName
  const inline = block.match(/<inlineType\b([^/]*)\/>/)?.[1] || ""
  const dataType = inline.match(/\sname="([^"]+)"/)?.[1] || "CHAR"
  const length = inline.match(/\slength="([^"]+)"/)?.[1]
  const precision = inline.match(/\sprecision="([^"]+)"/)?.[1]
  const scale = inline.match(/\sscale="([^"]+)"/)?.[1]
  const semanticType =
    inline.match(/\ssemanticType="([^"]+)"/)?.[1] || "empty"
  const dimension =
    block.match(/\sdimension="([^"]+)"/)?.[1] ||
    "#///target/segment1/CHA§"

  return {
    name: fieldName,
    label,
    dataType,
    length,
    precision,
    scale,
    dimension,
    semanticType
  }
}

function insertEndRoutineTarget(trfnXml: string, fieldName: string): string {
  const endRuleMatch = trfnXml.match(
    /<rule\b([^>]*)\sroutinetype="END"([^>]*)>([\s\S]*?)<step\b/
  )
  if (!endRuleMatch) {
    throw new Error("END routine rule not found in TRFN XML")
  }

  const ruleBody = endRuleMatch[3]
  const ids = [...ruleBody.matchAll(/<target id="(\d+)"/g)].map((m) =>
    parseInt(m[1], 10)
  )
  const nextId = (ids.length ? Math.max(...ids) : 0) + 1

  const insert = `      <target id="${nextId}">
        <elementRef>#///target/segment1/${fieldName}</elementRef>
      </target>
`
  // 插在 END rule 的第一个 <step 之前
  return trfnXml.replace(
    /(<rule\b[^>]*routinetype="END"[^>]*>)([\s\S]*?)(\s*<step\b)/,
    (_m, open, body, step) => open + body + insert + step
  )
}

function hasFieldMappingRule(trfnXml: string, fieldName: string): boolean {
  // Rules group 中是否已有指向该字段的 elementRef (任意规则类型)
  const rulesGroup = trfnXml.match(
    /<group\b[^>]*\stype="S"[^>]*>[\s\S]*?<\/group>/
  )
  if (!rulesGroup) return false
  return rulesGroup[0].includes(`#///target/segment1/${fieldName}`)
}

function insertNoUpdateRule(
  trfnXml: string,
  fieldName: string,
  meta: TargetElementMeta
): string {
  const allIds = [...trfnXml.matchAll(/<rule id="(\d+)"/g)].map((m) =>
    parseInt(m[1], 10)
  )
  const nextId = (allIds.length ? Math.max(...allIds) : 0) + 1

  let inlineAttrs = `name="${meta.dataType}"`
  if (meta.precision) {
    inlineAttrs += ` precision="${meta.precision}"`
    if (meta.scale) inlineAttrs += ` scale="${meta.scale}"`
  } else if (meta.length) {
    inlineAttrs += ` length="${meta.length}"`
  }
  inlineAttrs += ` semanticType="${meta.semanticType}"`

  const ruleXml = `    <rule id="${nextId}" description="">
      <target id="1">
        <output>#///group1/rule${nextId}/step1/output1</output>
        <elementRef>#///target/segment1/${fieldName}</elementRef>
      </target>
      <step xsi:type="trfn:StepNoUpdate" id="1" rank="MAIN" type="NO_UPDATE">
        <output id="1">
          <input>#///group1/rule${nextId}/target1</input>
          <element xsi:type="trfn:TransformationElement" name="${fieldName}" dimension="${meta.dimension}">
            <endUserTexts label="${escapeXml(meta.label)}"/>
            <inlineType ${inlineAttrs}/>
            <localProperties xsi:type="BwCore:LocalCharacteristicProperties"/>
            <associationType>1</associationType>
            <associationValid>false</associationValid>
          </element>
        </output>
      </step>
    </rule>
`

  // 插在 type="S" 的 Rules group 结束前
  const sGroupIdx = trfnXml.search(/<group\b[^>]*\stype="S"[^>]*>/)
  if (sGroupIdx === -1) {
    throw new Error('Rules group (type="S") not found in TRFN XML')
  }

  // 找到该 group 对应的 </group> (简单: 从 sGroupIdx 起找匹配的 </group>)
  const afterOpen = trfnXml.indexOf(">", sGroupIdx) + 1
  let depth = 1
  let i = afterOpen
  while (i < trfnXml.length && depth > 0) {
    const nextOpen = trfnXml.indexOf("<group", i)
    const nextClose = trfnXml.indexOf("</group>", i)
    if (nextClose === -1) break
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++
      i = nextOpen + 6
    } else {
      depth--
      if (depth === 0) {
        return trfnXml.slice(0, nextClose) + ruleXml + trfnXml.slice(nextClose)
      }
      i = nextClose + 8
    }
  }
  throw new Error('Failed to locate closing </group> for Rules group')
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

// ============================================================================
// Field Mapping Rules (DIRECT: source → target)
//
// 对照 Eclipse Communication Log (2026-07-16 09:45:15 PUT body):
// 一条 DIRECT rule 的 XML 结构:
//   <rule id="N" description="">
//     <source id="1">
//       <input>#///group1/ruleN/step1/input1</input>
//       <elementRef>#///source/segment1/{srcField}</elementRef>
//     </source>
//     <target id="1">
//       <output>#///group1/ruleN/step1/output1</output>
//       <elementRef>#///target/segment1/{tgtField}</elementRef>
//     </target>
//     <step xsi:type="trfn:StepDirect" id="1" rank="MAIN" type="DIRECT">
//       <input id="1">
//         <output>#///group1/ruleN/source1</output>
//         <element .../>            ← source 字段 element (内联元数据)
//       </input>
//       <output id="1">
//         <input>#///group1/ruleN/target1</input>
//         <element .../>            ← target 字段 element (内联元数据)
//       </output>
//     </step>
//   </rule>
// ============================================================================

/**
 * 从 source segment 提取字段 element 的元数据 (label/inlineType/dimension 等)。
 * 返回 element 整段 XML (含 <element>...</element>), 用于内联进 step.input.element。
 */
function extractSourceElementXml(trfnXml: string, fieldName: string): string | undefined {
  // 只在 <source ...> ... </source> 大段内找 (避免命中 target/group)
  const sourceBlock = trfnXml.match(/<source\b[^>]*>[\s\S]*?<\/source>\s*<target/)
  const scope = sourceBlock?.[0] || trfnXml
  const m = scope.match(new RegExp(`<element\\b[^>]*\\sname="${fieldName}"[^>]*>[\\s\\S]*?</element>`))
  return m?.[0]
}

/**
 * 是否已存在指向某 source 字段的映射 rule (任意 step 类型)。
 */
function hasSourceFieldRule(trfnXml: string, sourceField: string): boolean {
  const sGroup = trfnXml.match(/<group\b[^>]*\stype="S"[^>]*>[\s\S]*?<\/group>/)
  if (!sGroup) return false
  return sGroup[0].includes(`#///source/segment1/${sourceField}`)
}

/**
 * 计算下一条 rule 的 id (现有最大 rule id + 1)。
 */
function nextRuleId(trfnXml: string): number {
  const ids = [...trfnXml.matchAll(/<rule id="(\d+)"/g)].map(m => parseInt(m[1], 10))
  return (ids.length ? Math.max(...ids) : 0) + 1
}

/**
 * 插入一条 DIRECT 映射 rule (sourceField → targetField)。
 *
 * 需要同时拿到 source 和 target 字段的 element 元数据 (label/inlineType),
 * 这些从 TRFN 自身的 source/target segment 提取, 因此**字段必须已存在于两端结构中**
 * (ADSO/DataSource 加字段并同步 TRFN 结构后即满足)。
 *
 * @param trfnXml - TRFN 完整 XML
 * @param sourceField - source 字段名 (如 "BUDAT")
 * @param targetField - target 字段名 (默认与 sourceField 同名, 即同名映射)
 * @param options.targetElementXml - 已提取的 target element XML (autoMap 批量时复用, 避免重复提取)
 * @returns 新 XML (含插入的 rule)
 */
export function addTransformationRule(
  trfnXml: string,
  sourceField: string,
  targetField?: string,
  options?: { targetElementXml?: string }
): string {
  const tgt = targetField || sourceField

  // source/target 字段必须存在于 TRFN 结构
  const sourceElement = extractSourceElementXml(trfnXml, sourceField)
  if (!sourceElement) {
    throw new Error(
      `Source field "${sourceField}" not found in TRFN source segment. ` +
        `Sync DataSource/ADSO structure into TRFN first.`
    )
  }
  const targetElement =
    options?.targetElementXml || extractTargetElementXml(trfnXml, tgt)
  if (!targetElement) {
    throw new Error(
      `Target field "${tgt}" not found in TRFN target segment. ` +
        `Sync ADSO structure into TRFN first.`
    )
  }

  // 同名 source→target 已有映射则跳过 (幂等)
  if (hasSourceFieldRule(trfnXml, sourceField)) {
    return trfnXml
  }

  const ruleId = nextRuleId(trfnXml)

  // source step.element 需把 xsi:type="trfn:TransformationElement" 去掉 (log 中 source step 的 element 无该属性)
  const sourceStepElement = sourceElement.replace(/\sxsi:type="trfn:TransformationElement"/, "")

  const ruleXml = buildDirectRule(ruleId, sourceField, tgt, sourceStepElement, targetElement)

  return insertRuleIntoGroup(trfnXml, ruleXml)
}

/**
 * 自动批量映射:扫描 source 和 target segment 中**同名字段**,
 * 为每个尚未映射的同名字段生成 DIRECT rule (模拟 Eclipse "Auto Map" 功能)。
 *
 * @param trfnXml - TRFN 完整 XML
 * @returns { xml, mapped } 新 XML + 已映射的字段名列表
 */
export function autoMapTransformationFields(
  trfnXml: string
): { xml: string; mapped: string[] } {
  const sourceFields = extractSegmentFieldNames(trfnXml, "source")
  const targetFields = new Set(extractSegmentFieldNames(trfnXml, "target"))

  let xml = trfnXml
  const mapped: string[] = []

  // 预提取 target element XML 缓存, 避免重复正则
  const targetElementCache = new Map<string, string>()
  for (const f of targetFields) {
    const el = extractTargetElementXml(trfnXml, f)
    if (el) targetElementCache.set(f, el)
  }

  for (const srcField of sourceFields) {
    if (!targetFields.has(srcField)) continue // target 无同名字段, 跳过
    if (hasSourceFieldRule(xml, srcField)) continue // 已有映射, 跳过
    xml = addTransformationRule(xml, srcField, srcField, {
      targetElementXml: targetElementCache.get(srcField)
    })
    mapped.push(srcField)
  }

  return { xml, mapped }
}

/**
 * 提取 target segment 中某字段的完整 element XML (含 label/inlineType/dimension)。
 */
function extractTargetElementXml(trfnXml: string, fieldName: string): string | undefined {
  const targetBlock = trfnXml.match(/<target\b[^>]*>[\s\S]*?<\/target>\s*<group/)
  const scope = targetBlock?.[0] || trfnXml
  const m = scope.match(new RegExp(`<element\\b[^>]*\\sname="${fieldName}"[^>]*>[\\s\\S]*?</element>`))
  return m?.[0]
}

/**
 * 提取 source 或 target segment 中所有字段名 (按 posit 顺序)。
 */
function extractSegmentFieldNames(trfnXml: string, side: "source" | "target"): string[] {
  // source block 止于 <target; target block 止于 <group
  const blockRe =
    side === "source"
      ? /<source\b[^>]*>[\s\S]*?<\/source>\s*<target/
      : /<target\b[^>]*>[\s\S]*?<\/target>\s*<group/
  const block = trfnXml.match(blockRe)?.[0] || ""
  const names: string[] = []
  const re = /<element\b[^>]*\sname="([^"]+)"[^>]*\sposit="(\d+)"/g
  let m: RegExpExecArray | null
  const found: { name: string; posit: number }[] = []
  while ((m = re.exec(block)) !== null) {
    found.push({ name: m[1], posit: parseInt(m[2], 10) })
  }
  found.sort((a, b) => a.posit - b.posit)
  return found.map(f => f.name)
}

/**
 * 构造一条 DIRECT rule XML (对照 Eclipse PUT body)。
 */
function buildDirectRule(
  ruleId: number,
  sourceField: string,
  targetField: string,
  sourceElementXml: string,
  targetElementXml: string
): string {
  return `    <rule id="${ruleId}" description="">
      <source id="1">
        <input>#///group1/rule${ruleId}/step1/input1</input>
        <elementRef>#///source/segment1/${sourceField}</elementRef>
      </source>
      <target id="1">
        <output>#///group1/rule${ruleId}/step1/output1</output>
        <elementRef>#///target/segment1/${targetField}</elementRef>
      </target>
      <step xsi:type="trfn:StepDirect" id="1" rank="MAIN" type="DIRECT">
        <input id="1">
          <output>#///group1/rule${ruleId}/source1</output>
${indent(sourceElementXml, 10)}
        </input>
        <output id="1">
          <input>#///group1/rule${ruleId}/target1</input>
${indent(targetElementXml, 10)}
        </output>
      </step>
    </rule>
`
}

/** 把多行 XML 缩进到指定空格数 */
function indent(xml: string, spaces: number): string {
  const pad = " ".repeat(spaces)
  return xml
    .split(/\r?\n/)
    .map(line => pad + line)
    .join("\n")
}

/**
 * 把一条 rule XML 插入到 Rules group (type="S") 的 </group> 之前。
 */
function insertRuleIntoGroup(trfnXml: string, ruleXml: string): string {
  const sGroupIdx = trfnXml.search(/<group\b[^>]*\stype="S"[^>]*>/)
  if (sGroupIdx === -1) {
    throw new Error('Rules group (type="S") not found in TRFN XML')
  }
  const afterOpen = trfnXml.indexOf(">", sGroupIdx) + 1
  let depth = 1
  let i = afterOpen
  while (i < trfnXml.length && depth > 0) {
    const nextOpen = trfnXml.indexOf("<group", i)
    const nextClose = trfnXml.indexOf("</group>", i)
    if (nextClose === -1) break
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++
      i = nextOpen + 6
    } else {
      depth--
      if (depth === 0) {
        return trfnXml.slice(0, nextClose) + ruleXml + trfnXml.slice(nextClose)
      }
      i = nextClose + 8
    }
  }
  throw new Error('Failed to locate closing </group> for Rules group')
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
