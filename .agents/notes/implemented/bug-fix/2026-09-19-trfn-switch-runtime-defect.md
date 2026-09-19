# Agent Note: TRFN 运行时切换的杂合方法缺陷与一站式重构

Status: implemented

## Problem

`BWAdtClient.switchTransformationRuntime` 是一个形状上的杂合体：签名学 Advanced 风格（要求调用方自备 `lockHandle`），内部却自己 GET + PUT。实现时误用 `getTransformation`（`fullParse` 后的对象）而非 `getTransformationXml`（原始 XML 串），把 `JSON.stringify` 的产物当 XML PUT 回服务器；且 `HANARuntime="(true|false)"` 替换正则在 JSON 上不命中，"切运行时"本身也是空操作。该缺陷随 0.3.0 发布，mcp-bw-adt 的 `bw_trfn_switch_runtime` 端到端不可用（还叠加 lockHandle 在 MCP 面无处可取）。同族的 `setEndRoutineFields` / `addTransformationRulesAndSave` / `autoMapTransformationFieldsAndSave` 全部是"纯助手 + 一站式（内部 `getTransformationXml`、无 lockHandle 参数、锁在 finally 解）"两层形状，唯独本方法反着来。

## Decision

按家族约定拆回两层（2026-09-19 审查修复），**旧方法直接移除**（不走弃用周期）：

- 新增独立一站式 `BWAdtClient.switchRuntimeAndSave(trfnId, useHanaRuntime, options?)`：内部 `getTransformationXml` → 纯助手替换 → `saveAndActivateTransformation`（transport/unlock 生命周期沿用现有编排）。
- 移除 `BWAdtClient.switchTransformationRuntime`（public 破坏性移除，随 0.4.0 发布）。
- 纯助手 `api/transformation.ts` 的 `switchTransformationRuntime(xml, useHana)` 与 `TrfnDomain.switchRuntime` 不变——移除的只是 client 上的杂合方法。

## Alternatives considered

- **修内 + `@deprecated` 渐进弃用、0.4.0 再删**：曾按此实现过一版；否决——库尚未到 1.0、唯一已知调用方（mcp-bw-adt）同一变更内已切到新方法，弃用周期只会让坏形状多活一个版本。
- **只修一行（换成 `getTransformationXml`）不动形状**：能止血，但"要求外部 lockHandle"的缺陷仍在，MCP 面依旧无法使用，且与同族三个方法的约定相悖。
- **服务端原子端点**：Eclipse 里切运行时本就是改 `HANARuntime` 属性后的普通保存激活，不存在专门的 REST 端点，无从谈起。

## Consequences

- 破坏性变更：直接调用 `client.switchTransformationRuntime` 的外部消费方需改用 `switchRuntimeAndSave`（签名差异：无 lockHandle，新增 transport 选项，默认带激活）。
- 运行时切换有了可从 MCP 直接调用的入口（工具 schema 同时去掉 `lockHandle`）。
- **HANA↔ABAP 切换流程在真实系统上的端到端验证仍待执行**（此前实现从未成功过），验证后记入 [VERIFIED_APIS](../../../../docs/VERIFIED_APIS.md)。
