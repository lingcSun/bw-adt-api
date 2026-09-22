# Agent Note: 动词族审计 close-out——建模域 exists/delete 薄转发补齐

Status: implemented

## Problem

[域分类学](./2026-09-21-domain-taxonomy.md)给 modeling 族定的动词家族是 details/xml/versions/check/create/saveAndActivate/ensure*/delete，[域注册表](2026-09-21-domain-registry.md)落地时留了一个洞：adso/trfn/dtp 三个建模域**没有 `delete`**（删除只能绕到 `client.deleteObject`/BWObject 通用路径），`exists` 也只有 infoProvider 多态域有——调用方想知道"这个 ADSO/TRFN/DTP 在不在"，得自己调 api 层 validate 函数并解释 `ValidationResult`，甚至自己处理"对象不存在时服务端直接报错"的语义。动词族审计要回答两个问题：缺的动词补不补、补到哪层；以及 dataSource 为什么**不**补。

## Decision

- **`client.adso/trfn/dtp` 各补两个薄转发**（两层结构不变，api 层零新函数）：
  - `exists(id)` → api 层既有 `validateADSOExists` / `validateTransformationExists` / `validateDTPExists`，归一为 `Promise<boolean>`。关键语义：实测（API_REFERENCE validateADSOExists 行；`src/api/adso.ts` createADSO 内注释同证）validation 端点对**不存在的对象直接报错**而非返回 `valid:false`——门面把 AdtError 归 `false`，调用方拿到纯布尔（2026-09-22 起传输层 HttpClientException 原样重抛，见 [exists 错误语义收窄](2026-09-22-exists-error-semantics.md)）。
  - `delete(id, options?)` → BWObject lockHandle 模式（VERIFIED_APIS 第 6/8 节端到端实测；W1 补验本地 DTP）。**2026-09-22 修订：delete 已改为自管锁**——门面内部 lockADSO/lockTransformation/lockDTP → `BWObject.delete({lockHandle, transport?})`，成功不追加门面级 unlock（BWObject.delete 内部自带吞错 unlock，卡带证据 lock→DELETE→unlock 全 200），失败才 best-effort unlock；options 收窄为 `{transport?}`，"锁归调用方"的部分被 [advanced 子面](2026-09-22-advanced-subsurface.md)接住（见该笔记的两锁契约隔离决策）。
- **dataSource 刻意不加**（两理由，已写进 registry notes）：RSDS 删除无实测证据（taxonomy 边界纪律：没验证过的不进公共面）；`BWObject` 通用单段 URI 不适用于双段 RSDS 标识（`/rsds/{datasource}/{sourceSystem}/m`），通用路径本来就不覆盖它。
- **registry verbs 同步追加** `exists`/`delete`（三域），notes 各记一笔审计结论；verbs == 原型方法名的一致性断言天然覆盖新增动词（类是事实，注册表跟随）。
- 离线测试 `src/__tests__/domain-verbs.test.ts`：三域 exists 委托与布尔归一（true / AdtError→false / HttpClientException→重抛）、delete 的 objectType 与 options 透传、dataSource 原型无 exists/delete 的边界哨兵。api 模块以 jest.spyOn 原位打桩（2026-09-22 由极简工厂迁出，见 Consequences）。

## Alternatives considered

- **门面 delete 自动 lock→delete→unlock（一站式）**：更"好用"，但把锁的生命周期藏进门面——与 dtp.activate 显式锁编排、BWObject 删除路径"锁由调用方管理"的既有分工冲突；且 corrNr（带 TR 删除）等场景需要调用方对锁时机的控制权。薄转发保留全部控制权。（2026-09-22 修订：delete 一站式已被采纳，但成功路径不追加门面级 unlock——BWObject.delete 内部自带吞错 unlock 保证释放，与原提案的显式 unlock 编排不同；调用方持锁的控制权需求由 advanced 子面承接，见 [advanced 子面](2026-09-22-advanced-subsurface.md)。）
- **exists 吞掉网络错误一并归 false**：把"没验证过"伪装成"不存在"的同款错误（infoProvider 笔记批判过）。本次没有更精细地区分——validation 端点的实测负例语义就是报错，门面无法离线区分"对象不存在"与"网络故障"的异常形态，选择了简单归一；代价见 Consequences。（2026-09-22 反转：HttpClientException 改为原样重抛，AdtError 归 false 不变，见 [exists 错误语义收窄](2026-09-22-exists-error-semantics.md)。）
- **dataSource 也补 exists（validation 端点认 RSDS token）**：exists 证据其实存在，但一对动词只补一半会让"dataSource 没有 delete"看起来像遗漏而非决策；且 RSDS 双段标识让 `delete(id)` 签名本身不成立。整对不加，边界更清晰。
- **BWObjectType 传字符串字面量**（"adso"/"trfn"/"dtpa"）：绕过枚举但丢了类型检查与注册表语义的单一来源，仍用 `BWObjectType` 枚举成员。

## Consequences

- 三个建模域动词表对齐分类学 modeling 家族（delete 补齐；`exists` 是校验族动词，寄居建模域与 validateTemplate/validateNewName 同理）；dataSource 的 verbs/notes 成为"审计后刻意缺席"的显式记录，后人不必重新论证。
- **exists 的归一曾是有损的，现已收窄**：网络故障 / 会话失效曾同样得到 `false`；2026-09-22 起 HttpClientException 原样重抛（[exists 错误语义收窄](2026-09-22-exists-error-semantics.md)）。AdtError 归 false 的边界仍在：需要区分"确认不存在"与"业务层查不到"的调用方应改用 `client.validateADSOExists`（api 面原样抛错）。门面语义 = "validation 语义层的尽力回答"，不是"保证回答在不在"。
- **测试基础设施教训**：极简 jest.mock 工厂里 `...jest.requireActual(...)` 会把 real 模块图拖进 mock 注册表，让同一 api 模块在不同 importer 处产生双实例（域拿到 A、测试断言 B，`mock.calls` 恒 0）——本仓库离线域测试用 spyOn 就地打桩（真模块单实例；2026-09-22 起 domain-verbs / infoarea-domain 两套件也由工厂迁 spyOn，与 infoprovider-domain / adso-model 同款）。
- 兼容面（`BWAdtClient.validateADSOExists` 等 api 直通方法、`client.deleteObject`）原样保留；现有集成测试继续作为兼容面回归网（不迁移到域表面）。

## Related

- 动词家族表与三 kind 分类：[域分类学提案](./2026-09-21-domain-taxonomy.md)。
- 注册表 verbs == 原型一致性断言：[域注册表](2026-09-21-domain-registry.md)。
- 门面只转发不藏逻辑：[api 函数层与 domains 门面层的两层结构](2026-09-18-api-domains-two-layer.md)。
- 删除路径证据（lockHandle 模式与 W1）：`docs/VERIFIED_APIS.md` 第 6/8 节；`src/__tests__/bwObject-delete.test.ts`。
