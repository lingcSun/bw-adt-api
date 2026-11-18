# Agent Note: InfoObject 创建真机对照——骨架模型修正 + CHA 创建闭环

Status: implemented

## Problem

2026-11-10 入库的 KYF 创建（`createInfoObjectFull`）真机端到端复测失败：
stateless 创建 POST 404；改 stateful 后创建「成功」但落库对象是骨架 CHA
（CHAR/5/ALPHA、描述=技术名、InfoArea=NODESNOTCONNECTED），KYF 属性全部丢失。

## Decision

- **真机 A~I 变体对照**（`ZK_PROB1~8`，$TMP）确立骨架模型：创建 POST 与 lock 必须
  同一 stateful 会话（否则 404）；POST body 除 name 外整体被忽略；类型（CHA↔KYF）
  与 dataType（CHAR→NUMC）创建后经 PUT /m 不可改（拒绝/静默回退）；长度/描述/
  InfoArea/texts 可 PUT 落库。详见 VERIFIED_APIS §10——§9 的「stateless」记录源自
  JCo 会话标签误读（该系统 Eclipse 走 JCo dispatch，contextid 随每次 JCo 调用显式
  传递）；「误读 PUT 文档」怀疑经复核不成立（抓包 14:38:30 infoproviderstructure 已列
  新对象于 iobj_kyf，早于 PUT 2.5 分钟）——根因是 JCo 入口的创建参数映射未在
  HTTP ICF 路径复刻（2026-11-16 修正）。
- **CHA 创建入库**：`createInfoObjectChaFull`（门面 `createCha()`）= POST 骨架 →
  PUT /m 补写属性（timestamp 头，`patchInfoObjectDoc` 定向字符串手术）→ 回读校验
  （persisted/diffs）→ 激活。真机 ZK_PROB8 闭环：persisted=true、激活成功。
- **KYF 诚实标注为不可达**：`createInfoObjectFull` 保留、docstring 声明限制，
  回读校验必然 persisted:false；待向导抓包（向导在创建时指定类型的机制未复刻）后重开。
  不写无证据的实现（纪律同 qprops 放弃案例）。

## Alternatives considered

- **PUT /m 整树重写/干净 Keyfigure 文档**：被服务端拒绝（"could not be successfully
  saved"）——PUT 需要完整文档且类型变更本身是拒绝点，三变体（保留骨架块/去
  conversionRoutine/剥离 CHA 专属块）均失败，故属性修改走定向字符串手术。
- **创建 POST 带类型 URL 参数/头（subtype 等）**：无发现证据支撑，不盲试扩散；
  discovery（compatibility graph/atomsvc）无 iobj 专属创建服务登记。
- **用 v2_4_0 内容类型**：415，v2_1_0 是该服务唯一可用版本。

## Consequences

- InfoObject 域动词：get/validateExists/validateNewName/create/createCha。
- ADSO 创建 POST stateless 可用是处理器宽容而非通用语义——其它 BW 建模域新写路径
  默认按「lock 同会话 stateful」设计。
- 探针对象 ZK_PROB1~8 留存 $TMP（InfoObject 无删除能力），需 BWMT 手工清理。

## Testing

- 真机：ZK_PROB8 `createCha` 端到端（persisted=true、activated=true、
  CHA/CHAR/12、描述/InfoArea 回读一致）。
- `npm run build` 通过；单元测试未新增（真机探针即验收，`.local/probe/` 不入库）。

## Related

- [VERIFIED_APIS §10](../../../../docs/VERIFIED_APIS.md)；前置：[2026-11-10-iobj-create](2026-11-10-iobj-create.md)。
