# Agent Note: InfoObject 创建（KYF）入库——创建上下文头在 lock 上

Status: implemented

## Problem

库只有 InfoObject 读/校验（get/validate），没有创建能力；BWMT 向导是唯一入口。用户提供 2026-11-10 创建关键指标（KYF/CURR/AMO/SUM）的完整 Eclipse 通信抓包作为证据。

## Decision

- **入库 `createInfoObjectFull` 等六函数**（`src/api/infoobject.ts`，门面 `client.infoObject.create()`）：校验 InfoArea/新名 → lock（**创建上下文走 lock 请求头** `parent_name`/`parent_type=AREA`/`activity_context=CREA`，与 ADSO 的 POST 头不同）→ POST 创建（`Development-Class` 头 + `corrNr` query + iobj-v2_1_0 XML）→ **GET /m 回读校验**（persisted/diffs）→ 可选激活 → finally unlock。
- **非 $TMP 包无 transport 直接抛错**：与 createADSO 同款守卫（服务端会静默落 $TMP）。
- **回读校验兜底未验证假设**：向导的单位引用是创建后经编辑器 PUT 补写的，创建 POST 直带 `unitCurrencyInfoObjectRef` 能否落库无证据——回读比对 aggregationType/unit/highPrecision，缺走即 persisted:false + diffs。
- **CHA 不实现**：特征创建无报文证据，不写无证据的 xsd:type（纪律同 qprops 放弃案例）。

## Alternatives considered

- **走 withWriteSession**：引擎 update 步骤假设对象已存在且 transport 解析在创建 POST 之后才能确定——创建流 hand-roll 与 createADSOFull 同形，既有先例。
- **创建后模拟编辑器 PUT 补写单位引用**：需 GET/PUT/timestamp/Transport-Lock-Holder 全链路 + XML 合并，复杂度翻倍；先信 POST 同文档模型，回读校验暴露问题再升级。
- **支持全部 keyfigureType/objectSpecificDataType 枚举**：仅 KYF+CURR+AMO+SUM 有证据，其余按同形放行但类型上不封死，账本 §9 标注。

## Consequences

- InfoObject 域从只读扩为读写；门面 `create()` 为 InfoObject 域第一个写动词。
- 激活复用共享 `/sap/bw/modeling/activation`（BWObject.activate 同款），无新端点。
- 抓包脱敏结论入账本 §9；原始报文（含主机/工号/请求号）不入库。

## Testing

`npm run build` 通过。真机端到端验证待用户执行（创建/激活实际调用走 MCP `bw_infoobject_create`）；回读校验对「单位引用被服务端丢弃」场景给出 persisted:false 而非静默成功。

## Related

- 证据：[VERIFIED_APIS §9](../../../../docs/VERIFIED_APIS.md)；会话模型：[write-session-engine](../architecture/2026-09-21-write-session-engine.md)。
