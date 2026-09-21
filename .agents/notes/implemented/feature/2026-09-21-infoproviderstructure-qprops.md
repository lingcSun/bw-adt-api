# Agent Note: getInfoproviderStructure 入库与 qprops 的 Accept 阻塞

Status: implemented

## Problem

Eclipse 通信日志（用户 08:51 抓包）暴露了库外的 BW 建模端点。批 2 决策：`infoproviderstructure`（区域级查询树）与 `rules/qprops`（查询侧字段属性）入库，`queryint user_props`（Eclipse UI 个人化状态）放弃。qprops 的实现被服务端的 content-type 协商卡住。

## Decision

- **getInfoproviderStructure 已入库**（`src/api/repository.ts`，门面 `repository.infoproviderStructure` + client 包装）：`GET /sap/bw/modeling/repo/infoproviderstructure/area/{area}/{type}`，type 为 iobj_cha/iobj_kyf/iobj/adso（实测全 200，空组合返回空 feed）。解析 atom:feed → `bwModel:object` 属性（objectName/objectType/objectSubtype/objectStatus）+ atom:id/title。area 段走 URL 路径编码（V5 教训写进注释：qs 传原始值）。
- **qprops 放弃（2026-09-21 用户决策，批次内收尾）**：端点存在（错误信息证明 objectType/infoprovider/version 参数被解析），但 vendor Accept 无法从服务端获取——415 报错对**两侧**内容类型的中间段一律字面缩写为 `…`，17 个候选命名空间（modeling/rules/query/bics/dashed 变体等）全部不中，ADT discovery（atomsvc）未登记该服务。实现需要 Eclipse 请求头佐证；其价值（BICS preview 免 initialView 选特征）不足以支撑，放弃。重开条件：抓包暴露完整类型或系统升级。

## Alternatives considered

- **qprops 用通配或猜测 Accept 硬上**：服务端明确拒绝非精确匹配，猜测上线就是把"未验证"写进代码——违反本仓库纪律。
- **infoproviderstructure 复用 BWSearchResult 解析**：结构同族但字段不同（多 objectSubtype、无 technicalObjectName/objectVersion），强行复用会把两种响应形态耦合成一个撒谎的类型。
- **把 qprops 也先建桩（返回原始 XML）**：没有 Accept 连请求都发不出去，桩无法验证，只是装饰。

## Consequences

- RepositoryDomain 语义从"搜索/血缘"扩为"搜索/血缘/结构"；repository.ts 里 bw/objects 三函数（V2，本系统 404）与新函数并存——移除决策仍独立挂着。
- qprops 不实现；BICS preview 的正确用法保持 initialView-first（账本 V3）。

## Testing

`npm run build` 通过；`repository-infoproviderstructure.test.ts`（真机结构 fixture + 空 feed）绿；真机三入口（门面/api/client）× 三 type 实测，cha 20 条、kyf/adso 空数组不报错；生成器断言全过（api 163 / 门面 63 / client 123）。

## Related

- 发现来源：[nodepath 修复笔记](../bug-fix/2026-09-20-nodepath-double-encoding.md)（同一份 Eclipse 日志）、[VERIFIED_APIS 第 7 节 V6](../../../../docs/VERIFIED_APIS.md)。
