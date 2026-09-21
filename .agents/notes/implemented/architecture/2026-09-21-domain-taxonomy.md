# Agent Note: 域分类学——三种域 × 动词家族 × infoProvider 多态

Status: implemented

## Problem

门面层用 `client.adso` 充当 infoProvider 域（README 自述 "ADSO only for now"），但 BW 对象本体是分层的：InfoProvider 是"可被查询消费"的抽象，ADSO/CompositeProvider/OpenODS/MultiProvider/HCPR/InfoObject 都是它的实现。同时现有域其实分属三种性质不同的种类，接口形状被无差别对待。具体病灶：

- `validateInfoArea` 寄居 `client.adso`、`getInfoproviderStructure(infoArea, type)` 寄居 `client.repository`——两个 infoArea（容器）动词无家可归；
- processChain 是 rspc JSON 运维对象（无锁、无激活、读路径无 XML），却与建模域并列且无种类区分；
- 将来新增 CompProvider/HCPR 等类型时，要么再造平行域、要么重构 `client.adso`——多态层级未定，重构成本随时间上涨；
- [域门面只转发不藏逻辑](../../implemented/architecture/2026-09-18-api-domains-two-layer.md) 已定，但"域有哪些、彼此什么关系"这一层从未被正式化。

## Alternatives considered

- **平行类型域**（`client.adso` / `client.comp` / `client.hcpr` 并列，各自带一套 details/saveAndActivate）：表面不动现有代码，实际把共同动词复制 N 份——双表面税的域间版本。
- **单一 infoProvider 大面**（一个门面，靠参数区分类型）：方法签名被类型分支污染，类型安全退化为运行时判断。
- **维持现状**（adso 独占 infoProvider 名字，其余类型来了再说）：每次新增类型都重新争论一次，且容器动词继续寄居。

## Decision

**三种域（kind）× 三套动词家族**，kind 作为域注册表的元数据：

| kind | 特征 | 写会话引擎 | 成员 | 动词家族 |
|---|---|---|---|---|
| modeling | XML 文档编辑 + 激活，有锁 | withWriteSession | infoProvider(多态)/trfn/dtp/dataSource/infoObject(创建编辑无账本证据) | details/xml/versions/check/create/saveAndActivate/ensure*/delete |
| ops | 生命周期动作，无文档编辑 | 否 | processChain、replication(留在 dataSource 内) | execute/stop/logs/status/replicate |
| structure | 容器/导航/组织，只读或校验 | 否 | infoArea、repository、system、transport、query、ddic | tree/contents/validate/search/lineage |

**infoProvider 按多态建模**：抽象层持共同动词与类型判别（判别信息源：repository.search 的 objectType、getInfoproviderStructure），`client.infoProvider.adso(name)` 为类型特化面，现 `client.adso` 降为别名糖；未来 `comp(name)` 等按同模式生长。

落地事实（P1 Wave A/B，2026-09 合入）：

- `src/domains/registry.ts` 为 13 个域携带 kind 元数据，一致性测试把注册表与门面方法集锁定。
- infoArea 域归位：`client.infoArea.tree/validate`；infoProvider 域落地：`.adso(name)/.exists/.details`（ADSO 唯一 variant），`client.adso` 原样保留为快捷方式。
- 建模域补 `exists`（validate*Exists 薄转发）；`delete` 走 BWObject 通用路径；flat 表面已 @deprecated 指向域等价物。
- **验证边界不变**：HCPR/MultiProvider/OpenODS 无实测证据，不进 Public 契约（README "no HCPR / Open ODS" 边界保持有效）；每真机验证一种类型，进一种。

## Consequences

- 新域接入 = 注册表词条 + kind 归类 + 门面类，接口形状由 kind 决定；ops/structure 域永不接写会话引擎。
- P2 的 `hydrate(name)` 沿用本笔记的判别联合签名设计；每验证一种 InfoProvider 类型，在 `infoProvider.details` 的判别分支加一个 variant。
- README 门面表按 kind 分组是本分类的用户可见投影，两者须同步演进。
