# Agent Note: TRFN 通用规则入口 addRule 与创建会话修复

Status: implemented

## Problem

规则构建此前只有 DIRECT 一种（`addTransformationRule`/`autoMapTransformationFields`），公式、常量、初始值、不更新等真实 transformation 中的常见规则类型只能读不能写；且现有实现存在两个与服务器行为错位的隐患：

1. `createTransformation` 的创建 POST 被写成 `stateful` 会话——违背[已验证写会话模型](../architecture/2026-09-18-write-session-model.md)（写路径必须 stateless），实测稳定 500，TRFN 创建整体不可用。
2. `nextRuleId` 正则写死 `<rule id="N">`，而服务器水合生成的规则是 `<rule description="" id="N">`（属性序不同），导致对已有规则全盲、算出重复 rule id。

## Decision

- **创建 POST 改回 `session_types.stateless`**（lock/unlock 保持 stateful），与 3 月实测成功日志及写会话模型一致；修复后创建→更新→激活→删除端到端复测通过。
- **新增通用入口 `addRule(trfnXml, spec, options?)`**（`src/api/transformation.ts`），以可辨识联合 `TransformationRuleSpec` 覆盖 DIRECT/CONSTANT/INITIAL/FORMULA/NO_UPDATE 五类；`addTransformationRule` 保留为 DIRECT 兼容封装。
- **组引用前缀按实际插入组推导**（`#///group{N}/...`，不再硬编码 `group1`）；rule id 取组内最大 +1 且不低于全局最大 +1。
- **目标字段已有规则默认替换**（Eclipse"改规则类型"语义），`replace: false` 改为显式报错——BW 要求每个目标字段恰一条规则链。
- rule id 计算在删除旧规则**之前**进行（单调递增，不复用刚删的号）。
- ROUTINE/EXPERT 例程不在 spec 内：例程类创建无 REST 路径（见 [VERIFIED_APIS 证据账本](../../../../docs/VERIFIED_APIS.md)「TRFN 规则专项」）。

## Alternatives considered

- **三个独立函数 buildConstantRule/buildInitialRule/buildFormulaRule**：调用方需自行选函数、语义重复；可辨识联合 + 单入口让类型收窄自然约束 payload，扩展新类型只加一个 case。
- **在 addRule 里支持 ROUTINE（允许传类名/方法名）**：类创建仍需 Eclipse（REST 无路径），只支持"指向已存在类"会诱导把别人的例程类接到自建 TRFN 上，违背测试纪律，故显式排除。
- **id 全局唯一 vs 组内独立编号**：真机样本显示服务器按组独立编号（group1 有 11/12，group2 有 44/48）；取"组内 max+1 且不低于全局 max+1"兼顾服务器惯例与工具链对全局唯一的假设。
- **只修 nextRuleId 正则、不动 addTransformationRule 路径**：水合 TRFN 上 autoMap 同样受益于修复，且行为兼容（旧正则在纯库生成 XML 上结果不变）。

## Consequences

- 新类型扩展只改 `buildRuleXml` 的 switch 与 spec 联合；各类型 step 形态以真机 46 个 TRFN 采样为据（存本地 `.local/rule-samples/`，不入库）。
- 对水合规则全盲的正则陷阱已在账本记录（属性序必须 `\bid="(\d+)"` 容忍任意属性序）。
- 服务器行为新证据入账本：键字段上 INITIAL 被静默规范化为 StepNoUpdate（非键字段原样持久化）；水合自动生成同名 DIRECT 规则。
- 离线单测 `trfn-rule-types.test.ts` 12 例；真机回写验证（FORMULA/CONSTANT/INITIAL）通过。

## Related

- [已验证的写操作会话模型](../architecture/2026-09-18-write-session-model.md)——本次创建 POST 修复是该模型在 createTransformation 上的落地。
- [VERIFIED_APIS 证据账本与凭据纪律](../process/2026-09-18-verified-apis-evidence-ledger.md)
