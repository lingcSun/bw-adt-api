# Agent Note: 2026-09 复测 P1 修复批次（PC rspc 化、TRFN 删除、IOBJ 引用字段）

Status: implemented

## Problem

2026-09-19 复测的 P0 之外遗留三组缺陷：F1 的 PC 模块整体打在错误端点 `/pc` 上（且解析层按 XML 写，而真机服务的是 JSON）；TRFN 的 `delete` 强制要求 transport——本地 $TMP 对象没有 TR，transportchecks 路径走不通，本地 TRFN 无删除入口；F11 缺 IOBJ 引用字段的 XML 构建辅助（只能手工拼元素）。

## Decision

- **PC rspc 化（F1，读路径已实测）**：`BWObject` 的 PC endpoint 改 `/sap/bw/modeling/rspc`、contentType 改 `application/vnd.sap.bw4.modeling.processvariant.chain-v1_0_0+json`、新增配置位 `preserveCase`（PC 名大小写敏感，URI 不再转小写；其余对象维持小写历史行为）。`processchain.ts` 读路径按实测 JSON 重写：`{ bActive, sVariantDescription, oDetail, aSocket[], aExecutionOption[] }` → 现有 `ProcessChainMetaData`/`ProcessChainDetails` 契约（bActive 映射 objVers/status；payload 无步骤/时间戳字段，steps 恒为 undefined，不虚构）。`/versions`、`/logs`、`/status`、`execute`、`stop` 仅修正前缀与 Accept 并如实标注未验证——服务端错误原样上抛，不吞不编。导出 `PC_JSON_CONTENT_TYPE`。
- **TRFN 删除走 lockHandle 路径**：`BWObject.delete` 把 TRANSFORMATION 归入 lockHandle 模式（lock → `DELETE /m?lockHandle[&corrNr]` → unlock；transportchecks 路径要求 TR，本地对象没有）。可选 `transport` 降为 corrNr。
- **F11 IOBJ 引用字段**：`ADSOFieldDefinition.infoObjectName` + `buildADSOInfoObjectElementXml`（`name` + `infoObjectName` 最小形态，无 inlineType，dimension 沿用继承规则）；`buildADSOFieldElementXml` 按有无 `infoObjectName` 分派。`addADSOField` 门面无需改动即获得引用字段能力。

## Alternatives considered

- **PC 写路径一并实现**：lock/unlock/activate/execute/stop 在本系统全部未实测（不允许动业务链），按 XML 时代假设改写解析层只会把假设写得更隐蔽；保留修正前缀 + 原样上抛是唯一不撒谎的形态，等有可写靶子再补证据。
- **`/status` 伪实现**（从 details 的 bActive 派生运行状态）：bActive 是建模活动版本标记，不是运行状态；派生结果是谎言。
- **TRFN 删除保留 transport 兼容分支**：transportchecks 路径对本地对象必然失败，留着只会让调用方选错；`transport` 参数保留但语义改为 corrNr。

## Consequences

- `parseProcessChainDetails` 签名变为 `(jsonBody, chainId?)`（payload 不含链名，由调用方回填）；chainId 缺省时 name 为空串，旧单参调用不崩。
- `ProcessChainDetails.steps` 恒为 undefined（实测 payload 无步骤数据）——依赖该字段的下游需改走 RSPC 应用日志。
- PC 名从此大小写敏感进出 URI；此前"小写也能查到"的场景（若有）属于大小写不敏感系统的宽限，不再保证。
- P2 遗留：F3 键定义完整形态（IOBJ 模板 ADSO 因模板自带标准单位字段的主数据检查配置仍无法整对象激活，但引用字段写入/水合路径已独立验证）。

## Testing

`npm run build` 通过；离线套件 32/32 绿（新增 `processchain-json`——fixture 取自真机 payload 结构、`adso-iobj-field-xml`——引用元素构建与 TRFN 删除参数校验）。真机端到端（build 产物）：搜索 → `getProcessChainDetails` 全链通过；TRFN 创建 → `delete({lockHandle})` → 回读确认不存在；`addADSOField({infoObjectName})` PUT 接受且服务器水合出 inlineType。实验对象全部即建即删。

## Related

- 证据账本：[VERIFIED_APIS](../../../../docs/VERIFIED_APIS.md) 第 6 节（F1/F11 关闭、TRFN 删除入库）。
- 前一批次：[P0 修复批次](2026-09-20-p0-review-batch.md)（N1 JSON 保真是本次 PC rspc 化的前置）。
