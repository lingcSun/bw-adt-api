# Agent Note: flat 表面 @deprecated——有门面等价物的兼容方法统一标弃

Status: implemented

## Problem

P1 门面落地后，`BWAdtClient` 上并存两套入口：域门面（`client.adso` / `client.trfn` / …）与 122 个 flat 公共方法（不含 4 个会话方法与 13 个属性访问器）。flat 表面没有任何弃用信号，模型与用户无从知道哪些能力已有门面正名入口、哪些是门面尚未覆盖的真实缺口——"渐进弃用"停留在 `BWAdtClient` 类注释的一句话，无法被工具链消费（TS 删除线、IDE 提示、后续清理都依赖 `@deprecated` 注记）。

## Decision

- **判定口径**：flat 方法当且仅当能力已有门面等价物才标注。等价物分两档：直接转发（门面动词转发同一 api 函数，如 `client.trfn.check` ← `checkTransformation`）；合并超集（门面 P1 合并动词内部含该能力，如 `client.ddic.describe` 四合一、`client.adso.details` 含 configuration/tables/ddicTableName、`client.processChain.logs` 含 status）。逐方法映射依据 `src/domains/registry.ts` verbs 与门面类实现逐一核对。
- **标注 75 个**（71 新增 + 4 归一）：`saveAndActivateADSO/Transformation/DTP/DataSource` 原有英文 `@deprecated Prefer …` 散块归一为统一措辞。统一格式：`@deprecated 使用 \`client.<domain>.<verb>()\`（P1 单表面收敛）`，追加在既有 JSDoc 块尾；纯注记，零签名/实现变化。
- **不标注 47 个**：泛型 objectType 方法（createObject/updateObject/deleteObject/getObject/bwObject/activateObject/validateObjectExists/validateNewObjectName——等价物按类型分散在多个门面，单条 `client.<domain>.<verb>()` 无法诚实表达）；门面无对应动词的锁/激活/更新/裸读方法（lock*/unlock*/activate*/update*/getDTP 等）；纯 XML 辅助与例程类方法；validateTransformationNewName（trfn 门面无 validateNewName）。宁可漏标不可错标——这批是门面下一步补动词的真实缺口清单。（2026-09-22 修订：16 个 lock/unlock/activate/update flat 方法——adso/trfn/dtp/dataSource 四域——已改标 `@deprecated 使用 \`client.<domain>.advanced.<verb>()\``，advanced 子面落地后它们有了门面正名入口，见 [advanced 子面](2026-09-22-advanced-subsurface.md)；泛型方法与其余 unmapped 仍不标注。）
- **排除**：login/logout/dropSession/reentranceTicket（会话）、属性访问器与 clone、私有助手。

## Alternatives considered

- **连泛型方法一起标**（如 deleteObject → "各域 delete"）：@deprecated 行只能指一个入口，多域指射要么撒谎要么写成散文；保守留白，等动词族审计定型后再按类型拆标。
- **把 updateADSO/updateTransformation/activateDTP 等映射到 saveAndActivate/activate**：契约不同（调用方持锁 vs 门面内管锁），指过去会误导锁生命周期；归入不标注。
- **测试同步迁移到门面**：见 Consequences，明确不做。

## Consequences

- flat 表面上凡有门面等价物的方法，TS 工具链即刻标删除线，新代码被引向单表面；已标注方法行为不变。
- **既有集成测试刻意继续调用被弃用表面，不迁移**——它们正是这块兼容面的回归网（0 failed 的既有通过/跳过档案是本注记的安全带）；大规模测试迁移不在本任务范围，待门面稳定后按域分批迁移并随批删除对应 flat 方法。
- 47 个未标注方法是门面动词缺口的事实清单（锁/激活/更新/裸读/例程类），动词族审计的直接输入；其中裸读（getDTP/getDataSource/getTransformation/getProcessChain）与门面解析版 details 的差异是已知的形状不一致。
- 本注记只覆盖 BWAdtClient flat 表面；域门面内部的旧位置弃用（`repository.infoproviderStructure`、`adso.validateInfoArea`）归 InfoArea 归位注记所有。

## Related

- 旧位置保留 @deprecated 的先例与委托不变式：[InfoArea 结构域归位](2026-09-21-infoarea-domain.md)。
- 门面动词的实然清单（本注记映射的对照面）：[域注册表](2026-09-21-domain-registry.md)与[动词族审计](2026-09-22-verb-family-audit.md)。
- kind 三分类与"structure 域只读消费面"的边界：[域分类学提案](./2026-09-21-domain-taxonomy.md)。
