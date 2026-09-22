# Agent Note: P3 待办清账——死链、op 浅快照、幂等 no-op 记账、spyOn 打桩

Status: implemented

## Problem

P2/P3 评审积累了四笔小额欠账，各自独立但都到了「再不还就要误导人」的程度：

1. **死链**：域分类学笔记已从 `proposed/` 毕业，但 `InfoProviderDomain` 抛给**库使用者**的守卫错误文本（not verified yet）与两处 JSDoc、`registry.ts` 的头注释仍引用 `.agents/notes/proposed/` 下的同名旧路径——使用者照错误消息找文件必然扑空。
2. **M5 op 账本引用逃逸**：`AdsoModel.addField` 把调用者传入的 field 对象**按引用**记进 `ModelOp.args`——调用方在 addField 之后改写该对象，会追溯性改写已落账的历史，账本作为审计线索不可信。
3. **M6 幂等 no-op 记账未文档化**：`addKey` 对已存在的键，纯函数幂等返回原 XML（零差异），但模型仍记录一条 op；`plan()` 会预览一条不产生实际差异的编辑——行为本身诚实（意图确实发生过），但没有任何文档说明。
4. **jest.mock 工厂残留**：`infoprovider-domain.test.ts` 对 `api/search` 仍用 `jest.mock` 工厂，而 [adso-model 笔记](2026-09-22-adso-model.md)已把 spyOn 定为涉及 `src/model` 导入图的标准打桩法（且该笔记声称两套件均已迁移——与事实不符）。

## Decision

- **死链清扫**：四处全部改为 `.agents/notes/implemented/architecture/2026-09-21-domain-taxonomy.md`（`infoProvider.ts` JSDoc ×1 + 抛错文本 ×2、`registry.ts` ×1）；对 `src` 与 `.agents` 复跑同款死链 grep 零残留。测试断言只正则文件名 `2026-09-21-domain-taxonomy\.md`，不受路径变更影响，未改。
- **M5 浅快照**：`addField` 落账时记 `{ ...field }`；`ModelOp.args` 的 JSDoc 明示「对象实参在记录时做浅快照」。`removeField`/`addKey` 的实参是原始值，无需处理。adso-model.test.ts 新增断言：记录值与传入对象非同一引用，且调用后改写传入对象不影响已记 op 与工作副本。
- **M6 文档化**：`addKey` JSDoc 写明「键已存在时纯函数幂等返回原 XML——但仍会记录一条 op；plan() 可能预览不产生实际差异的编辑」。零行为变更。
- **工厂迁移**：`searchBWObjects` 改为 `jest.spyOn(searchApi, "searchBWObjects")`，与同文件 `getADSOXml`/`details` 的 spyOn 并列；套件头注释同步；断言一律未动。

## Alternatives considered

- **深快照（递归 clone）**：`ADSOFieldDefinition` 当前全是原始值字段，深拷贝是为不存在的嵌套上机器；JSDoc 已写明是「浅快照」，未来 args 出现嵌套对象时必须回来重审。
- **M6 改行为：检测零差异就不记账**：违背「账本 = 调用者可见意图」——调用者确实调用了 addKey，意图发生过；静默不记反而掩盖调用方的重复操作。故只补文档，不改行为。
- **search 换 `jest.mock` + requireActual 工厂**：正是 adso-model 笔记实测过的双实例失败模式（工厂与多入口 `../model` 导入图相遇产生第二份模块实例）；spyOn 是既定纪律，不是新偏好。
- **死链留着不管**：链接在公开抛错文本里，指着一个仓库内不存在的路径，比指向正确路径更糟。

## Consequences

- op 账本对调用侧事后改写免疫，审计线索恢复可信；`ops` getter 的浅拷贝语义不变（拷的是数组，op 对象本就只读约定）。
- 守卫错误的公开文案指向真实存在的笔记文件。
- 涉及 `src/model` 导入图的两套测试套件（adso-model、infoprovider-domain）现已全部 spyOn，adso-model 笔记的「均已改为 spyOn」声明与事实一致。
- 重复 `addKey` 每次都留一条 op：这是记录行为而非缺陷，`plan()` 的行数不等于实际 diff 行数。

## Related

- op-log 语义与 spyOn 纪律的属主笔记：[AdsoModel](2026-09-22-adso-model.md)。
- 死链指向的笔记本体：[域分类学](2026-09-21-domain-taxonomy.md)。
- 守卫错误所在的门面：[infoProvider 多态域](2026-09-22-infoprovider-domain.md)。
