# Agent Note: DTP execute 改为诚实的触发语义

Status: implemented

## Problem

`parseDTPExecutionResponse` 无条件返回 `success: true`，并读取虚构的 key（`requestID` / `recordsProcessed` / `startTime` / `endTime`）——没有任何已记录的响应格式支持。`?action=execute` 的真实响应从未采集入 VERIFIED_APIS（账本只写"execute 为运维执行"）。后果：`client.executeDTP` / `bw_dtp_execute` 把失败的执行报成成功。另一个被掩盖的事实：DTP 执行是异步的，HTTP 2xx 只代表"服务端接受了触发"，不代表加载完成或成功。

## Decision

- `executeDTP` 返回 `{ triggered: true, raw: <原始响应体> }`：`triggered` 表达"已触发"而非"加载成功"；真实格式采集前不做任何解析。
- 删除 `parseDTPExecutionResponse` 与 io-ts 版 `DTPExecutionResult`，改为同名 interface（`api/index` 的 type 再导出不受影响）。
- JSDoc 与 mcp 工具描述同步写明"触发成功 ≠ 加载成功，结果看监控/日志"。

## Alternatives considered

- **猜测真实格式并写解析器**：正是本次要修掉的错误模式（test-dont-assume 违例），禁止在无证据时固化解析。
- **保留旧形状只加 raw 字段**：`success: true` 的假信号必须消失，保留即继续误导调用方。

## Consequences

- 返回结构变化（0.4.0 变更说明注明）——旧结构语义为假，无可保留价值。
- 待办：真机采集一次 execute 响应，为 `raw` 写真实解析器并记入 VERIFIED_APIS。
