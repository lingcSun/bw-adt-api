# Agent Note: 已验证的写操作会话模型

Status: implemented

## Problem

早期依据 Eclipse 抓包表象误用 `X-sap-adt-sessiontype: stateful;enqueue` 请求头，并据此误判"纯 HTTP 无法更新 DTP（JCo 限制）"。写路径的正确会话语义是整个库能做写操作的前提，必须在真实系统上核实并固化为规范。

## Decision

以下模型在真实 BW/4HANA 系统上实测核实；证据账本是 [docs/VERIFIED_APIS.md](../../../../docs/VERIFIED_APIS.md)（写会话章节为唯一权威）：

1. **AdtHTTP 把 `sap-contextid` 与普通 cookie jar 分开管理**：stateless 请求绝不携带 contextid（唯一例外 `dropSession`——携带 contextid 的 stateless 请求显式销毁会话）。单一 cookie jar 混用会静默杀掉持锁会话，后续 PUT 报 423（lock handle could not be created）。
2. **lock/unlock 必须 stateful**（不是 `stateful;enqueue`）：enqueue 头使服务端返回 `sap-contextid=0` 并销毁会话，锁立即丢失。Eclipse 日志里的 "stateful, enqueue" 是服务端展示标签，不是客户端 header 值。
3. **PUT / transportchecks / activation / 多数 CTS 走 stateless**（不带 contextid）；服务端用 enqueue 表校验 URL 上的 `lockHandle`。
4. **标准写序列**（ADSO/DTP/TRFN/RSDS 同构）：lock（stateful）→ transportCheck（stateless）→ 需要时 createTransport（stateless）→ PUT 带 `lockHandle`（必要时 `corrNr`）（stateless）→ activate（stateless）→ unlock（stateful）；unlock 放 `finally`。
5. **传输解析显式化**（`resolveTransportForWrite`）：显式 `transport` > 复用 lock 响应带的 `corrNr` > `createTransport: true` 新建 > 否则抛 `TransportRequiredError`（附可用 TR 列表）——**绝不自动取 `TRANSPORTS[0]`**。
6. 版本后缀 `m`/`a`/`d` = active/modified/revised；RSDS 特例：版本字符在 `<atom:id>` 而非 URI 后缀。TRFN 例程类走 ABAP 侧端点（激活走 `/sap/bc/adt/activation` 而非 BW 的 modeling activation），是模型内已核实的特例。

## Alternatives considered

- **全部请求 stateful**：contextid 一旦泄进 stateless 请求即 423；分开管理正是为杜绝此事。
- **enqueue 会话**：实测锁立即丢失（服务端回 `sap-contextid=0`）。
- **自动选择第一个可用 TR**：写操作落到错误的传输请求上是灾难性副作用；显式失败好过隐式错误。

## Consequences

- 每个新写域沿用同一骨架；`saveAndActivate*` 封装序列，域门面直接暴露。
- 对服务端行为的任何新断言，必须先在 VERIFIED_APIS 记录实测证据（见 [VERIFIED_APIS 证据账本与凭据纪律](../process/2026-09-18-verified-apis-evidence-ledger.md)）；Eclipse 观察只算待验证假设。
- 曾被"JCo 限制"结论挡住的 DTP 写路径因此打通——错误结论被记录的证据推翻，正是账本存在的意义。

## Related

- 编排代码的落位（api 层）见 [api 函数层与 domains 门面层的两层结构](2026-09-18-api-domains-two-layer.md)。
