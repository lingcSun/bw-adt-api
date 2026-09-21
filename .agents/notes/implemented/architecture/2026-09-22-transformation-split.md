# Agent Note: transformation.ts 拆三子域——shared 叶子层 + 按名重导出兼容桶

Status: implemented

## Problem

`src/api/transformation.ts` 单文件 1925 行，混装四种不相干的演化轴：core CRUD/保存编排（lock/unlock/get/versions/validate/check/update/saveAndActivate/activate/settings 解析）、8TRANSIENT 创建流、字段映射与通用规则构造（纯 XML）、例程 ensure/字段勾选（HTTP+纯 XML）。后三者的增长彼此无关却都在同一个文件里碰撞，且与 `adso.ts` 等按域单文件的组织不一致。

## Decision

- **布局**：`src/api/trfn/{shared,rules,routines,create}.ts` 四子域 + `transformation.ts` 保留 core 并对全部 31 个搬走的导出名逐名 `export { x } from "./trfn/…"` 重导出（不用 `export *`，双跳被排除）。导出面零变化由新增 `transformation-barrel.test.ts` 快照锁定：52 个导出名（tsc checker 机械枚举）37 个值运行时 `toBeDefined`、19 个纯类型经 `import type` + 映射类型编译期强制。
- **shared 是真叶子**：只依赖 io-ts/utilities。除 brief 点名的 `extractTransformationTimestamp`、`hasStart/hasEnd/hasExpertRoutine`、`extractRoutineMethodName`、`TransformationMetaData` 外，按"以实际依赖闭包为准"下沉了闭包强制项：`parseTransformationSettings`/`TransformationSettings`/`extractRoutineInfo`/例程三接口（被四个 settings 助手调用）、`deriveRoutineClassName`（core 的 `extractAbapClassName` 与 routines 都要——若按原计划落 routines.ts 会形成 core→子域反向依赖）、`escapeXmlAttr`（create+rules 共用）、`nextRuleId`（rules+routines 共用）。core 对这些名字按名重导出，消费面不变。
- **允许的向上引用**：`routines.ts`→core 5 个（getTransformationXml/saveAndActivate/lock/activate/unlock），`create.ts`→core 4 个（getTransformationXml/lock/update/unlock）——ensure*/create 的真实闭包，比口头预期"三个"多，但方向与 brief 的单向规则一致；把它们下沉进 shared 反而撕碎 core 自身清单。引用全部只在函数体内解引用（懒），无模块初始化期解引用。
- **机械搬迁**：新文件正文按原始文件行号区间 sed 抽取拼接，函数体零编辑。全量行集校验（多集比较）确认与原文仅 4 类差异：动态 import 说明符 `"./abapClass"`→`"../abapClass"`（随位置，唯一函数体内改动）、`escapeXmlAttr`/`nextRuleId` 补 `export` 关键字、authored 的头/尾 import|export 行、校验脚本自身的标记行。

## Alternatives considered

- **settings 解析层留 core，shared 四助手反向 import barrel**：shared 不再是叶子，与"create/rules/routines → shared"唯一家族内方向冲突；按下沉规则落 shared 更干净。`extractAbapClassName` 无闭包强制，仍留 core。
- **把 lock/unlock/activate/saveAndActivate 下沉 shared 以消除 barrel 上行边**：直接 contradict"core 保留"清单，且这些是 core 的语义主体。
- **`export *` 重导出**：双跳、丢显式面，排除。

## Consequences

- 消费方零改动：`"./transformation"`/`"../api/transformation"` 与全部既有测试 import 路径不变（含 index.ts 两处具名清单、`domains/trfn.ts` 的 `* as trfn`）。
- barrel↔routines/create 存在模块环，CJS 惰性 getter 下安全，已用 build 产物双入口 require 冒烟（routines-first 与 barrel-first）实测；破坏方式仍是"下沉 shared"。
- 后续 TRFN 新动词/规则类型落 `src/api/trfn/` 对应子域，不再进 1925 行单文件（core 现 503 行）。
- 未做：settings 解析层再下沉后 core 的 `parseTransformationDetails` 与 shared 的 settings 解析是两套形状（details 是 REST 详情视图、settings 是 XML 属性视图），合并留待真需求。

## Related

- 单向依赖与兼容面约束的出处：P1B Task 3 brief（`.superpowers/sdd/p1b-task-3-brief.md`）。
- 兼容面"只增不破"先例：[flat 表面 @deprecated](2026-09-22-flat-deprecation.md)。
