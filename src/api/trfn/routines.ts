/**
 * TRFN 例程子域 —— ensure START/END 例程（HTTP 链路）与例程字段/纯 XML 构造。
 *
 * P1B Task 3 从 src/api/transformation.ts 机械搬迁（函数体零修改；
 * 唯一例外: 动态 import 的模块说明符 "./abapClass" 随文件位置改为 "../abapClass"）。
 * 家族内依赖方向: 本模块 → ../transformation（core 保存/激活原语）与 → ./shared；
 * 无人依赖本模块 —— transformation.ts 仅按名重导出（兼容桶）。
 */
import { AdtHTTP } from "../../AdtHTTP"
import {
  activateTransformation,
  getTransformationXml,
  lockTransformation,
  saveAndActivateTransformation,
  unlockTransformation
} from "../transformation"
import type {
  SaveAndActivateTransformationOptions,
  SaveAndActivateTransformationResult
} from "../transformation"
import { deriveRoutineClassName, nextRuleId } from "./shared"

export interface EnsureRoutineOptions extends SaveAndActivateTransformationOptions {
  /** END：勾进例程的目标字段；START：源字段 */
  fields?: string[]
  /** 保存后是否激活 AMDP 类（默认 true；Eclipse：先激活类再激活 TRFN） */
  activateClass?: boolean
}

export interface EnsureRoutineResult {
  trfnId: string
  className: string
  created: boolean
  saveResult: SaveAndActivateTransformationResult
  classActivated: boolean
  classActivateSuccess?: boolean
  classActivateMessages?: string[]
  trfnActivated: boolean
  trfnActivateSuccess?: boolean
  trfnActivateMessages?: string[]
}

/**
 * 确保 TRFN 有结束例程（Eclipse 抓包链路）：
 * 1) PUT 挂 END 规则（含 classNameM）→ 服务端铸 AMDP 类壳
 * 2) 可选勾选 target 字段（addFieldToEndRoutine）
 * 3) 激活 AMDP 类（/sap/bc/adt/activation）
 * 4) 再激活 TRFN
 */
export async function ensureEndRoutine(
  client: AdtHTTP,
  trfnId: string,
  options?: EnsureRoutineOptions
): Promise<EnsureRoutineResult> {
  return ensureRoutine(client, trfnId, "END", options)
}

/** 确保 TRFN 有开始例程（与 END 同款链路，method=GLOBAL_START）。 */
export async function ensureStartRoutine(
  client: AdtHTTP,
  trfnId: string,
  options?: EnsureRoutineOptions
): Promise<EnsureRoutineResult> {
  return ensureRoutine(client, trfnId, "START", options)
}

async function ensureRoutine(
  client: AdtHTTP,
  trfnId: string,
  kind: "END" | "START",
  options?: EnsureRoutineOptions
): Promise<EnsureRoutineResult> {
  const activateClass = options?.activateClass ?? true
  const autoActivate = options?.autoActivate ?? true
  const fields = options?.fields || []

  let xml = await getTransformationXml(client, trfnId, "m", {
    forceCacheUpdate: true
  })

  const ensured =
    kind === "END"
      ? ensureEndRoutineInXml(xml, { targetFields: fields.length ? fields : undefined })
      : ensureStartRoutineInXml(xml, {
          sourceFields: fields.length ? fields : undefined
        })
  xml = ensured.xml
  const created = ensured.created
  const className = ensured.className

  // END：用 addFieldToEndRoutine 补 NO_UPDATE（幂等）；START 的 source 已写在规则里
  if (kind === "END" && fields.length) {
    for (const f of fields) {
      xml = addFieldToEndRoutine(xml, f)
    }
  }

  // 先只保存，等类激活后再激活 TRFN（对齐 Eclipse）
  const saveResult = await saveAndActivateTransformation(client, trfnId, xml, {
    transport: options?.transport,
    createTransport: options?.createTransport,
    transportDescription:
      options?.transportDescription ||
      `API ensure ${kind} routine` + (created ? " (create)" : " (fields)"),
    autoActivate: false,
    timestamp: options?.timestamp
  })

  let classActivated = false
  let classActivateSuccess: boolean | undefined
  let classActivateMessages: string[] | undefined
  if (activateClass) {
    const { activateAbapClass, getAbapClassSource } = await import("../abapClass")
    // 类可能在 PUT 后短暂不可读——轻量重试
    let ready = false
    for (let i = 0; i < 5; i++) {
      try {
        await getAbapClassSource(client, className)
        ready = true
        break
      } catch {
        await new Promise((r) => setTimeout(r, 400))
      }
    }
    if (!ready) {
      throw new Error(
        `ensure${kind === "END" ? "End" : "Start"}Routine: AMDP class ${className} ` +
          `not readable after TRFN PUT — server may not have generated the stub`
      )
    }
    const act = await activateAbapClass(client, className)
    classActivated = true
    classActivateSuccess = !!act.success
    classActivateMessages = (act.messages || [])
      .filter((m) => (m.type || "").toUpperCase() === "E" || m.type === "Error")
      .map((m) => m.shortText || m.objDescr || "")
      .filter(Boolean)
      .slice(0, 5)
  }

  let trfnActivated = false
  let trfnActivateSuccess: boolean | undefined
  let trfnActivateMessages: string[] | undefined
  if (autoActivate) {
    const lock = await lockTransformation(client, trfnId)
    try {
      const act = await activateTransformation(client, trfnId, lock.lockHandle)
      trfnActivated = true
      trfnActivateSuccess = !!act.success
      trfnActivateMessages = (act.messages || [])
        .filter((m) => m.messageType === "Error")
        .map((m) => m.title || "")
        .filter(Boolean)
        .slice(0, 5)
    } finally {
      await unlockTransformation(client, trfnId)
    }
  }

  return {
    trfnId,
    className,
    created,
    saveResult,
    classActivated,
    classActivateSuccess,
    classActivateMessages,
    trfnActivated,
    trfnActivateSuccess,
    trfnActivateMessages
  }
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
  const allIds = [...trfnXml.matchAll(/<rule\b[^>]*\bid="(\d+)"/g)].map((m) =>
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

export function hasEndRoutineInXml(trfnXml: string): boolean {
  return /<rule\b[^>]*routinetype="END"/i.test(trfnXml)
}

export function hasStartRoutineInXml(trfnXml: string): boolean {
  return /<rule\b[^>]*routinetype="START"/i.test(trfnXml)
}

export interface EnsureRoutineInXmlResult {
  xml: string
  created: boolean
  className: string
}

function extractTrfnNameFromXml(trfnXml: string): string {
  const m =
    trfnXml.match(/<(?:trfn:)?transformation\b[^>]*\bname="([^"]+)"/) ||
    trfnXml.match(/\bname="([0-9A-Za-z]{20,})"/)
  if (!m?.[1]) throw new Error("TRFN name not found in XML root")
  return m[1]
}

function classNameFromXmlOrDerive(trfnXml: string, trfnName: string): string {
  const m = trfnXml.match(/classNameM="([^"]+)"/)
  if (m?.[1]) return m[1]
  return deriveRoutineClassName(trfnName)
}

function buildEndRuleXml(
  ruleId: number,
  className: string,
  targetFields?: string[]
): string {
  const targets = (targetFields || [])
    .map(
      (f, i) =>
        `      <target id="${i + 1}"><elementRef>#///target/segment1/${f}</elementRef></target>`
    )
    .join("\n")
  return (
    `<rule description="" id="${ruleId}" routinetype="END">` +
    (targets ? `\n${targets}\n` : "") +
    `<step xsi:type="trfn:StepRoutine" classNameM="${className}" methodNameM="GLOBAL_END" hanaRuntime="false" id="1" type="ROUTINE" rank="MAIN"/>` +
    `</rule>`
  )
}

function buildStartRuleXml(
  ruleId: number,
  className: string,
  sourceFields?: string[]
): string {
  const sources = (sourceFields || [])
    .map(
      (f, i) =>
        `      <source id="${i + 1}"><elementRef>#///source/segment1/${f}</elementRef></source>`
    )
    .join("\n")
  return (
    `<rule description="" id="${ruleId}" routinetype="START">` +
    (sources ? `\n${sources}\n` : "") +
    `<step xsi:type="trfn:StepRoutine" classNameM="${className}" methodNameM="GLOBAL_START" hanaRuntime="false" id="1" type="ROUTINE"/>` +
    `</rule>`
  )
}

/** 把一条 rule 插入已有 type=G 的 group（在 </group> 前）；若无 G 组则在 S 组前新建。 */
function insertRoutineRuleIntoGGroup(trfnXml: string, ruleXml: string): string {
  const gMatch = trfnXml.match(/<group\b[^>]*type="G"[^>]*>[\s\S]*?<\/group>/)
  if (gMatch && gMatch.index !== undefined) {
    const g = gMatch[0]
    const nextG = g.replace(/<\/group>\s*$/, `\n    ${ruleXml}\n  </group>`)
    return (
      trfnXml.slice(0, gMatch.index) +
      nextG +
      trfnXml.slice(gMatch.index + g.length)
    )
  }
  const gGroup =
    `  <group id="0" description="" type="G" sourceSegment="#///source/segment1">\n` +
    `    ${ruleXml}\n` +
    `  </group>\n`
  if (/<group\b[^>]*type="S"/.test(trfnXml)) {
    return trfnXml.replace(/(<group\b[^>]*type="S")/, gGroup + "  $1")
  }
  return trfnXml.replace(
    /<\/(?:trfn:)?transformation>/,
    gGroup + "</trfn:transformation>"
  )
}

/**
 * 确保 TRFN XML 含 END 例程规则（对照 Eclipse：PUT 挂 routinetype=END + classNameM，服务端铸 AMDP 类）。
 * 已存在则幂等返回。
 */
export function ensureEndRoutineInXml(
  trfnXml: string,
  options?: { targetFields?: string[] }
): EnsureRoutineInXmlResult {
  const trfnName = extractTrfnNameFromXml(trfnXml)
  const className = deriveRoutineClassName(trfnName)
  if (hasEndRoutineInXml(trfnXml)) {
    return {
      xml: trfnXml,
      created: false,
      className: classNameFromXmlOrDerive(trfnXml, trfnName)
    }
  }
  const rule = buildEndRuleXml(nextRuleId(trfnXml), className, options?.targetFields)
  return {
    xml: insertRoutineRuleIntoGGroup(trfnXml, rule),
    created: true,
    className
  }
}

/**
 * 确保 TRFN XML 含 START 例程规则。与 END 共用同一 AMDP 类（classNameM 约定相同）。
 */
export function ensureStartRoutineInXml(
  trfnXml: string,
  options?: { sourceFields?: string[] }
): EnsureRoutineInXmlResult {
  const trfnName = extractTrfnNameFromXml(trfnXml)
  const className = deriveRoutineClassName(trfnName)
  if (hasStartRoutineInXml(trfnXml)) {
    return {
      xml: trfnXml,
      created: false,
      className: classNameFromXmlOrDerive(trfnXml, trfnName)
    }
  }
  const rule = buildStartRuleXml(
    nextRuleId(trfnXml),
    className,
    options?.sourceFields
  )
  return {
    xml: insertRoutineRuleIntoGGroup(trfnXml, rule),
    created: true,
    className
  }
}
