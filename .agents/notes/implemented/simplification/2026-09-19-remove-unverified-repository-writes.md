# Agent Note: 移除 repository.ts 未验证的写函数

Status: implemented

## Problem

`src/api/repository.ts` 的 `infoAreas` / `createInfoArea` / `createInfoObject` / `deleteInfoObject` / `activateInfoObject` 走 `/sap/bc/adt/bw/objects/*` 端点——这些端点均不在 VERIFIED_APIS 证据账本中，也从未暴露在 `BWAdtClient` 上（包入口不导出 api barrel）。未经验证的写函数一旦被深度导入使用，是对生产对象的盲写。同文件还残留一批从未被调用的私有 parser。

## Decision

- 删除 `infoAreas` / `createInfoArea` / `createInfoObject` / `deleteInfoObject` / `activateInfoObject`（含 `CreateInfoObjectOptions`）。
- 保留只读的 `infoObjects` / `infoObjectDetails` / `infoObjectCatalogs` 与相关类型导出（低风险，留待验证或后续删除）。
- 顺带删除各域模块的私有死 parser：`parseADSOLockResponse`、`parseDTPLockResponse`、`parseDTPVersions`、`parseTransformationVersions`、`parseDDICTableData` / `parseDDICTableDataRow`。
- 同批硬编码清理：`requestLogger.convertRequest` 改读 `url` / `qs` / `body`（对齐 AdtHTTP 实际字段与上游实现，此前调试日志的 uri/params/body 恒为空）；`createADSO` 的插值字段统一 `escapeXmlAttr`、删除 AdtHTTP 之后的死 `status !== 200` 检查；`createObject("trfn")` 的拒绝信息改为指引 `createTransformation()`。
- 模块头注释写明该端点族的未验证状态与 InfoObject 的已验证替代路径（`api/infoobject.ts`）。

## Alternatives considered

- **整文件删除**：只读查询函数仍可能有用且导出自 `api/index`，深度导入方会破坏；先做保守删除。
- **补验证后保留**：这些端点不在任何路线图需求里，为死代码付真机验证成本不值得。

## Consequences

- 深度导入 `bw-adt-api/build/api/repository` 的消费方受影响（包入口从未导出这些函数，正常使用面无感知）。
- `InfoArea` / `InfoAreaLink` 类型仍导出（`infoAreas` 已删但类型无害）。
