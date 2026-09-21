# Agent Note: withWriteSession 写会话引擎

Status: implemented

## Problem

saveAndActivateADSO/Transformation/DTP/DataSource 是同一已核实序列（VERIFIED_APIS §2）的四份手写实现：每域各写一遍 lock→transport→PUT→activate→unlock(finally)。重复导致：新增域要复制整个编排；部分失败恢复、审计、重试语义没有唯一归属；会话模型的任何修正要改四处。

## Decision

新增 `src/api/writeSession.ts` 的 `withWriteSession(client, steps, options, transportResolver?)`：引擎持有顺序、finally 解锁、transport 解析（默认 `resolveTransportForWrite`，可注入以便离线测试）与 autoActivate 分支；域以四个步骤闭包适配各自参数形状（DTP 的 transport/corrNr 差异、RSDS 的 sourceSystem、timestamp 提取留在闭包内）。四域包装函数对外签名不变。离线单测用注入 resolver + 桩步骤锁定顺序与 finally 语义。同批给集成套件落地 `describeLive`/`testLive` 离线守卫（`BW_BASE_URL` 未设即 skip），CI 接入 `npm test`。仅 kind=modeling 的域接入引擎（见 [domain-taxonomy](../../proposed/architecture/2026-09-21-domain-taxonomy.md) 提案笔记）。

## Alternatives considered

- **声明式配置表（URI 模板/激活路径字符串化）**：可让域完全无代码，但需重写各域 lock/update 函数为配置驱动，超出纯重构边界；留待后续演进。
- **仅加注释约束手写序列**：零收益，重复仍在。

## Consequences

- 会话模型修正只改 `writeSession.ts` 一处；新增建模域写编排 = 四个闭包（AGENTS.md 不变量）。
- 引擎测试离线可跑；活系统回归依赖既有集成套件（配置 `BW_TEST_*` 靶子后运行）。
- 2026-09-18-write-session-model 笔记仍有效（模型本身未变），本笔记是其实现的单一化，交叉链接不 supersede。
