# Agent Note: 移除 validation 端点的死方法（V1）

Status: implemented

## Problem

2026-09-20 读 API 全量验证（[验证轮笔记](../process/2026-09-20-api-reference-generator-read-sweep.md)）证实：validation 端点仅支持 `action=exists`（加可创建类型的 `new`）。`action=delete`/`action=activate` 被全类型拒绝，`objectType=PC` 整体非法，DTPA/PC 不支持 `new`——13 个 `validate*` 函数在唯一可测的真实系统上**从来不能工作**，只会把服务端报错泄漏给调用方。

## Decision

从 API 面移除全部死方法：

- 模块函数 ×13：`validate{ADSO,Transformation,InfoObject}Can{Delete,Activate}`（9）、`validateDTPNewName`、`validateProcessChain{Exists,NewName,CanDelete,CanActivate}`（4）。
- 支撑面：`BWObject.canDelete()/canActivate()`、`ValidationAction.DELETE/ACTIVATE` 枚举值、`BWAdtClient.validateDTPNewName/validateProcessChainExists/validateProcessChainNewName` 三个包装。
- 存活的验证面收敛为：exists（ADSO/TRFN/DTP/IOBJ/AREA）+ new（ADSO/TRFN/IOBJ）+ `BWObject.exists()/isNewNameAvailable()`。
- `v1-removal.test.ts` 锁定：已移除符号在根导出与 BWObject 上必须为 undefined，防止无意恢复。

删除依据与逐条服务端报错原文见 [VERIFIED_APIS 第 7 节 V1](../../../../docs/VERIFIED_APIS.md)。

## Alternatives considered

- **客户端 fail-fast（保留函数、调用即抛可操作错误）**：能改善报错体验，但保留一批"永远失败"的函数会继续出现在文档与补全里，诱导调用方选错路径；且 MCP 场景下"不存在的工具"比"会报错的工具"更省模型注意力。
- **只删 PC 的四个、保留 CanDelete/CanActivate**：实测 delete/activate action 是**全类型**被拒，不是 PC 特有；留一半没道理。
- **本轮顺手移除 V2（repository 模块 404 三函数）**：V2 的失败形态是端点整体不存在，可能是发行版差异而非永久不可用；与 V1 的"action 层面确证不支持"证据强度不同，留待单独决策。

## Consequences

- **API 面收缩（0.x minor 内的破坏性变更）**：升级方若调用被移除函数，得到的是 import/属性 undefined 而非运行时服务端错误——破坏得更早、更可见。
- 信息损失：文档不再展示这些函数及其服务端报错原文；该证据仍完整保留在 VERIFIED_APIS 第 7 节。
- 若未来系统升级后 validation 支持了 delete/activate action，需以新证据重建函数（账本条目为恢复时的验收标准）。

## Testing

`npm run build` 通过；`npm run gen:api` 集合断言全过（api 174→161、client 125→122、读 86→73）；`v1-removal.test.ts` 与既有离线套件全绿。

## Related

- 发现来源：[读 API 验证轮](../process/2026-09-20-api-reference-generator-read-sweep.md)、[VERIFIED_APIS 第 7 节](../../../../docs/VERIFIED_APIS.md)。
- 未处置的同类发现：V2（repository 模块）、V4（命名空间名编码）、V5（nodepath 契约）。
