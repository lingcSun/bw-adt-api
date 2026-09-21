# Agent Note: nodepath 双重编码修复（V5）与 Eclipse 日志对照法

Status: implemented

## Problem

读验证轮把 `getADSONodePath` 判为「与服务端契约脱节、本系统不可用」（`Data type "" does not exist`）。用户提供 08:51 Eclipse 通信日志后对照发现：Eclipse 调同一端点 `repo/nodepath?objectUri=%2F…%2Fm` 返回 200——端点存在且工作，库的失败必有客户端成因。

## Decision

真机三组对照定位根因：**调用方预编码 + 传输层编码 = 双重编码**。`qs` 值经 axios `params`（单次 encodeURIComponent），`getADSONodePath` 又先 `encodeURIComponent(objectUri)`，上线成 `%252F…`，服务端解一层后拿到字面 `%2F…` 串。修复 = 删除预编码，qs 传原始 URI（`adso.ts` 内注释固化该契约）；回归锁 `adso-nodepath-encoding.test.ts` 断言 qs 收到的是原始串、不含 `%2F`。修复后真机实测返回 3 节点。

同一轮按 Eclipse 日志真机探测了 5 个库外端点（iobj/versions、iobj/configuration、rules/qprops、queryint user_props、repo/infoproviderstructure），全部 200（qprops 需 vendor Accept，报错原文已暴露内容类型）——记录在账本 V5 条目，未入库。

## Alternatives considered

- **调用方自己拼完整 query 串绕过 qs**：把编码责任摊到每个调用点，将来新调用点还会踩；收敛为"qs 永远传原始值"的单一契约更可守。
- **传输层改为不编码（formatQS 自管）**：动 AdtHTTP/Axios 序列化会影响全部 50+ 端点的线上形态，风险与收益不成比例。
- **把 nodepath 顺带改成通用 getNodePath(objectUri)**：API 面变更（新增通用函数），与本次 bug 修复分开决策。

## Consequences

- 全库扫描确认预编码-进-qs 仅此一处（其余 19 处 encodeURIComponent 都在 URL 路径段，正确用法）；新调用点由回归测试与注释约束。
- "端点不可用"的结论被推翻一条：**Eclipse 能通而库不通时，优先怀疑客户端请求形态**——这正是账本纪律里"Eclipse 抓包只是假设"的反向应用：抓包不能证明库对，但能证明端点在。
- 5 个库外端点入库与否待决策（qprops/infoproviderstructure 有 BICS 预检价值，user_props 是 Eclipse UI 状态建议放弃）。

## Testing

`npm run build` 通过；`adso-nodepath-encoding.test.ts` 绿；修复后真机 `getADSONodePath(zadso_02)` 返回 3 节点（此前 ❌）；既有离线套件全绿。

## Related

- 发现与验证轮：[读 API 验证轮笔记](../process/2026-09-20-api-reference-generator-read-sweep.md)、[VERIFIED_APIS 第 7 节](../../../../docs/VERIFIED_APIS.md)。
