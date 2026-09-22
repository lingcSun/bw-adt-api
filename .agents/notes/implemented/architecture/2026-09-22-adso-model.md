# Agent Note: AdsoModel——水合式 ADSO 编辑模型（op-log 记意图，plan 即预览）

Status: implemented

## Problem

ADSO 编辑此前只有两截裸面：读是 `getADSOXml` 的原始字符串，改是 `src/api/adso.ts` 的纯 XML 变换函数。调用方要自己持有工作副本、自己串函数、自己记"我到底改了什么"——没有类型化的对象模型，没有操作账本，也没有落盘前的 diff 预览；域分类学定的"水合编辑模型"（P2）没有载体。registry 的 infoProvider 词条也没有编辑模型入口。

## Decision

- **`src/model/adso.ts` 新建 `AdsoModel`**：`static hydrate(h, adsoId)` 经 `getADSOXml(h, id, true)` 全新读（不吃缓存）构造工作副本，构造器私有——没有"未水合的模型"这种半成品状态。三个链式编辑 `addField(field)` / `removeField(name)` / `addKey(infoObjectName, length?)` 只把工作副本喂给既有纯变换（`addADSOFieldToXml` / `removeADSOFieldFromXml` / `addADSOKeyToXml`），纯函数成功返回新 XML 才替换副本并追加 op；纯函数抛错（重名字段、非法 IOBJ 名等）则副本与账本皆不变、异常原样上抛。模型自身零 XML 手术逻辑。
- **op-log 记录单位是「调用者可见意图」**：`ModelOp { kind, at, args, summary }`——kind 是动词、args 是调用者实参（不含 xml）、summary 是含技术名的一句话。不记 diff 片段：v1 不做三方合并/冲突重放（P3+），`plan()` 即 diff 预览（空账本返回 `(no pending ops)`）。
- **`src/model/index.ts`**：`export type InfoProviderModel = AdsoModel`——v1 单 variant 联合，注释明示联合随类型逐个真机验证而增长（与 infoProvider 域"不猜未验证类型"同一纪律），不提前占位。
- **registry verbs ⇄ 原型一致性**：infoProvider 词条 verbs 追加 `hydrate`（prototype 顺序末位），一致性断言期望同步更新；同时 `InfoProviderDomain.hydrate` 落占位桩（`throw new Error("P2 Task 2")`，返回类型 `Promise<InfoProviderModel>`）——P2 Task 2 替换为真实分发，期间套件保持绿。
- **`package.json` files 追加 `build/model`**：domains → model 是类型导入，发布的 `build/domains/infoProvider.d.ts` 会引用 `../model`，不发布该目录则消费方类型解析悬空。

## Alternatives considered

- **模型内持有解析后的对象树、编辑后重序列化**：把服务器按 XSD 水合属性（dimension 继承、semanticType 默认值等）的职责复制到客户端，必然与实测 PUT 形态漂移；纯字符串变换是已验证词汇，模型只该拥有"工作副本 + 账本"。
- **op-log 记 XML diff 片段（支撑三方合并/冲突重放）**：单写者场景（本库写会话全程持锁）下没有合并需求，记 diff 只会让账本与"用户想干什么"脱节；留 P3+ 真需要时再加。
- **不落占位桩，让一致性测试在 Task 1↔Task 2 之间红着**：违背本仓库"每任务收尾套件全绿"的收尾门槛；占位桩（显式抛 "P2 Task 2"）把"还没实现"变成诚实的运行时信号而非静默缺失。
- **hydrate 做实例方法**：实例存在的前提是已读到 XML，实例方法无米下锅；静态工厂 + 私有构造器让类型系统表达"模型必经水合"。

## Consequences

- ADSO 编辑有了类型化链式面 + 可审计意图账本 + `plan()` 预览；落盘（PUT/激活）不在本层——Task 2 起经域门面分发，落地时必须走 withWriteSession（既有不变量不豁免）。
- `InfoProviderDomain.hydrate` 是显式占位，调用即抛 "P2 Task 2"——这是 Task 1↔Task 2 之间的已知瞬态，Task 2 收尾时必须已替换并核对 registry notes。
- `InfoProviderModel` 联合目前恒等于 `AdsoModel`；后续 variant 每真机验证一种进一种，`hydrate` 分发逻辑在 Task 2 的门面层，不在联合类型里。
- 离线测试样板：`jest.mock("../api/adso", () => ({ ...jest.requireActual(...), getADSOXml: jest.fn() }))`——只 mock 读，纯变换保持真身（`src/__tests__/adso-model.test.ts`）。

## Related

- 多态域与类型判别纪律：[infoProvider 多态域](2026-09-22-infoprovider-domain.md)、[域分类学](2026-09-21-domain-taxonomy.md)。
- verbs ⇄ 原型一致性断言：[域注册表](2026-09-21-domain-registry.md)。
- 落盘时必须遵循的写会话模型：[write-session 引擎](2026-09-21-write-session-engine.md)。
