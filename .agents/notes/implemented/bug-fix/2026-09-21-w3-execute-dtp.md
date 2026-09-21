# Agent Note: W3 修复——DTP 执行的真实 API（executerun）

Status: implemented

## Problem

`executeDTP` 旧形态 `POST /dtpa/{id}?action=execute` 在本系统报「内部错误：不支持 URI」，该函数历史无任何真机验证记录（写验证轮 W3）。真实触发与轮询端点无从服务端探知（报错不泄漏路径）。

## Decision

用户提供两条 Eclipse 抓包（2026-09-21 10:44 触发 / 10:45 轮询）钉死完整 API：

- **触发**：`POST /sap/bw/modeling/dtpa/executerun`，body `<executeRun dataTransferProcess="{dtpId}"/>`（dtpa-v1_0_0+xml，stateless）→ **201 Created**、无响应体、运行 ID 在 **Location 头** `/executerun/{dtpId}/{runId}`。
- **轮询**：`GET /executerun/{dtpId}/{runId}?withLog=true` → 200 + `<executeRun dataTransferProcess requestId/>`。

据此改写 `executeDTP`（返回 triggered/runId/location/status）并新增 `getDTPExecuteRunResult`（解析已证实属性，完成态日志子节点未采样故 raw 透传、不虚构）。客户端包装与导出面同步。

## Alternatives considered

- **只修触发不建轮询**：触发拿到的 runId 没有消费方，API 只有半个故事。
- **解析轮询响应的全部子节点**：完成态（带日志）的 XML 形态没有证据，猜测字段就是 V5/V7 之前犯过的错——只取抓包证实的两个属性。
- **变体喷探针**（本地 DTP 上试多种 URL）：写验证轮已决定不猜——抓包一次到位。

## Consequences

- `DTPExecutionResult` 形状变化（triggered/raw 之外新增 runId/location/status；triggered 语义从"未抛错"收紧为"201"）。
- DTP 执行从"库内不可用"变为完整闭环（触发→轮询→删除），全程库路径。
- 完成态日志子节点的解析留待后续证据（raw 已透传，升级不破坏调用方）。

## Testing

`w3-execute-dtp.test.ts` 4 测试绿（URL/body/头/Location 解析、旧形态断言禁用、轮询参数与属性解析、withLog 透传）。真机（库路径）：201+runId、轮询 requestId 匹配、空载 DTP 无日志子节点（与抓包形态一致）、清理经 W1 删除路径。写类终态 23 ✅ / 20 ⚠️（全部范围外登记）/ **0 ❌**。

## Related

- [VERIFIED_APIS 第 8 节 W3](../../../../docs/VERIFIED_APIS.md)、[写验证轮笔记](../process/2026-09-21-write-sweep.md)。
