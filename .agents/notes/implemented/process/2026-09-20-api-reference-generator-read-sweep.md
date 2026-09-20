# Agent Note: API 参考文档代码化生成 + 读 API 全量验证

Status: implemented

## Problem

API_MAPPING.md 手工维护，自 2026-07 起持续漂移（缺 9 月新增的创建/规则/键辅助等全部 API，PC 节结构破损），无法回答"库到底有哪些 API、哪些验证过"。同时 2026-09-19 的复测以写路径为主，读 API 缺一次样本多样的系统性真机验证；验证结果散落在账本正文，没有逐 API 的矩阵。

## Decision

- **文档生成制**：新增 `scripts/gen-api-reference.mjs`（`npm run gen:api`），扫描 `src/api`/`src/domains`/`BWAdtClient` 提取全部导出函数与方法，与生成器内的手工分类表做**双向集合断言**（代码有表没有、表有代码没有、重复，任一出现即失败退出），渲染出 `docs/API_REFERENCE.md`。分类三值：读（非变更）/ 写（变更或会话）/ 本地（纯函数）。`--results` 参数可把读验证结果 JSON 写进状态列。API_MAPPING.md 删除，VERIFIED_APIS/AGENTS/README 的引用同步改指新文档。**不再手工维护 API 清单**——API 变更后重跑生成器，不一致会在断言层爆掉。
- **读 API 全量验证**：86 个读类 API 逐一真机验证，一次登录批量执行。样本多样性原则：同一族 API 至少两种来源（0\* 标准 vs Z\* 客户）、RSDS 用 ds×源系统组合发现配对、TRFN/DTP 用系统生成 id、InfoObject 覆盖特征与定制、流程链两条、专项探针覆盖命名空间对象与不存在对象（负例）。预期失败（PC 的 V/L/S 后缀）按"命中文档化错误形态 = ⚠️ 确认"判定，不混入 ❌。
- **本轮只验证读**；写类与本地类在文档中标注类别但不做真机扩测（写路径已有 09-19/09-20 两轮覆盖）。

## Alternatives considered

- **继续手工维护 API_MAPPING.md**：已漂移一个月，且每次改 API 都依赖人肉同步——生成器把"文档与代码一致"从纪律问题变成断言问题。
- **验证状态也放 API_REFERENCE 之外**：试过分离，但读 API 的"能不能用"就是 API 事实的一部分；状态列由 `--results` 机制生成，仍是代码/证据驱动而非手写。
- **validation 家族 ❌ 项本轮顺手删掉**：删除是 API 面变更，应有独立评审（这些函数在支持 delete/activate action 的系统上可能合法）；本轮如实记 ❌，修复（fail-fast 或移除）留待决策。

## Consequences

- `docs/API_REFERENCE.md` 是生成产物：**不要手改**，改分类表或代码后重跑 `npm run gen:api`。生成器内的分类表是唯一手工维护点。
- 验证结论（2026-09-20）：63 ✅ / 5 ⚠️ / 18 ❌。❌ 分三类：validation action 家族性被拒（13 个函数本系统不可用，V1）、repository 模块端点本系统 404（V2）、库缺陷（命名空间名未编码 V4、nodepath 契约脱节 V5）。修复决策待定。
- 集成测试的 9 个真机套件仍因 `.env` 测试对象占位符不可跑；读验证矩阵（`.local/probe/verify-results.json`）是本轮的真机证据载体。

## Testing

生成器断言全过（174 api + 62 门面 + 125 client 全覆盖）；`npm run build`、`npm run verify:agents`、离线 jest 全绿。读验证探针一次登录 27s 跑完 86 项，证据 JSON 在 `.local/probe/`（不入库）。

## Related

- 验证发现详情：[VERIFIED_APIS 第 7 节](../../../../docs/VERIFIED_APIS.md)。
- 前置批次：[P0](../bug-fix/2026-09-20-p0-review-batch.md)、[P1](../bug-fix/2026-09-20-p1-pc-rspc-trfn-delete-iobj-field.md)、[P2](../bug-fix/2026-09-20-p2-key-session-local-table.md)。
