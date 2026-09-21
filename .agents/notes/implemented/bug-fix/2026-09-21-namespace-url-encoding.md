# Agent Note: 命名空间对象名的 URL 路径编码（V4）

Status: implemented

## Problem

`/NS/OBJ` 形态的对象名直接插值进 URL 路径段时未编码，`/` 被当作路径分隔符切开，服务端 404（读验证轮以 `/CPM/…` ADSO 复现；系统内存量 11 个命名空间 ADSO）。受影响面：adso 族读路径（getADSO/getADSODetails/getADSOXml/getADSOTables/getADSOConfiguration）、`BWObject` 的 uriName（lock/unlock/versions/check/activate/delete 共用）、ddic 的 Link 读取、RSDS 双段 base。

## Decision

路径段统一 `encodeURIComponent`：adso.ts 五处、ddic.ts 一处、`BWObject.uriName`（PC preserveCase 分支同样编码）、`rsdsBase`（RSDS ds/sys 两段）。**qs 值保持原始串**——V5 已确立"编码归传输层（axios 单次编码）、qs 永远传原始值"的契约，本修复只动路径段。`getADSONodePath` 的 objectUri（qs 值）刻意不动。

回归锁 `v2-v4-removal-encoding.test.ts`：命名空间名的线上 URL 必须含 `%2F` 且不出现裸 `//`；常规名（`ZADSO_02`）编码后线上形态必须逐字不变。

## Alternatives considered

- **在 AdtHTTP 层统一编码整条 URL**：会波及全部 54 个端点（含已按正确形态验证的），无法逐一回归，风险不成比例。
- **只在 adso.ts 修，不动 BWObject**：versions/check/lock/delete 走 BWObject.buildUri，会留下半条坏路径。
- **RSDS 不修（无命名空间样本）**：编码对常规名是恒等变换（字母数字下划线不受影响），修是零风险预防，不修则留下下一个 404 惊喜。

## Consequences

- 常规对象名的线上请求与修复前逐字相同（测试锁定）；命名空间对象从 404 变为可用。
- `saveAndActivateADSO` 传给 transportchecks 的 URI 保持逻辑形态（未编码）——body 内 URI 是服务端语义值，与请求路径编码是两回事。

## Testing

build/jest/verify:agents 全绿；真机：命名空间 ADSO 的 details/tables/versions（BWObject 路径）/ddicLinks 四路径全通，常规名对照不受影响。

## Related

- 编码契约的另半边：[nodepath 双重编码笔记](../bug-fix/2026-09-20-nodepath-double-encoding.md)（V5）、[VERIFIED_APIS 第 7 节 V4](../../../../docs/VERIFIED_APIS.md)。
