# Agent Note: InfoArea 结构域归位——tree/validate 动词各回各家

Status: implemented

## Problem

InfoArea 的两个动词寄居在错误的域：对象树查询（`getInfoproviderStructure`）挂在 `repository.infoproviderStructure`、存在性校验（`validateInfoArea`）挂在 `adso.validateInfoArea`。按[域分类学](./2026-09-21-domain-taxonomy.md)，InfoArea 是 structure kind 的容器域，tree/validate 是它的正名动词；寄居状态下，"在 InfoArea 上导航/校验"这一意图被拆在两个不相关的门面里，注册表也只能给 infoArea 记一条"尚未挂载"的占位词条。

## Decision

- **`src/domains/infoArea.ts`** 新建 `InfoAreaDomain`：`tree(infoArea, type?)` 委托 `repository.getInfoproviderStructure`、`validate(name)` 委托 `adso.validateInfoArea`——api 函数签名零变化，门面纯转发（两层结构不变）。
- **挂载**：`BWAdtClient.infoArea`（第 12 个域门面字段），`src/domains/index.ts` 同步导出。
- **旧位置只降不删**：`repository.infoproviderStructure` 与 `adso.validateInfoArea` 方法体原样保留，JSDoc 加 `@deprecated 使用 client.infoArea.tree/validate`；注册表 adso 词条 notes 与 infoArea 词条补实（记录归位去向）。
- **哨兵翻转**：`domain-registry.test.ts` 的 `EXPECTED_UNATTACHED` 由 `["infoArea"]` 翻为 `[]`，infoArea 进入 verbs == 原型方法名 的一致性断言。

## Alternatives considered

- **旧位置直接删除**：破坏公共面，违背 P1 约束（既有门面字段与方法签名全保持）；降级为 @deprecated 让迁移可增量进行。
- **InfoAreaDomain 自带缓存/解析增强**：域门面藏逻辑会破坏两层结构的转发纪律；tree 的解析已在 api 层（`parseInfoproviderStructure`），门面不加第二层。

## Consequences

- `client.infoArea.tree/validate` 成为正名入口；旧调用继续工作但 TS 工具链会标删除线，P1 后续任务（动词族审计）可据此清理。
- 注册表 12 域全部挂载，一致性断言覆盖完整；未来新域若先登记后挂载，哨兵仍是绊线。
- 离线测试新增 jest.mock 模块替换模式（`src/__tests__/infoarea-domain.test.ts`），后续纯委托断言可复用。

## Related

- kind 三分类与 tree/validate 的家族归属：[域分类学提案](./2026-09-21-domain-taxonomy.md)。
- 注册表与哨兵机制：[域注册表](2026-09-21-domain-registry.md)。
- 门面只转发不藏逻辑：[api 函数层与 domains 门面层的两层结构](2026-09-18-api-domains-two-layer.md)。
