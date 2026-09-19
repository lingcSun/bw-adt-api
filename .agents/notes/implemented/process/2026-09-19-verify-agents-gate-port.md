# Agent Note: verify-agents 机械门禁移植

Status: implemented

## Problem

根 AGENTS.md 字符预算、笔记格式、全树链接可达、归档冻结四类机械不变量此前只靠人工把关。兄弟仓库（mcp-abap-adt、abap-adt-api）已各有 `scripts/verify-agents.mjs` 门禁，本仓库缺位，语料回归无机械反馈。

## Alternatives considered

- **为本仓库重新设计门禁**：四仓库语料体系同源，独立设计只会漂移；逐字同步兄弟仓库实现，后续门禁修复自动受益。

## Decision

移植 mcp-abap-adt 同源的 `scripts/verify-agents.mjs`（`npm run verify:agents`）：单脚本校验根文件硬预算、笔记格式、链接可达三类机械不变量，归档由 `.archive-manifest.json`（SHA-256、append-only、`--write` 仅新增）机械封存。根 AGENTS.md 引入与兄弟仓库一致的硬预算条款；同步修订笔记 README 与归档 SKILL 的对应描述，逃逸仓库根的相对链接一律改为绝对 GitHub URL（隔离 checkout 必死链）。

CI（`.github/workflows/ci.yml`，ubuntu/windows × node 22/24 矩阵）执行 `npm ci → build → verify:agents`。`npm test` 暂不进 CI：集成套件需真实 BW 系统（.env），文档声称的"未配置自动跳过"尚未实现，离线实测 118/199 失败；待补跳过守卫后再纳入。

## Consequences

- agent 语料回归与代码回归同门进出：CI 矩阵每个组合执行门禁。
- 根文件预算成为硬约束：扩充走"搬家 → 压缩 → 改预算并在提交说明给理由"的次序。
- 归档新增一步 `npm run verify:agents -- --write`；回改已封存文件即门禁失败。
- 四仓库门禁同源：后续门禁修复须同步四处。
