/**
 * TRFN 规则子域 —— 字段映射（DIRECT）与通用规则构造
 * （CONSTANT / INITIAL / FORMULA / NO_UPDATE）。
 *
 * P1B Task 3 从 src/api/transformation.ts 机械搬迁（函数体零修改）。
 * 家族内依赖方向: 本模块 → ./shared；无人依赖本模块
 * —— transformation.ts 仅按名重导出（兼容桶）。
 */
import { escapeXmlAttr, nextRuleId } from "./shared"

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

// ============================================================================
// 通用规则构造 —— addRule (2026-09-20; 各类型 step 形态采自 46 个真实 TRFN)
// ============================================================================

/**
 * addRule 支持的规则类型。
 *
 * ROUTINE / EXPERT 例程依赖系统生成 ABAP 类, REST 创建路径未打通前不在此列
 * (见 docs/VERIFIED_APIS.md「TRFN 规则专项」)。
 */
export type TransformationRuleSpec =
  | { type: "DIRECT"; sourceField: string; targetField?: string }
  | { type: "CONSTANT"; targetField: string; constant: string }
  | { type: "INITIAL"; targetField: string }
  | { type: "FORMULA"; targetField: string; formula: string; inputs?: string[] }
  | { type: "NO_UPDATE"; targetField: string }

export interface AddRuleOptions {
  /**
   * 目标字段已有规则时的行为。BW 要求每个目标字段恰好一条规则链,
   * 默认 true = 删除旧规则后插入新规则 (等价 Eclipse 里改规则类型)。
   */
  replace?: boolean
  /** 插入的规则组 id (如 "2" → 引用路径 #///group2/...); 缺省取第一个 type="S" 组 */
  groupId?: string
}

/** source 侧 step.element 惯例: 不带 xsi:type (与服务器水合结果对齐) */
function stripStepElementType(elementXml: string): string {
  return elementXml.replace(/\sxsi:type="trfn:TransformationElement"/, "")
}

interface SGroupInfo {
  /** '<group' 起始偏移 */
  start: number
  /** '</group>' 结束偏移 */
  end: number
  /** 组 id 属性 (引用路径 #///group{id}/... 用) */
  id: string
  /** 完整 group 块 */
  xml: string
}

/**
 * 定位 type="S" 的规则组。缺省第一个; 传 groupId 精确匹配。
 * 组可嵌套 (实测 type="G" 与 type="S" 为兄弟, 但按深度扫描配对更稳)。
 */
function locateSGroup(trfnXml: string, groupId?: string): SGroupInfo {
  const openRe = /<group\b[^>]*\btype="S"[^>]*>/g
  let open: RegExpExecArray | null
  while ((open = openRe.exec(trfnXml))) {
    const id = open[0].match(/\bid="([^"]+)"/)?.[1] || "1"
    if (groupId && id !== groupId) continue
    // 深度扫描找配对的 </group>
    let depth = 1
    let i = open.index + open[0].length
    while (depth > 0) {
      const nextOpen = trfnXml.indexOf("<group", i)
      const nextClose = trfnXml.indexOf("</group>", i)
      if (nextClose === -1) throw new Error('Rules group (type="S") not closed in TRFN XML')
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++
        i = nextOpen + 6
      } else {
        depth--
        if (depth === 0) {
          const end = nextClose + "</group>".length
          return { start: open.index, end, id, xml: trfnXml.slice(open.index, end) }
        }
        i = nextClose + 8
      }
    }
  }
  throw new Error(
    groupId
      ? `Rules group with id="${groupId}" not found in TRFN XML`
      : 'Rules group (type="S") not found in TRFN XML'
  )
}

/** 组内下一 rule id: 组内最大 +1, 且不低于全局最大 +1 (保持全局唯一) */
function nextRuleIdInGroup(groupXml: string, trfnXml: string): number {
  const inGroup = [...groupXml.matchAll(/<rule\b[^>]*\bid="(\d+)"/g)].map(m => parseInt(m[1], 10))
  const all = [...trfnXml.matchAll(/<rule\b[^>]*\bid="(\d+)"/g)].map(m => parseInt(m[1], 10))
  return Math.max(
    inGroup.length ? Math.max(...inGroup) : 0,
    all.length ? Math.max(...all) : 0
  ) + 1
}

/** 组内定位目标字段现有 rule 的区间 (无则 undefined) */
function findRuleRangeForTarget(groupXml: string, targetField: string): [number, number] | undefined {
  const ref = `#///target/segment1/${targetField}</elementRef>`
  const re = /<rule\b[\s\S]*?<\/rule>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(groupXml))) {
    if (m[0].includes(ref)) return [m.index, m.index + m[0].length]
  }
  return undefined
}

/**
 * 构造一条完整 rule XML。
 *
 * 接线惯例 (与服务器水合结果一致, 双向引用):
 * - rule.source N:  <input>#///group{G}/rule{R}/step1/input{N}</input> + elementRef
 * - rule.target 1:  <output>#///group{G}/rule{R}/step1/output1</output> + elementRef
 * - step.input N:   <output>#///group{G}/rule{R}/source{N}</output> + source element
 * - step.output 1:  <input>#///group{G}/rule{R}/target1</input> + target element
 */
function buildRuleXml(
  groupNo: string,
  ruleId: number,
  targetField: string,
  targetElementXml: string,
  spec: TransformationRuleSpec,
  sourceElements: Array<{ field: string; xml: string }>
): string {
  const g = `#///group${groupNo}/rule${ruleId}`
  const sources = sourceElements
    .map((s, i) =>
      `    <source id="${i + 1}">\n` +
      `      <input>${g}/step1/input${i + 1}</input>\n` +
      `      <elementRef>#///source/segment1/${s.field}</elementRef>\n` +
      `    </source>\n`
    )
    .join("")
  const target =
    `    <target id="1">\n` +
    `      <output>${g}/step1/output1</output>\n` +
    `      <elementRef>#///target/segment1/${targetField}</elementRef>\n` +
    `    </target>\n`
  const stepOutput =
    `      <output id="1">\n` +
    `        <input>${g}/target1</input>\n` +
    `${indent(targetElementXml, 8)}\n` +
    `      </output>\n`

  let step: string
  switch (spec.type) {
    case "DIRECT":
      step =
        `    <step xsi:type="trfn:StepDirect" id="1" type="DIRECT" rank="MAIN">\n` +
        `      <input id="1">\n` +
        `        <output>${g}/source1</output>\n` +
        `${indent(sourceElements[0].xml, 8)}\n` +
        `      </input>\n` +
        `${stepOutput}` +
        `    </step>\n`
      break
    case "CONSTANT":
      step =
        `    <step xsi:type="trfn:StepConstant" constant="${escapeXmlAttr(spec.constant)}" id="1" type="CONSTANT" rank="MAIN">\n` +
        `${stepOutput}` +
        `    </step>\n`
      break
    case "INITIAL":
      step =
        `    <step xsi:type="trfn:StepInitial" id="1" type="INITIAL" rank="MAIN">\n` +
        `${stepOutput}` +
        `    </step>\n`
      break
    case "NO_UPDATE":
      step =
        `    <step xsi:type="trfn:StepNoUpdate" id="1" type="NO_UPDATE" rank="MAIN">\n` +
        `${stepOutput}` +
        `    </step>\n`
      break
    case "FORMULA": {
      const inputs = sourceElements
        .map((s, i) =>
          `      <input id="${i + 1}">\n` +
          `        <output>${g}/source${i + 1}</output>\n` +
          `${indent(s.xml, 8)}\n` +
          `      </input>\n`
        )
        .join("")
      step =
        `    <step xsi:type="trfn:StepFormula" formula="${escapeXmlAttr(spec.formula)}" id="1" type="FORMULA" rank="MAIN">\n` +
        `${inputs}` +
        `${stepOutput}` +
        `    </step>\n`
      break
    }
  }

  return `    <rule description="" id="${ruleId}">\n${sources}${target}${step}    </rule>\n`
}

/** 把 rule XML 插到指定 [start,end) group 块的 </group> 之前 */
function insertRuleIntoGroupAt(trfnXml: string, ruleXml: string, groupStart: number, groupEnd: number): string {
  const closeStart = trfnXml.lastIndexOf("</group>", groupEnd)
  if (closeStart < groupStart) throw new Error("Failed to locate closing </group> for Rules group")
  return trfnXml.slice(0, closeStart) + ruleXml + trfnXml.slice(closeStart)
}

/**
 * 通用规则入口: 按 spec 类型构造并插入一条规则。
 *
 * - 组引用前缀 (#///group{N}/...) 按实际插入组推导, 不再硬编码 group1;
 *   rule id 按组内现值 +1 (且保持全局唯一)。
 * - 目标字段已有规则时默认**替换** (Eclipse 改规则类型语义);
 *   传 replace:false 可改为显式报错。
 * - FORMULA 的 inputs 为公式引用的 source 字段名列表, 顺序即 step input 编号;
 *   公式表达式本身按 SAP 公式语法书写 (如 `IF( IS_INITIAL( F1 ), F2, F1 )`),
 *   需保证引用字段都出现在 inputs 中。
 * - CONSTANT 值需与目标字段类型兼容 (服务器激活时校验)。
 *
 * @example
 *   xml = addRule(xml, { type: "CONSTANT", targetField: "ZACCOUNT2", constant: "AC011601" })
 *   xml = addRule(xml, { type: "FORMULA", targetField: "ZC_PROJT",
 *                        formula: "IF( IS_INITIAL( ZZPOSID ), ZC_PROJT, ZZPOSID )",
 *                        inputs: ["ZZPOSID", "ZC_PROJT"] })
 */
export function addRule(
  trfnXml: string,
  spec: TransformationRuleSpec,
  options?: AddRuleOptions
): string {
  let group = locateSGroup(trfnXml, options?.groupId)
  const targetField = spec.type === "DIRECT" ? spec.targetField || spec.sourceField : spec.targetField

  const targetElement = extractTargetElementXml(trfnXml, targetField)
  if (!targetElement) {
    throw new Error(
      `Target field "${targetField}" not found in TRFN target segment. ` +
        `Sync ADSO structure into TRFN first.`
    )
  }

  let sourceElements: Array<{ field: string; xml: string }> = []
  if (spec.type === "DIRECT") {
    const xml = extractSourceElementXml(trfnXml, spec.sourceField)
    if (!xml) {
      throw new Error(
        `Source field "${spec.sourceField}" not found in TRFN source segment. ` +
          `Sync DataSource/ADSO structure into TRFN first.`
      )
    }
    sourceElements = [{ field: spec.sourceField, xml: stripStepElementType(xml) }]
  } else if (spec.type === "FORMULA") {
    const inputs = spec.inputs || []
    if (inputs.length === 0) {
      throw new Error(`FORMULA rule for target "${targetField}" needs at least one input field (spec.inputs)`)
    }
    sourceElements = inputs.map(f => {
      const xml = extractSourceElementXml(trfnXml, f)
      if (!xml) {
        throw new Error(
          `Input source field "${f}" not found in TRFN source segment. ` +
            `Sync DataSource/ADSO structure into TRFN first.`
        )
      }
      return { field: f, xml: stripStepElementType(xml) }
    })
  }

  // 目标占用: 默认替换 (BW 每目标字段恰一条规则链)。
  // rule id 在删除前计算, 保证单调递增、不复用刚删除的号。
  const ruleId = nextRuleIdInGroup(group.xml, trfnXml)
  const existing = findRuleRangeForTarget(group.xml, targetField)
  if (existing) {
    if (options?.replace === false) {
      throw new Error(
        `Target field "${targetField}" already has a rule in rules group ${group.id}; ` +
          `default behavior replaces it (pass replace:false to surface this error instead).`
      )
    }
    trfnXml = trfnXml.slice(0, group.start + existing[0]) + trfnXml.slice(group.start + existing[1])
    group = locateSGroup(trfnXml, options?.groupId)
  }

  const ruleXml = buildRuleXml(group.id, ruleId, targetField, targetElement, spec, sourceElements)
  return insertRuleIntoGroupAt(trfnXml, ruleXml, group.start, group.end)
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
  const g = locateSGroup(trfnXml)
  return insertRuleIntoGroupAt(trfnXml, ruleXml, g.start, g.end)
}
