/**
 * 域注册表 —— BW 域门面的单一事实源（P1 Task 1）。
 *
 * kind 三分类与动词家族表出自域分类学笔记
 * .agents/notes/proposed/architecture/2026-09-21-domain-taxonomy.md。
 * verbs 列每个域门面"当前实际"的方法名（类是事实，注册表跟随；
 * 见 src/__tests__/domain-registry.test.ts 的一致性断言），
 * 不强制 ⊆ VERB_FAMILIES——越族动词在 notes 里说明（如 dataSource.replicate）。
 * 后续任务（动词族审计）以此为起点；polymorphic infoProvider 已于 P1 Task 3 落地。
 */

/** 域的三种性质：建模 / 运维 / 结构（容器·导航·只读消费）。 */
export type DomainKind = "modeling" | "ops" | "structure"

export interface DomainEntry {
  /** 域名 = BWAdtClient 上的门面字段名。 */
  name: string
  kind: DomainKind
  summary: string
  /** 门面类的当前实际方法名（与原型 own-properties 逐一相等）。 */
  verbs: string[]
  /** 越出 kind 动词家族的显著例外，或落地状态备注。 */
  notes?: string
}

/**
 * 动词家族表（分类学的"应然"集合）：按 kind 归纳的动词词根。
 * "ensure*" 是前缀模式而非精确名；注册表 verbs 是"实然"清单，两者不互为约束。
 */
export const VERB_FAMILIES: Record<DomainKind, string[]> = {
  modeling: [
    "details",
    "xml",
    "versions",
    "check",
    "create",
    "saveAndActivate",
    "ensure*",
    "delete"
  ],
  ops: ["execute", "stop", "logs", "status", "replicate"],
  structure: ["tree", "contents", "validate", "search", "lineage"]
}

export const DOMAIN_REGISTRY: DomainEntry[] = [
  {
    name: "infoProvider",
    kind: "modeling",
    summary:
      "InfoProvider 多态域（ADSO 判别优先：search 精确名取 objectType，ADSO 转发 AdsoDomain，其余类型未验证即抛错）",
    verbs: ["details", "exists", "adso", "hydrate"],
    notes:
      "P1 Task 3 已落地：details/exists 经 repository.search 判别类型；adso(name) 返回绑定同一 AdtHTTP 的 AdsoDomain（client.adso 是其快捷方式）。hydrate 为 P2 水合编辑模型入口；P2 Task 2 已落真实分发（ADSO → AdsoModel.hydrate，编辑后 saveAndActivate 落盘）。HCPR/MultiProvider/OpenODS 无实测证据，命中即抛 not verified yet"
  },
  {
    name: "adso",
    kind: "modeling",
    summary: "InfoProvider · ADSO（当前唯一落地的 infoProvider 类型）",
    verbs: [
      "details",
      "xml",
      "versions",
      "check",
      "exists",
      "saveAndActivate",
      "addField",
      "addKey",
      "create",
      "validateInfoArea",
      "validateTemplate",
      "validateNewName",
      "getRaw",
      "delete"
    ],
    notes:
      "validateTemplate/validateNewName 是寄居的校验动词；validateInfoArea 已归位 client.infoArea.validate（P1 Task 2，旧位置保留 @deprecated）；getRaw 是 Advanced 层原始 XML 访问器。exists/delete 为动词族审计补齐（2026-09-22）：exists 归一 validate*Exists 为 boolean；delete 走 BWObject lockHandle 模式"
  },
  {
    name: "trfn",
    kind: "modeling",
    summary: "Transformation 建模域",
    verbs: [
      "details",
      "xml",
      "versions",
      "check",
      "exists",
      "saveAndActivate",
      "create",
      "setEndRoutineFields",
      "ensureEndRoutine",
      "ensureStartRoutine",
      "switchRuntime",
      "delete"
    ],
    notes:
      "ensure*/setEndRoutineFields 是例程家族扩展动词；switchRuntime 是纯 XML 辅助（不发网络）。exists/delete 为动词族审计补齐（2026-09-22），delete 走 BWObject lockHandle 模式"
  },
  {
    name: "dtp",
    kind: "modeling",
    summary: "DTP 建模域",
    verbs: [
      "details",
      "xml",
      "versions",
      "check",
      "exists",
      "activate",
      "saveAndActivate",
      "execute",
      "delete"
    ],
    notes:
      "execute 是 ops 族动词（DTP 执行入口寄居建模域）；activate 是锁→激活→解锁一站式。exists/delete 为动词族审计补齐（2026-09-22），delete 走 BWObject lockHandle 模式（W1：本地 DTP 亦实测可删）"
  },
  {
    name: "dataSource",
    kind: "modeling",
    summary: "DataSource (RSDS) 建模域（含复制运维）",
    verbs: [
      "details",
      "fields",
      "xml",
      "versions",
      "saveAndActivate",
      "mergeProposal",
      "replicationInfo",
      "replicate",
      "replicateFull"
    ],
    notes:
      "replicate/replicateFull/replicationInfo 是 ops 族动词；分类学明示复制运维留在 dataSource 内，不拆独立域。动词族审计结论（2026-09-22）：不加 exists/delete——RSDS 删除无实测证据，且 BWObject 通用单段 URI 不适用于双段 RSDS 标识（src/api/bwObject.ts DATA_SOURCE 登记）"
  },
  {
    name: "infoObject",
    kind: "modeling",
    summary: "InfoObject 建模域（读 + 校验）",
    verbs: ["get", "validateExists", "validateNewName"],
    notes: "创建/编辑尚无账本证据，仅读与校验（分类学备注）"
  },
  {
    name: "processChain",
    kind: "ops",
    summary: "Process Chain 运维域（rspc JSON，无锁无激活）",
    verbs: ["details", "check", "execute", "stop", "logs"],
    notes: "details/check 沿用 modeling 族命名习惯，但 processChain 从来不是建模域"
  },
  {
    name: "repository",
    kind: "structure",
    summary: "仓库搜索 / 对象树 / 数据流与血缘导航",
    verbs: [
      "infoproviderStructure",
      "search",
      "transformationsOf",
      "dtpsOf",
      "dataflow",
      "lineage"
    ]
  },
  {
    name: "query",
    kind: "structure",
    summary: "查询 / 报表预览（只读消费面）",
    verbs: ["initialView", "updateView", "preview"]
  },
  {
    name: "system",
    kind: "structure",
    summary: "系统信息与能力探测",
    verbs: ["info", "getProperty", "hasCapability"]
  },
  {
    name: "ddic",
    kind: "structure",
    summary: "DDIC 表元数据与数据（只读消费面）",
    verbs: ["describe", "getData", "querySql", "adsoDdicLinks", "adsoDdicTableName"]
  },
  {
    name: "transport",
    kind: "structure",
    summary: "CTS 传输请求（检查 / 新建）",
    verbs: ["check", "create"]
  },
  {
    name: "infoArea",
    kind: "structure",
    summary: "InfoArea 容器域（对象树 / 校验）",
    verbs: ["tree", "validate"],
    notes:
      "P1 Task 2 已落地：tree（自 repository.infoproviderStructure）、validate（自 adso.validateInfoArea）归位，旧位置保留 @deprecated"
  }
]

/** 按名取域条目；未知名返回 undefined。 */
export function getDomain(name: string): DomainEntry | undefined {
  return DOMAIN_REGISTRY.find(e => e.name === name)
}
