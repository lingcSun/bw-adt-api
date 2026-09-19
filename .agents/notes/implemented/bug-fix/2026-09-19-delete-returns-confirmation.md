# Agent Note: delete() 返回删除确认对象

Status: implemented

## Problem

`BWObject.delete()` 声明为 `Promise<void>`，整个调用链（含 `BWAdtClient.deleteObject` 与 MCP 工具 `bw_object_delete`）resolve 为 undefined。MCP 侧把工具返回值直接 JSON 序列化为结果文本：`JSON.stringify(undefined)` 返回 undefined，`content[0].text` 缺失，MCP 客户端报 schema 校验失败——而服务端删除实际已成功。LLM 看到"失败"可能重试或误判状态，对不可逆的删除操作尤其危险。abap-adt-api 的 `login()` 曾有同型缺陷（undefined 结果导致 MCP schema 校验失败），fork 中已按同思路修复过。

## Decision

`delete()` 返回确认对象 `{ deleted: true, objectType, objectName }`，签名改为 `Promise<{ deleted: true; objectType: T; objectName: string }>`。`objectType` 为枚举字符串值（如 `"adso"`），`objectName` 为调用方传入的原始名称。成功路径（DELETE 请求 + lockHandle 模式下的 unlock/dropSession 清理）完成后返回；失败仍照常抛出，不用确认对象包裹错误。

## Alternatives considered

- **只修 MCP 侧 ok() 兜底**：已在 mcp-bw-adt 落地（undefined 结果兜底为 `"ok"`），但 API 消费者拿不到"删了什么"的确认，删除工具仍无可报告的结果。两层都修：API 层给语义，MCP 层兜 schema。
- **返回服务端原始响应**：DELETE 成功常为空体，仍拿不到有意义内容，解决不了问题。

## Consequences

- 离线测试断言两种模式（lockHandle / transport）的确认对象；`bw_object_delete` 的 MCP 结果从 undefined 变为可读 JSON。
- mcp-bw-adt 依赖 npm 发布的 `bw-adt-api@^0.3.0`，需发布新版本后才能拿到该返回值；在此之前 ok() 兜底独立保证结果 schema 合法。
