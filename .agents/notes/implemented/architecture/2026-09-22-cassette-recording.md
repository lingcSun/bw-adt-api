# Agent Note: 真机卡带录制闭环（record/replay）

Status: implemented

## Problem

P3 落地了回放设施（ReplayHttpClient + 手工卡带），但手工卡带只能证明引擎遵从 §2 规约，无法证明引擎在真实系统面前跑通；真机录制的工具链缺最后一环——没有把「登录→建靶子→写→删→登出」串起来并落盘卡带的入口。

## Decision

`scripts/record-cassette.mjs`（gitignore 白名单放行的永久工具，双模式）：

- **录制模式**（默认，连真机）：`RecordingHttpClient` 包住 `AxiosHttpClient` 注入 `BWAdtClient`，跑自建靶子的完整生命周期——login → `adso.create`（`$TMP`，模板可配）→ `xml` → `saveAndActivate` → `addField` → `details`/`versions` → `delete`（lockHandle 模式）→ `exists` 复核 → logout；交互全部落盘 `.local/cassettes/*.json`。
- **回放模式**（`--replay <cassette>`）：同一流程换 `ReplayHttpClient` 离线重放，请求序列与卡带完全一致即闭环成立。
- **脱敏**：落盘前对 Authorization/Cookie/set-cookie/CSRF/contextid 头值打 `[REDACTED]`（回放匹配只用 method+URL 路径，脱敏不影响闭环）；响应体保留真实数据，卡带在 `.local`（默认不入库），提交前需人工审阅。
- **即建即删**：靶子名默认 `ZBWAPI_R1`（ADSO 名限 3-9 字符），`finally` 兜底清理。

2026-09-22 真机实录：28 条交互全流程成功（创建/激活/加字段/删除均留痕），同卡带回放序列完全匹配。

## Alternatives considered

- **固定脚本序列直录**（不用门面/无清理兜底）：录制内容不可复现、失败留残留，违背 test-objects 纪律。
- **把卡带纳入 `describeLive` 之外的常规断言源**：卡带是录制快照而非规约；真机行为断言仍走活系统套件，卡带测试只作为回归复放（与本仓 test-dont-assume 纪律一致）。

## Consequences

- 「录制→回放」闭环可用：真机一次会话换来无限次离线复放；卡带升级了写路径离线测试的证据等级（规约桩 → 实测复放）。
- 卡带含真实系统响应体：**入库前必须人工审阅**（脱敏只处理凭据类头）；进 CI 的固定卡带路径与消费方式待下一阶段定义。
- BWObject.delete 的 ADSO/InfoArea/TRFN 锁柄模式（`bwObject.ts:550-567`）在删除链路中被真实行使并录制。

## Related

- 回放设施：[replay-infrastructure](2026-09-22-replay-infrastructure.md)
- 会话模型出处：[write-session-model](2026-09-18-write-session-model.md)；VERIFIED_APIS §2
