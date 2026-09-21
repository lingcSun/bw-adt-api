# Agent Note: infoProvider 多态域——ADSO 判别优先，未验证类型诚实抛错

Status: implemented

## Problem

`client.adso` 一直独占 infoProvider 抽象：InfoProvider 是"可被查询消费"的分层抽象（ADSO/CompositeProvider/MultiProvider/HCPR/…），门面却把 ADSO 特化面当成了抽象本身。[域分类学](./2026-09-21-domain-taxonomy.md)定的多态载体（P1 判别 + 类型特化面）没有落地——调用方拿一个 InfoProvider 名字时，无从得知它是什么类型，也没有诚实的入口；registry 里 infoProvider 词条缺位，`adso` 词条只能自述"当前唯一落地的 infoProvider 类型"。

## Decision

- **`src/domains/infoProvider.ts`** 新建 `InfoProviderDomain`（三动词，modeling kind）：`details(name)` 经 `searchBWObjects` 精确名搜索取 objectType——ADSO 转发 `new AdsoDomain(h).details`，其余类型抛 `InfoProvider type <X> not verified yet — see …2026-09-21-domain-taxonomy.md`，无命中抛 `InfoProvider <name> not found`；`exists(name)` = 精确名命中；`adso(name)` 返回绑定同一 AdtHTTP 的 AdsoDomain。api 层零新函数，门面纯转发+判别（两层结构不变）。
- **精确名判别口径**：服务端 contains 搜索，命中项须 `objectName` 与入参完全同名（两侧统一大写比较——BW 技术名服务端归大写，与 `getTransformationsOf` 的 title 比较同口径）；`searchInDescription=false` 防描述词噪音。
- **挂载与登记**：`BWAdtClient.infoProvider`（第 13 个域门面字段）、`src/domains/index.ts` 导出、registry 词条 verbs=`["details","exists","adso"]`（一致性断言 verbs == 原型方法名，故判别 helper 放模块级不进原型）。
- **`client.adso` 原样保留**，仅 JSDoc 注明它是 `client.infoProvider.adso()` 的快捷方式。

## Alternatives considered

- **按类型拆平行域**（`client.adso`/`client.comp`/`client.hcpr` 各一套动词）：分类学已否决——共同动词复制 N 份；本次判别转发正是其替代。
- **未验证类型返回 undefined/空结果**：把"没验证过"伪装成"不存在"，误导调用方；显式抛错把验证边界（README "no HCPR / Open ODS"）带进类型消息。
- **判别用 validation exists 端点**：V1 实测（2026-09-20）validation 只认 ADSO/IOBJ/RSDS 三个 token，覆盖不了 InfoProvider 全集；search objectType 是唯一诚实信息源。

## Consequences

- InfoProvider 名字有了正名入口：ADSO 透明直达全功能面；CompProvider/HCPR 等类型每真机验证一种，`details` 进一种分支，无需再争论层级。
- 未验证类型的报错自带分类学笔记指针，验证边界可自解释；`.adso(name)` 与 `client.adso` 是同类实例（各自 new），语义等价。
- 离线测试新增 spyOn 原型 + jest.mock search 组合（`src/__tests__/infoprovider-domain.test.ts`），`domain-registry.test.ts` 哨兵 `EXPECTED_UNATTACHED` 保持 `[]`。

## Related

- kind 三分类与 infoProvider 多态设计：[域分类学提案](./2026-09-21-domain-taxonomy.md)（P1 全部合入时按其毕业条件迁 implemented）。
- 注册表与 verbs==原型断言：[域注册表](2026-09-21-domain-registry.md)。
- 门面只转发不藏逻辑：[api 函数层与 domains 门面层的两层结构](2026-09-18-api-domains-two-layer.md)。
