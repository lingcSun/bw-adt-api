# Agent Note: BWObject create/update 的 finally 解锁与锁所有权

Status: implemented

## Problem

泛型基类 `BWObject.create()` / `update()` 在 lock 成功后，若 create POST / PUT 抛错，unlock 永不执行，enqueue 锁挂到会话超时。四个 `saveAndActivate*` 编排都在 `finally` 中解锁，唯独被 `bw_area_create`（MCP 在用）和 `client.createObject` / `updateObject` 走的基类没有。另一处隐患：`update()` 允许调用方传入已有 `lockHandle`（如 `updateDTP`），无差别在 finally 解锁会解掉别人的锁。

## Decision

- `create()`：恒为自己加锁，整个"创建 + 激活"包进 `try`，`finally` 中 `unlock`；InfoArea 的 `dropSession` 清理随之移入 finally（unlock 之后）。
- `update()`：引入 `ownLock = !providedLockHandle` 语义——自己加的锁在 finally 释放；调用方传入的 lockHandle 归调用方管理，绝不代解。
- finally 中的 unlock 不捕获异常，与 `saveAndActivate*` 现有约定一致（unlock 失败应当暴露）。

## Alternatives considered

- **只给 create 加 finally、update 保持原样**：update 自加锁场景（`updateObject` 不传 lockHandle）同样漏锁，不彻底。
- **unlock 失败时吞异常**：会把"锁仍被持有"的信号藏起来；saveAndActivate 家族的既有约定是裸 unlock，保持一致。

## Consequences

- 失败路径行为变化：此前漏锁 → 现在释放；成功路径无变化。
- 调用方以 `{ lockHandle }` 复用外部锁的语义从此有明确承诺：库不代解。
