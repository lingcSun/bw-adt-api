# Agent Note: 建模域裸 activate 正名 + 自管实现

Status: implemented

## Problem

`activate`（不带内容修改的纯激活）此前只有两处存在，且身份尴尬：

- dtp 域有 `activate`（lock→activate→裸 finally unlock），但 `VERB_FAMILIES.modeling` 家族表没有它——它是家族表外的孤儿动词；
- adso/trfn 域根本没有门面级 activate，重激活只能走 `.advanced.activate` 自己编排 lock→activate→unlock，或绕道 saveAndActivate（要求传 xmlContent，语义不符）；
- dtp 的实现用裸 `finally { await unlock }`：激活失败后若 unlock 也失败，unlock 错误会掩盖激活的原异常，调用方看到的是错误的根因。

用户确认：纯激活场景真实存在——重激活已保存对象（典型如 TRFN 例程变更后 DTP 被取消激活，需要重激活 DTP，不改动 DTP 内容）。所以裸 activate 不是 saveAndActivate 的残缺变体，而是独立的建模生命周期步骤。

## Alternatives considered

- **弃用裸 activate，只留 saveAndActivate**（重激活 = 重新 PUT 原内容再激活）：被否——重激活是真实且不同的生命周期步骤， forcing 调用方取 XML 再 PUT 回去是无意义的写放大，还多一次失败面。
- **只经 `.advanced.activate` 暴露**（调用方自管锁）：被否——调用方需要手写 lock→activate→unlock 编排（还要自己处理失败路径的锁残留），这正是 P3-B 给 delete 做自管锁时要消除的倒挂。
- **dataSource 也加 activate**：被否——dataSource 无独立激活的实测记录（RSDS 激活链路未上账本），边界纪律：无实测证据不进 Public 契约。advanced 子面的 activate（调用方持锁）保持不动。

## Decision

1. **家族正名**：`VERB_FAMILIES.modeling` += "activate"（`details/xml/versions/check/create/activate/saveAndActivate/ensure*/delete`）；[域分类学](./2026-09-21-domain-taxonomy.md)家族表行同 commit 事实性同步。
2. **adso/trfn 补自管锁 `activate`**（与 delete 同模式，但成功路径也 unlock）：
   - `adso.activate(id, options?: { transport? })`：lockADSO → activateADSO(lockHandle, transport 作 corrNr——必须是请求号而非任务号；ADSO 侧 corrNr 尚待复核，按 api 层签名透传) → **始终** finally 吞错 unlock。
   - `trfn.activate(id)`：lockTransformation → activateTransformation(lockHandle) → 始终 finally 吞错 unlock。无 transport 参数——activateTransformation 签名如此，账本亦无 TRFN 激活 corrNr 的实测记录（activation corrNr：DTP/RSDS 已验证，ADSO/PC 尚待复核，见 VERIFIED_APIS 第 5 节注）。
   - 与 delete 的关键差别：delete 成功后 BWObject.delete 内部已含一次吞错 unlock，门面不再 unlock；**激活不释放锁**，故 activate 在成功路径也必须域级 unlock——"始终 unlock"。
3. **dtp 既有 activate 修复**：裸 finally 改为 `finally { try { unlock } catch { /* 吞错，不掩盖原异常 */ } }`——激活原异常恒为上抛异常，与 delete 失败路径的 best-effort unlock 同语义。返回形态不变（`{ lockHandle, ...激活结果 }`）。
4. **两契约隔离延续**：`.advanced.activate` 保持调用方持锁语义不变；新门面动词的 JSDoc 明示「自管锁；调用方持锁用 `.advanced.activate`」。
5. 一致性测试（domain-registry）原型 ⇄ verbs 断言自动锁定新方法集；activate-verb.test.ts 补自管编排、吞错与 dataSource 边界断言（离线：spyOn 原位打桩 + `{} as AdtHTTP`）。

## Consequences

- modeling 家族表增长一行：三个已落地锁域（adso/trfn/dtp）的 activate 齐备且语义一致（lock → activate → 始终 finally 吞错 unlock，原异常上抛）。
- dtp 的激活失败诊断不再被 unlock 错误掩盖。
- dataSource 仍无 activate（也无 exists/delete）——等 RSDS 独立激活链路上账本再议。
- adso 侧 corrNr（transport）透传进 activateADSO，但其服务端行为尚未真机复核（账本遗留），与 updateADSO/saveAndActivate 的 corrNr 用法同源，风险一致。

## Related

- 动词家族表与三 kind 分类：[域分类学](./2026-09-21-domain-taxonomy.md)。
- exists/delete 的审计先例与 dataSource 边界论证：[动词族审计 close-out](./2026-09-22-verb-family-audit.md)。
- 两锁契约隔离（`.advanced` 调用方持锁）：[advanced 子面](./2026-09-22-advanced-subsurface.md)。
- 本笔记行为断言的离线证据：`src/__tests__/activate-verb.test.ts`（库自身行为）；corrNr 服务端行为未见账本条目，待真机复核。
