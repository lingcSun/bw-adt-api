# Agent Note: 2026-09 复测 P0 修复批次与账本更正

Status: implemented

## Problem

2026-09-19 全量复测（61 门面 + 客户端方法）产出 F1–F11 一批发现，其中 F3 的表述（「createADSO 无 template 时 XML 被写入字面量 undefined 节点」）与后续可复现性存疑：复测驱动脚本在未入库的 `.local/`，已丢失。同时 2026-09-20 复核发现两个账本之外的缺陷（JSON 响应保真、搜索枚举错值），且 F4 的修复方向需要真机证据钉死 validation objectType 的合法 token 集。

## Decision

P0 批次只修"小而确定、证据闭环"的五项，全部以真机探针背书（只读探针 + 6 次按账本纪律的 $TMP 受控写实验，对象即建即删）：

- **N1 JSON 保真**：`AxiosHttpClient` 提出纯函数 `responseBody(data)`——字符串透传、其余 `JSON.stringify`。此前 `${data}` 把 axios 自动解析的 JSON 对象串成 `"[object Object]"`（`/rspc` 的 processvariant.chain JSON 是首个受害者）。
- **N2 搜索枚举**：`SearchObjectType.PROCESS_CHAIN` 值 `"PROCS_CHAIN"` → `"RSPC"`（旧值使 bwsearch 500；`RSPC` 真机命中全部链）。
- **F4 模板预检**：新增 `templateValidationObjectType(tlogo)` 映射，`createADSOFull` 据此校验。实测 validation 合法 objectType 仅 **ADSO / IOBJ / RSDS**（`DSO`、`ISRC` 报 "Object type … is not valid"）；故 DSO→RSDS，ISRC 无 token 跳过预检交服务端裁决。
- **F5 导出面**：根 `src/index.ts` 整体再导出 `./api`（删除对 `./api/transport` 的重复显式块）；`api/index.ts` 补 `createTransformation`/`createDTP` 与选项类型。
- **F6 门面**：`TrfnDomain.create()` 转发 api 层 `createTransformation`。

账本更正与增补（`docs/VERIFIED_APIS.md` 第 6 节）：F1 补 `/rspc` JSON 内容类型证据；**F3 改记**——字面量 undefined 用已提交代码不可复现，可复现缺陷为「Key definition missing」（空白 ADSO + 本地字段激活失败；`__KEY` 维度无效；仅注入 `<keyElement>` 被接受）；F4/F5/F6 关闭；N1/N2 入册。

## Alternatives considered

- **连 F1（PC rspc 化）一起修**：真机证据显示 `/rspc` 服务 JSON 而库的 PC 模块整体按 XML 写，修复含解析层重写与文档联动，体量与风险超出"小而确定"批次边界，排 P1（见账本 F1 补充）。
- **F4 对 DSO/ISRC 也发预检**：两个 tlogo 无合法 validation token，发出去就是服务端 500/报错；跳过预检让创建 POST 本身裁决是唯一不撒谎的做法。
- **N1 在 AdtHTTP 层修**：body 归一化属于 axios 适配层的职责（AdtHTTP 不感知传输实现），且提纯函数后可离线单测。

## Consequences

- 根入口导出面扩大（`export * from "./api"`），下游从 `bw-adt-api` 直接 import api 层函数成为受支持用法；重名由 `api/index.ts` 的显式清单消解，`export-surface.test.ts` 锁住关键符号。
- 真机 jest 套件（9 个）在本机因 `.env` 测试对象为占位符而失败——与本次改动无关（stash 基线对照证实）；填写 `.env` 的 `BW_TEST_*` 后才可跑全量。
- F3 的键定义问题仍开放：需要按 Eclipse 抓包补齐 keyElement 完整形态后实现 `addKey` 辅助与无键 fail-fast（P2），届时以新证据改写账本对应条目。

## Testing

`npm run build` 通过；离线新增/相关套件 27/27 绿（`axios-response-body` / `export-surface` / `adso-template-validation` / `adso-field-xml` / `trfn-rule-xml`）。build 产物真机抽检：`SearchObjectType.PROCESS_CHAIN`（RSPC）经 build 调用真机搜索返回 36 条（修复前 500）。

## Related

- 发现来源与完整清单：[VERIFIED_APIS 证据账本](../../../../docs/VERIFIED_APIS.md) 第 6 节。
- 会话模型与写纪律：[已验证的写操作会话模型](../architecture/2026-09-18-write-session-model.md)。
