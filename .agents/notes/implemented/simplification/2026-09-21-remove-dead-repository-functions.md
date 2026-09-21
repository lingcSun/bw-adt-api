# Agent Note: 移除 repository bw/objects 死函数（V2）

Status: implemented

## Problem

读验证轮证实 `/sap/bc/adt/bw/objects/*` 服务树在本系统整体 404（含父路径，属服务未注册而非路径错误），`infoObjects`/`infoObjectDetails`/`infoObjectCatalogs` 三个函数在唯一可测系统上不可用。V1 批次时因"失败形态可能是发行版差异"单独留下，本轮用户决策移除。

## Decision

repository.ts 整体重写为只含已验证的 `getInfoproviderStructure`/`parseInfoproviderStructure`：三个死函数及其专属类型（`InfoArea`/`InfoAreaAttributes`/`InfoAreaLink`/`InfoObjectType`/`InfoObjectMetaData`/`InfoObject`/`InfoObjectCatalog`/`InfoObjectsOptions`）一并移除。`v2-v4-removal-encoding.test.ts` 锁定根导出不再出现这些函数。

## Alternatives considered

- **保留并标注不可用**：函数会继续出现在文档/补全面里诱导误用（V1 批次已论证过删除优于标注）。
- **重写 vs 脚本删除**：V1 批次的机械删除脚本曾误伤相邻函数（被生成器断言拦住）；本文件小且存活面单一，整体重写更稳。

## Consequences

- API 面进一步收缩（BREAKING，随下一 minor 发布）；InfoObject 读能力不受影响（iobj 建模端点 + 搜索 + infoproviderstructure 均在）。
- 若将来在注册了该服务的系统上需要这组 API，以新证据重建（服务端 404 形态记录在账本 V2）。

## Testing

build/jest/verify:agents 全绿；生成器断言（api 160）；`getInfoproviderStructure` 真机三入口复测不受重写影响。

## Related

- [V1 移除笔记](2026-09-20-remove-dead-validation-methods.md)（同族决策）、[VERIFIED_APIS 第 7 节 V2](../../../../docs/VERIFIED_APIS.md)。
