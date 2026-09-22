# Agent Note: AdsoModel——水合式 ADSO 编辑模型（op-log 记意图，plan 即预览）

Status: implemented

## Problem

ADSO 编辑此前只有两截裸面：读是 `getADSOXml` 的原始字符串，改是 `src/api/adso.ts` 的纯 XML 变换函数。调用方要自己持有工作副本、自己串函数、自己记"我到底改了什么"——没有类型化的对象模型，没有操作账本，也没有落盘前的 diff 预览；域分类学定的"水合编辑模型"（P2）没有载体。registry 的 infoProvider 词条也没有编辑模型入口，`client.infoProvider` 无法水合一个模型。

## Decision

- **`src/model/adso.ts` 新建 `AdsoModel`**：`static hydrate(h, adsoId)` 经 `getADSOXml(h, id, true)` 全新读（不吃缓存）构造工作副本，构造器私有——没有"未水合的模型"这种半成品状态，会话 `h` 与对象同生命周期保存。三个链式编辑 `addField(field)` / `removeField(name)` / `addKey(infoObjectName, length?)` 只把工作副本喂给既有纯变换（`addADSOFieldToXml` / `removeADSOFieldFromXml` / `addADSOKeyToXml`），纯函数成功返回新 XML 才替换副本并追加 op；纯函数抛错（重名字段、非法 IOBJ 名等）则副本与账本皆不变、异常原样上抛。模型自身零 XML 手术逻辑。
- **提交链 `saveAndActivate(options?)`（P2 Task 2）**：工作副本原样交给 api 层 `saveAndActivateADSO(this.h, this.id, xml, options)`——lock → transport → PUT → activate → unlock 全程走 withWriteSession 引擎，模型不自带写编排，会话模型不变量不豁免；options 原样透传，无 op 时提交的即 hydrate 读到的原文。落盘单位是「整个工作副本」而非 op-log 重放。
- **op-log 记录单位是「调用者可见意图」**：`ModelOp { kind, at, args, summary }`——kind 是动词、args 是调用者实参（不含 xml）、summary 是含技术名的一句话。不记 diff 片段：v1 不做三方合并/冲突重放（P3+），`plan()` 即 diff 预览（空账本返回 `(no pending ops)`）。
- **`src/model/index.ts`**：`export type InfoProviderModel = AdsoModel`——v1 单 variant 联合，注释明示联合随类型逐个真机验证而增长（与 infoProvider 域"不猜未验证类型"同一纪律），不提前占位。
- **`InfoProviderDomain.hydrate(name)`（P2 Task 2）**：复用 details/exists 的 `findExact` search 判别——ADSO → `AdsoModel.hydrate(this.h, name)`；其余类型/无命中与 details 同一口径（`not verified yet` / `not found`，不猜未验证端点）。import 方向 domain → model → api 是 sanctioned 分层。
- **离线测试 mock 用 `jest.spyOn(api 模块, fn)` 就地替换，不用 `jest.mock` 工厂**：jest 30.3.0 + ts-jest 29.4.6 实测，`jest.mock("../api/adso", () => ({ ...requireActual, getADSOXml: jest.fn() }))` 这类工厂在 `../model` 被多入口（`domains/infoProvider` 值导入 `../model` 后）触达时会产生第二份模块实例——测试配置的 mock 与模型实际调用的 fn 是两个对象（`sameRef=false` 实测），全部依赖该 mock 的断言连坐失败，且失败集与改动文件集无模块图关系。`src/__tests__/adso-model.test.ts` 与 `infoprovider-domain.test.ts` 均已改为 spyOn。

## Alternatives considered

- **模型内持有解析后的对象树、编辑后重序列化**：把服务器按 XSD 水合属性（dimension 继承、semanticType 默认值等）的职责复制到客户端，必然与实测 PUT 形态漂移；纯字符串变换是已验证词汇，模型只该拥有"工作副本 + 账本"。
- **op-log 记 XML diff 片段（支撑三方合并/冲突重放）**：单写者场景（本库写会话全程持锁）下没有合并需求，记 diff 只会让账本与"用户想干什么"脱节；留 P3+ 真需要时再加。
- **hydrate 做实例方法**：实例存在的前提是已读到 XML，实例方法无米下锅；静态工厂 + 私有构造器让类型系统表达"模型必经水合"。
- **saveAndActivate 在模型层重写 lock/unlock 编排（不走 saveAndActivateADSO）**：会话序列顺序与 finally 解锁只在 `src/api/writeSession.ts` 维护，模型层重写即第二次实现会话模型，漂移必然发生；委托 api 层编排是唯一不变量安全的路。
- **hydrate 判别跳过 search、直接按名字猜 ADSO**：非 ADSO 同名对象会拿到错误类型的模型；与 details/exists 共用 `findExact` 是同一判别口径，零额外请求形状。
- **测试沿用 `jest.mock` + `requireActual` 工厂**（Task 1 的 adso-model.test.ts 原方案）：见 Decision 最后一条的实测证据——工厂派生双实例后失败与改动无模块图关联，排查成本远高于 spyOn；domain-verbs.test.ts 的"极简工厂不用 requireActual"注释早已记录过同族现象。

## Consequences

- ADSO 编辑有了类型化链式面 + 可审计意图账本 + `plan()` 预览 + 经 withWriteSession 引擎的落盘入口；提交的是「当前工作副本」——`plan()` 与实际 PUT 内容的对应关系由调用者自行核对。
- `client.infoProvider.hydrate(name)` 是水合编辑模型的公共入口：ADSO 返回可编辑的 `AdsoModel`，非 ADSO/未命中抛守卫错误（与 details 同文案）。`InfoProviderModel` 联合目前恒等于 `AdsoModel`；后续 variant 每真机验证一种进一种，分发逻辑在门面层，不在联合类型里。
- `AdsoModel` 的 `h` 是 private readonly：会话与实例同生命周期，模型无法更换会话，需要新会话就重新 hydrate。
- 离线测试样板（本仓库涉及 `src/model` 或多入口 api 模块的新测试一律照此）：`jest.spyOn(api 模块, "fn")` 就地替换 + `mockReset()` 复位；不要写 `jest.mock(path, factory)` 工厂（见 Decision 最后一条）。
- Task 1 曾以 `throw new Error("P2 Task 2")` 占位 `InfoProviderDomain.hydrate` 保持 verbs ⇄ 原型一致性断言绿；Task 2 已替换为真实分发，占位桩不复存在。

## Related

- 多态域与类型判别纪律：[infoProvider 多态域](2026-09-22-infoprovider-domain.md)、[域分类学](2026-09-21-domain-taxonomy.md)。
- verbs ⇄ 原型一致性断言：[域注册表](2026-09-21-domain-registry.md)。
- saveAndActivate 委托的写会话编排：[write-session 引擎](2026-09-21-write-session-engine.md)。
