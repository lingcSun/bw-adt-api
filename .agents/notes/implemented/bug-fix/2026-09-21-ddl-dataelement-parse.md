# Agent Note: 标准表 DDL 数据元素形态解析（V7）

Status: implemented

## Problem

读 API 复验（2026-09-21）发现 `parseDDICTableSource` 只认原始类型 DDL（`abap.char(40)`，/BIC/ 生成表形态）；标准表用**数据元素类型**（`key mandt : mandt not null;`，无 `abap.` 前缀、无长度括号）时正则不命中，`getDDICTableInfo/getDDICTableFields` 对 T000 等标准表**静默返回 0 字段**（实测 T000=0 vs /BIC/=5）——静默空让调用方无从察觉。

## Decision

字段正则双形态：原始类型 `abap.type(len[,dec])` 或裸数据元素名（dataType 记元素名，长度由元素定义、留空）；声明锚定**行首**（m 标志）——排除 `@AbapCatalog.foreignKey.screenCheck : true` 类注解冒号被误读为字段（此泄漏由离线 fixture 测试先于真机抓到）；结尾断言（not null/;/换行）继续排除外键 where 子句。护栏：DDL 含 `define table` 却解析 0 字段时显式报错（拒绝静默空，未识别的新 DDL 形态会响而不是装空）。

## Alternatives considered

- **数据元素形态解析成 abap 原始类型（查元素长度）**：元素→域→长度的映射不在该端点响应里，需另发请求拼装，超出本修复面；dataType 记元素名已是可用且诚实的信息。
- **只加护栏不改正则**：T000 依旧不可用，护栏只是把静默空变成报错——半修。
- **解析失败静默回退到原始 XML**：又是另一种静默。

## Consequences

- 标准表字段可用（T000 实测 17 字段，MANDT key✓）；dataType 语义分两族：`abap.*`（原始类型，带 length）与数据元素名（无 length）。
- 未识别 DDL 形态从"空列表"变为异常——依赖旧行为（拿空数组当"无字段"）的调用方会在将来遇到显式错误，这是有意的。
- 数据元素型字段的 keyFlag 依赖行首 `key` 前缀；DDL 其他布局（如注释包裹）未实测，护栏兜底。

## Testing

`ddic-ddl-parse.test.ts` 5/5：T000 真机 DDL fixture（含外键子句与注解行）、/BIC/ 形态不回归、护栏触发、空 DDL 不误伤。真机：T000=17 字段（首字段 `{name:MANDT, keyFlag:true, dataType:mandt}`）、/BIC/ 5 字段。读类终态 68 ✅ / 3 ⚠️ / **0 ❌**。

## Related

- 发现：[读 API 复验（2026-09-21）](../../../../docs/VERIFIED_APIS.md) 第 7 节 V7。
