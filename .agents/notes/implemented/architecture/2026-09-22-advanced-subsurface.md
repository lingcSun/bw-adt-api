# Agent Note: advanced 子面 + delete 自管锁——两种锁契约的门面隔离

Status: implemented

## Problem

P1 门面收敛后出现锁契约倒挂：`adso/trfn/dtp` 的门面 `delete` 走 BWObject lockHandle 模式（缺 lockHandle 直接报错），但按[动词族审计](2026-09-22-verb-family-audit.md)的"薄转发、锁归调用方"决策，门面不提供 lock——调用方唯一合法的取锁路径是 flat `client.lockADSO(id)`，而 flat 表面正是收敛要消灭的那层。结果是"用已弃用方法给门面动词供锁"。同时，调用方持锁的 lock/unlock/activate/update 原语在门面上没有家：[flat 弃用注记](2026-09-22-flat-deprecation.md)当时刻意不标这 16 个方法，理由是"门面无对应动词"——它们成了 Advanced 层悬空的孤岛，既不能弃也不能归位。

## Decision

- **门面动词分两种锁契约**（2026-09-22 落地）：自管动词（`saveAndActivate`、`dtp.activate`、现在的 `delete`——内部 lock→…→unlock/finally）与 `advanced` 子面——`get advanced()` 返回冻结对象，方法逐参镜像 api 层裸函数，锁的获取与释放归调用方。两种契约在命名空间上隔离，类型上不可混淆。
- **四域 advanced 内容**：adso `lock/unlock/activate/update/delete`（adso 比 others 多 `delete`——调用方持锁删除的原名入口，转发 BWObject.delete 原样）；trfn/dtp/dataSource `lock/unlock/activate/update`。签名逐参镜像 api 层：adso/trfn 的 update io 是 `{lockHandle, corrNr?, timestamp?}`，dtp 是 `{lockHandle, transport?}`，dataSource 是 `{lockHandle, transport?, timestamp?, headers?}`（RSDS 的 Transport-Lock-Holder 等 quirk 留在 api 层）；trfn update 的 `version` 参数（默认 "m"）一并镜像。
- **delete 自管锁**：内部域锁原语（`lockADSO`/`lockTransformation`/`lockDTP`）→ `BWObject.delete({lockHandle, transport?})` → 成功即返回、不追加门面级 unlock——`BWObject.delete` 内部已含一次吞错的 unlock（bwObject.ts），卡带证据为 lock→DELETE→unlock 全 200（2026-09-22 录制，见[卡带闭环](2026-09-22-cassette-recording.md)）；delete 失败时锁还挂着，做一次 best-effort unlock（吞错，不掩盖原异常）再上抛。options 从 `{lockHandle?, transport?}` 收窄为 `{transport?}`——**0.x minor 行为变化**（lockHandle 不再是调用方输入）。
- **一致性边界**：`advanced` 是子面访问器、非家族动词——domain-registry 的一致性断言显式排除（排除规则写在测试注释），四域 registry notes 各记一行「advanced 子面：…」。
- **flat 16 方法加 `@deprecated` 指向 `client.<domain>.advanced.<verb>()`**（JSDoc-only，签名/实现零变化）：lockADSO/unlockADSO/activateADSO/updateADSO、lockTransformation/unlockTransformation/activateTransformation/updateTransformation、lockDTP/unlockDTP/activateDTP/updateDTP、lockDataSource/unlockDataSource/activateDataSource/updateDataSource。泛型 objectType 方法与其余 unmapped flat 不动。

## Alternatives considered

- **delete 维持薄转发**（动词族审计原决策）：倒挂不消除——弃用面成了唯一供锁路径，且每个调用方被迫手写 lock/unlock 编排、常漏失败路径清理；两锁契约的矛盾必须在门面层裁决而非留给调用方。
- **delete 走 withWriteSession 引擎**：引擎契约是 lock→steps→unlock-finally（[会话模型](2026-09-18-write-session-model.md)/[引擎](2026-09-21-write-session-engine.md)），与"BWObject.delete 内部自带吞错 unlock（卡带证据 lock→DELETE→unlock 全 200）、成功不追加门面级 unlock"直接冲突——要么给引擎开 delete 特例，要么在引擎外重写编排（违反"编排只在 writeSession.ts 维护"不变量）。delete 的就地 try/catch 只有两步且清理语义不同，是最小诚实实现。
- **lock/unlock/activate/update 直接提为门面动词（无子面）**：与自管动词撞名（`dtp.activate` 已是锁→激活→解锁一站式）或污染 verbs 家族表；子面命名空间让"我拿着锁"与"你替我管锁"在调用点一眼可辨。
- **flat 16 方法直接删除**：渐进弃用是既定政策（flat-deprecation），删除超范围；本变更只是把弃用箭头从"无处指"变成"指到 advanced"。
- **trfn/dtp/dataSource 也加 advanced.delete**：三域的自管 delete 已在门面，调用方持锁删除的需求无实测证据（不发明面）；adso 的 advanced.delete 保留是因为它承接的是 P1-B 已发布过的调用方持锁删除契约。

## Consequences

- 旧调用方（给 delete 传 lockHandle）在 TS 编译期即断——多余属性运行期被忽略、行为不变；0.x 语义下这是 minor 可携带的破坏，调用方迁移路径为「直接删掉 lockHandle 参数」。
- Advanced 层原语有了正名入口：16 个 flat 方法从"47 个不标注"清单移入弃用集合，弃用箭头闭合；TS 工具链即刻在旧入口标删除线。
- `advanced` 每次访问返回新冻结对象（getter 语义）；方法经箭头函数绑定 `this.h`，无独立会话状态。
- "registry verbs == 原型方法名"不再字面成立：显式排除 `advanced` 后，一致性断言保护的是家族动词清单；子面内容以 registry notes 与 advanced-ops.test.ts 为准。
- delete 成功路径不依赖任何"服务端 DELETE 即释放锁"的行为——`BWObject.delete` 内部自带的吞错 unlock（bwObject.ts）保证释放，证据为真机卡带 lock→DELETE→unlock 全 200 与 VERIFIED_APIS §8 的端到端记录；失败路径的 best-effort unlock 吞错、不掩盖原异常——比 `dtp.activate` 的裸 `finally` 清理更严（后者的 unlock 若失败会用 unlock 错误掩盖 activate 的原异常）。
- dtp.activate 的裸 finally 会用 unlock 错误掩盖原异常——待收窄（对齐 delete 的吞错语义）。

## Testing

- `src/__tests__/domain-verbs.test.ts`：三域 × 4 组 delete 断言（lock 被调 → BWObject.delete 收到 lockHandle → transport 透传；省略 options 仍自管锁；失败路径 best-effort unlock 吞错且原异常上抛；unlock 自身失败仍上抛原异常）+ 成功路径 unlock 未被调用。
- `src/__tests__/advanced-ops.test.ts`：四域 advanced 冻结断言 + 每域抽 2 个动词逐参转发 + adso.advanced.delete 的 lockHandle/transport 原样透传。

## Related

- 被部分取代的原决策（两篇互链）：[动词族审计 close-out](2026-09-22-verb-family-audit.md)——delete 从"薄转发、锁归调用方"改为自管锁。
- 事实更新：[flat 弃用注记](2026-09-22-flat-deprecation.md)——16 个 lock/unlock/activate/update 方法移入弃用集合。
- 会话模型与引擎契约（delete 未走引擎的原因）：[write-session-model](2026-09-18-write-session-model.md)、[write-session-engine](2026-09-21-write-session-engine.md)。
- 一致性断言的排除规则与 notes 记录：[域注册表](2026-09-21-domain-registry.md)。
- 删除链路 lock→DELETE→unlock 全 200 的卡带证据（末次 unlock 是 `BWObject.delete` 的内部吞错 unlock）：[真机卡带录制闭环](2026-09-22-cassette-recording.md)；`docs/VERIFIED_APIS.md` §8。
