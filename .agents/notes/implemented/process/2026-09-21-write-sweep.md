# Agent Note: 写 API 验证轮（ZGLD_TEST / $TMP）与 W1–W4 发现

Status: implemented

## Problem

读 API 两轮验证清零后，写路径只有 09-19/09-20 修复批次留下的点状证据（TRFN 创建/删除、ADSO 键流程等），没有一次系统性的写面验证。约束：写只能在 ZGLD_TEST 下、且全部为 $TMP 本地对象——RSDS 写、复制、PC 写、createTransport、业务例程类天然出不了靶子。

## Decision

方法与读轮不同——写验证按**使用故事**组织而非逐函数孤立调用：ADSO 全生命周期（blank→addKey→addField→激活→改描述→check→删除）、BWObject 通用路径（createObject 不带 parent/getObject/updateObject/deleteObject 参数校验+实删）、TRFN 全链（8TRANSIENT→CONSTANT/DIRECT 规则→自动映射→切运行时→lockHandle 删除）、DTP 全链（创建→锁→packageSize 编辑→激活→删除探针）。每个对象 finally 清理，收尾按名称前缀搜索确认零残留（中途两轮失败留下的孤儿 TRFN/ADSO 已补删）。范围外 19 项逐一登记原因而非留空。

结果：写 43 项 = 22 ✅ / 20 ⚠️（19 项范围外 + 1 项离线覆盖）/ 1 ❌。生成器升级为全行状态列（读/写共用 ✅/⚠️/❌ 语义）。

**发现（详证见账本第 8 节）**：W1 DTP 本地删除（库 transport 模式 vs 服务端 lock 模式，与 TRFN 同款）；W2 createDTP 暗坑（TRFN 须 active、description 静默丢弃）；W3 executeDTP 的 URI 本系统不支持（从未有过验证记录）；W4 createObject 通用路径 parent 校验用对象自身类型。

## Alternatives considered

- **逐函数矩阵式写验证**：写操作有状态与依赖（DTP 要 TRFN，TRFN 要两个 ADSO），孤立调用要么造不出前置要么重复建设对象；故事式天然复用前置且更接近真实用法。
- **范围外项留空**：留空即"未知"，登记原因才是结论（同读轮 ⚠️ 语义）。
- **W1 当场修掉**：与验证轮边界分开（修复批次由用户决策），本轮只钉证据。

## Consequences

- API_REFERENCE 状态列对读/写统一生效；写 ⚠️ 里"范围外"与"行为注记"两类语义并存（状态串内注明）。
- 探针两轮场景 bug（TRFN 删除顺序、TRFN 未激活）本身产出了 W2 的证据——失败路径也是证据源。
- W1–W4 待修复决策；W3 在拿到 Eclipse 抓包前保持 ❌。

## Testing

探针一次登录全链跑完，收尾零残留（孤儿对象已清理并复核）。生成器断言全过；build / verify:agents / 离线测试全绿。

## Related

- [VERIFIED_APIS 第 8 节](../../../../docs/VERIFIED_APIS.md)（W1–W4 详证）、[读 API 验证轮笔记](../process/2026-09-20-api-reference-generator-read-sweep.md)。
