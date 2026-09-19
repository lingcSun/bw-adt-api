# Agent Note: VERIFIED_APIS 证据账本与凭据纪律

Status: implemented

## Problem

对 SAP 服务端行为的断言来源曾经混乱：Eclipse 抓包的表象（曾导致 `stateful;enqueue` 头误用与"JCo 限制"误判）、临时脚本实测、记忆。没有统一证据记录时，被推翻过的错误结论会以"已验证"的名义复活。同时，真实系统的连接信息（主机、账号、令牌、TR 号、客户对象技术名）一旦入库就是凭据泄漏。

## Decision

（d0d9e0a "re-add redacted VERIFIED_APIS and scrub credential examples"）

- **`docs/VERIFIED_APIS.md` 是唯一证据账本**：记录在真实 BW/4HANA 系统上实测通过的行为与会话模型（基准 2026-07-15，后续模块按同一模型复测）；文档刻意**不含**主机、账号、会话令牌、传输号与客户对象技术名，本地复验用 `.env` 与自有测试对象。
- **凭据纪律**：连接参数只经环境变量（`.env` 不入库）；示例一律脱敏；本地个人配置与通信日志不入库（`CLAUDE.md`、`.claude/`、`Communication Logs/` 已 ignore，本地 `communation logs/` 目录为未跟踪工作区）。
- **断言门槛**：代码注释、文档、笔记中对服务端行为的新断言，必须先有 VERIFIED_APIS 记录或可复现测试背书。
- `docs/ROADMAP.md` 跟踪模块完成度（对照 discovery 端点能力），与证据账本互不替代：一个说"做了什么"，一个说"凭什么信"。

## Alternatives considered

- **集成测试作为唯一证据**：没有 BW 环境时全部 skip，证据随环境消失。
- **在仓库保留原始通信日志**：泄漏面不可控。
- **无账本、靠记忆与提交信息**：提交信息不可检索也不可更新，错误结论无法被系统性推翻。

## Consequences

- 修 bug 的固定次序：查账本复现 → 改代码 → 回写账本；账本与代码同步演进。
- 脱敏是持续性义务：任何新文档或示例合入前过一遍凭据检查。
- 账本用中文维护（与 docs/ 其余文档一致）；这是工作语言选择，不影响其权威性。

## Related

- 账本所支撑的最重要结论见 [已验证的写操作会话模型](../architecture/2026-09-18-write-session-model.md)。
- 该纪律的工作流强制见 [test-dont-assume](../../../skills/test-dont-assume/SKILL.md) 技能。
