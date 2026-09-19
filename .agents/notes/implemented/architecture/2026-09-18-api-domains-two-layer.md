# Agent Note: api 函数层与 domains 门面层的两层结构

Status: implemented

## Problem

BW/4HANA ADT 的 REST 端点按域分布（`/sap/bw/modeling/adso`、`dtpa`、`trfn`……），写路径又需要跨端点编排（lock → transport → PUT → activate → unlock）。全部塞进一个大客户端类（abap-adt-api 的 `AdtClient` 模式：约 120 个委托方法）既难导航，编排逻辑也没有安放处；反过来只有对象门面的话，编排会与门面的实例状态纠缠。

## Decision

（4e8c940 "expose domain facades and move write orchestration into api layer"）

两层各司其职：

- **`src/api/*.ts` —— 函数与编排层**：每域一个模块，传输级操作函数；写编排（`saveAndActivate*` 系列、`resolveTransportForWrite`）也住在这层——编排是无状态过程，不属于任何对象实例。`bwObject.ts` 提供泛型 BW 对象基类，`types.ts` 收敛统一类型。
- **`src/domains/*.ts` —— 门面层**：`AdsoDomain`、`TrfnDomain`、`DtpDomain` 等薄门面，挂载为 `BWAdtClient` 的实例属性（`client.adso.saveAndActivate(…)`），只做转发与粘合，不藏逻辑。
- **`src/BWAdtClient.ts`**：组装传输（`AdtHTTP` + `AxiosHttpClient` + `createSSLConfig`）与全部域门面，是库的公共入口。

新增端点的标准路径：`src/api/<域>.ts` 写函数与类型 → 需要门面人体工学时在 `src/domains/<域>.ts` 转发 → 从 `src/index.ts` 导出。

## Alternatives considered

- **单一大客户端（AdtClient 模式）**：120+ 方法平铺，编排只能内联在方法里、无法复用；在 abap-adt-api 上沿用该模式是 fork 维护约束，不是偏好。
- **只有门面层（每域一个类包办 REST 与编排）**：编排进了带实例状态的类，测试与复用都变差。
- **active-record 式对象（取出可变对象、自动持久化）**：持久化时机不可控，与整对象原子写回的模型冲突。

## Consequences

- 编排写一次，门面与直调两条入口共用（推荐入口：api 层 `saveAndActivate*` 或域门面）。
- 门面保持薄：加门面方法的标准是"消费端人体工学"，不是"凑齐 API 面"。
- 传输层（AdtHTTP/AdtException）借自 abap-adt-api 的结构，但 `AxiosHttpClient` 使 HTTP 客户端可注入——域代码不感知 axios。

## Related

- 写编排遵循的会话语义见 [已验证的写操作会话模型](2026-09-18-write-session-model.md)。
