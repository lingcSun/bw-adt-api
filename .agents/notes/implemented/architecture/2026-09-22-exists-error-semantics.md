# Agent Note: exists() 错误语义收窄——HttpClientException 重抛，AdtError 归 false

Status: implemented

## Problem

[动词族审计](2026-09-22-verb-family-audit.md)给 adso/trfn/dtp 三域补 `exists` 时，门面用 `catch { return false }` 统一吞异常：validation 端点对不存在的对象直接报错（实测负例语义，API_REFERENCE validateADSOExists 行），把这类 AdtError 归 false 是对的；但 `HttpClientException`（网络断连、会话失效等传输层失败，类注释明确其为传输层错误）也被吞成 false——「查不到」伪装成「确认不存在」，调用方会把一次网络抖动当成对象已删除。[infoProvider 多态域](2026-09-22-infoprovider-domain.md)批判过同款「把没验证伪装成不存在」，exists 的全吞是同一错误在网络维度的翻版。

## Decision

- 三域 `exists()` 的 catch 收窄：`isHttpClientException(e)`（`src/AdtHTTP.ts` 导出）→ **原样重抛**；其余（AdtError，含 not-found 形态）→ 归 false 不变。三域同步，api 层 `validate*Exists` 零改动（仍原样抛错）——收窄只发生在门面归一处。
- **不做 AdtError 消息匹配**去细分 not-found 与其他业务错误：not-found 消息可能随 `BW_LANGUAGE` 本地化（ZH 环境形态不同），消息子串是脆弱契约；类边界（传输层 vs ADT 业务异常）才是稳定判据。这是诚实边界：门面 false 覆盖的是「validation 语义层说不存在」，不是「一切异常」。
- 测试：`domain-verbs.test.ts` 原有「rejection → false」用例拆成两类——HttpClientException → `rejects.toBe(原异常)`（锁引用恒等即「原样」）、AdtError（not-found 形态）→ false。

## Alternatives considered

- **维持全吞（简单归一）**：有损语义留给调用方自行改走 api 面 verify——正是本笔记修的缺陷，不选。
- **全部重抛、不归 false**：负例报错是 validation 端点实测语义，归 false 才让 `exists` 成为纯布尔谓词；全重抛等于废除该动词的归一职责。
- **按 HTTP status 或消息子串区分 not-found**：status 形态随服务端/网关漂移，消息随语言漂移，均非稳定判据。

## Consequences

- **行为变化**：网络/会话层故障从「resolve false」变为「reject 原异常」。依赖旧行为把网络错误当 false 的调用方需要补 catch——按 semver 这是修复伪装的缺陷（0.x minor 承载），不是破坏。
- 「确认不存在」与「查不到」在门面层可区分：false 只剩 AdtError 路径；传输层失败显式上抛。
- verb-family-audit 中「网络故障也会得到 false」的有损语义记录由本笔记接替，其事实描述已同步更新。

## Related

- exists/delete 薄转发与 dataSource 边界的出处：[动词族审计](2026-09-22-verb-family-audit.md)。
- 「把没验证伪装成不存在」的批判出处：[infoProvider 多态域](2026-09-22-infoprovider-domain.md)。
- 同批台账清理（9 项）的注释/测试侧小项，不另设笔记：卡带 qs 捕获与 cloneHeaders 数组拷贝泛化（`src/testing/replay/cassette.ts`，测试锁定）、domain-verbs/infoarea 两套件 jest.mock 工厂迁 spyOn（P1-B 遗留，等价迁移）、AdsoModel op 记录 Object.freeze（账本不可变语义落地，`src/model/adso.ts`）。
