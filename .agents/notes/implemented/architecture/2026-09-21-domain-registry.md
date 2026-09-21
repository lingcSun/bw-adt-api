# Agent Note: 域注册表——门面单一事实源与一致性测试

Status: implemented

## Problem

11 个域门面（`src/domains/*.ts`）的清单与方法名只存在于类定义与 `BWAdtClient` 的组装代码里，没有一处可编程读取的清单：后续任务（polymorphic infoProvider、按 kind 的动词族审计）需要"有哪些域、各属于什么 kind、各有什么动词"的单一事实源；而门面方法与任何手写清单之间也没有机械校验，改名/增删方法时文档类清单会静默漂移。

## Decision

（P1 Task 1：`src/domains/registry.ts` + `src/__tests__/domain-registry.test.ts`）

- **`src/domains/registry.ts`** 导出 `DomainKind`（modeling/ops/structure 三分类）、`DomainEntry { name, kind, summary, verbs, notes? }`、`DOMAIN_REGISTRY`（12 域 = 11 现有 + 预注册的 infoArea）、`getDomain(name)` 与动词家族表 `VERB_FAMILIES`。kind 归类与[域分类学提案](../../proposed/architecture/2026-09-21-domain-taxonomy.md)一致，query/ddic 归 structure（只读消费面）。
- **verbs 是"实然"清单**：逐域列门面类的当前实际方法名，与原型 own-properties（去 constructor）逐一相等；注册表不做家族裁判。越族动词（如 `dataSource.replicate/replicateFull`、`dtp.execute`、`adso.getRaw`、寄居的 validate 动词）写进 `notes`。
- **一致性测试**实例化每个已挂载域（`{} as AdtHTTP`，离线），断言 registry verbs == 原型方法名；注册但未挂载的域由测试内 `EXPECTED_UNATTACHED` 哨兵把守，infoArea 已于 P1 Task 2 挂载、哨兵现为 `[]`（见 [InfoArea 域归位](2026-09-21-infoarea-domain.md)）。

## Alternatives considered

- **verbs 强制 ⊆ VERB_FAMILIES**：需要立刻改门面（删 `getRaw`/搬复制动词）或让清单撒谎；家（家族表）与事实（类）的核对交给了 Task 4/5 审计，本任务只建立"注册表不得偏离类"这条可校验不变量。
- **注册表直接持类引用**：`src/domains/registry.ts` 得 import 全部门面类，注册表从纯元数据变成运行时依赖（后续域改类签名会波及它）；类映射放测试里即可。
- **不加注册表，只留分类学提案笔记**：散文没有编译器与测试盯防，P1 后续任务仍要重新盘点域清单，漂移照旧。

## Consequences

- 门面增删改方法而不更新注册表 → 一致性测试红。这是有意为之的绊线：改公共面前必须过注册表。
- 实测修正了一处陈旧认知：`DtpDomain` 无 `create`、有 `activate`（锁→激活→解锁），与任务简报的 stale 清单不同——类是事实。
- 新增域的标准路径多一步：建类 + 挂 `BWAdtClient` + 登记注册表（未挂载先登记会被 `EXPECTED_UNATTACHED` 哨兵拦下）。
- 分类学提案笔记维持 proposed：其毕业条件（P1 合入时迁 implemented）未到，infoProvider 多态仍是 P2。

## Related

- kind 三分类与动词家族的出处：[域分类学提案](../../proposed/architecture/2026-09-21-domain-taxonomy.md)。
- 门面只转发不藏逻辑的两层结构：[api 函数层与 domains 门面层的两层结构](2026-09-18-api-domains-two-layer.md)。
