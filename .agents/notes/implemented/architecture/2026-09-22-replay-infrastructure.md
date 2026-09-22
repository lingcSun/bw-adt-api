# Agent Note: 回放基础设施（卡带格式 + Replay/Recording HttpClient）

Status: implemented

## Problem

P3 要离线验证写路径编排：withWriteSession 引擎的序列合规、§2 会话模型的线上请求语义（stateful 带 contextid、unlock 在 finally、PUT 带 lockHandle）。现有手段两头不够——一次性手写桩没有标准诊断、拿不到统一的请求捕获；活系统集成测试（describeLive）进不了 CI、跑不了离线回归。缺一套可复用的「录制/回放 HTTP 交互」基础设施。

## Decision

新增 `src/testing/replay/` 三模块（测试侧基础设施：不进包根导出，`src/api/**`、`src/model/**` 零改动，零新依赖）：

- **cassette.ts**：`Cassette`/`CassetteInteraction`/`SentRequest` 格式（磁盘 JSON：`{ interactions: [{ request, response }] }`）；`cassette()` 手写构造器只须 `method`+`url`，status/statusText/headers/body 兜底默认值；`loadCassette` 读盘并校验（错误带路径与交互序号）。
- **ReplayHttpClient.ts**：`implements HttpClient`，FIFO 消费交互。匹配 = method 忽略大小写（缺省视为 GET）+ 卡带 url 是请求 url 的**按路径段前缀**；URL 归一化剥掉 query/fragment/`scheme://authority`/前导 `//host`、相对路径补 `/`，**不做百分号解码**。`.sent: readonly SentRequest[]` 捕获每个经过的请求快照（method/url/headers/body，含失配与耗尽的）。失配（`CASSETTE_MISMATCH`）与耗尽（`CASSETTE_EXHAUSTED`）抛 `HttpClientException`，诊断同时给出期望的下一条交互与实际请求；失配不消耗交互，成功才前进游标。
- **recording.ts**：`RecordingHttpClient(inner, sink?)` 透传真实 HttpClient 并记录请求/响应快照（快照拷贝，事后篡改不影响已录内容）；`saveCassette(path)` 落盘 JSON——replay 目录唯一磁盘写点。inner 异常原样上抛、不记录（卡带只录制成功往返）。

驱动方式与 [write-session-engine](./2026-09-21-write-session-engine.md) 的离线测试互补：`new AdtHTTP(replayClient, ...)` 构造即离线（零外呼），`login()`+stateful 请求走完后在 `.sent` 上直接断言 `X-sap-adt-sessiontype`/`sap-contextid` 等线上头语义——单测已验证该通路。

## Alternatives considered

- **每测试自写一次性桩 HttpClient**：无复用、无标准诊断、没有 `.sent` 这类统一捕获面；被本设施取代。
- **nock / axios-mock-adapter 拦截库**：违反零新依赖约束，且只拦 axios 层，拿不到 HttpClient 抽象的请求快照语义。
- **按请求 key（method+url）索引匹配而非 FIFO**：keyed 匹配允许乱序消费，但 ADT 流程的顺序本身是规约的一部分（lock→PUT→activate→unlock），keyed 会把顺序 bug 吞成「通过」；选 FIFO，失配诊断同时给出期望的下一条交互，顺序偏离直接显式失败。
- **录制异常也进卡带**：格式膨胀成 union，P3 写路径测试只关心成功往返 + 引擎请求语义；异常透传上抛即可。

## Consequences

- **诚实原则：手工卡带只用于「引擎遵从 §2 会话规约」类测试——它验证的是本仓库代码的合规性，不是 SAP 服务端行为；凡断言「服务端真实行为」的测试仍必须走活系统（describeLive），卡带回放结果永远不得作为线上实测证据引用**（证据账本 [VERIFIED_APIS.md](../../../../docs/VERIFIED_APIS.md) 的地位不受影响）。
- 写路径编排回归从此可离线进 CI（后续任务接入）；`.sent` 是线语义断言的唯一入口。
- URL 归一化不做百分号解码：卡带 url 与请求 url 必须用同一编码书写，编码不一致按显式不匹配失败（显式失败好过静默误配）。
- 卡带可手写（引擎合规测试）也可真机录制（RecordingHttpClient 落盘）；录制 CLI 留待确有需要时另立。

## Related

- 第一个消费者（P3 Task 2）：[写引擎回放测试](../../../../src/__tests__/write-engine-replay.test.ts)——手工「§2 规约服务端」卡带离线驱动 `new AdtHTTP(replay, …)` + `saveAndActivateADSO` 全链路，对 `.sent` 断言 §2 线语义（stateful/stateless 会话头、contextid 只随 stateful、PUT URL 带 lockHandle、activation 失败仍 finally 解锁）；并用引擎变异（stateless 携带 contextid / 丢 finally 解锁 / 丢 lockHandle / 从不携带 contextid）逐一证实断言有牙。
- `.sent` 不含 `qs`（axios 才把 params 拼进 URL）：涉及 qs 的断言（PUT 的 lockHandle/corrNr）由该测试在测试侧包一层快照完整 options 补齐，本设施保持不动。
- 会话模型本体：[写操作会话模型](2026-09-18-write-session-model.md)；编排引擎：[withWriteSession 引擎](2026-09-21-write-session-engine.md)。
