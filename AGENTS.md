# bw-adt-api — Agent Instructions

SAP BW/4HANA ADT webservice 接口库（TypeScript）。传输层借用 [abap-adt-api](../abap-adt-api) 的 `AdtHTTP`/`AdtException` 结构，域模型独立实现。

## Commands

```bash
npm run build   # tsc → build/
npm run watch   # tsc -w
npm test        # jest（集成测试需 .env 提供 BW_BASE_URL 等，未配置时跳过）
```

## Layout

- `src/AdtHTTP.ts` + `AxiosHttpClient.ts` 传输层——`sap-contextid` 与 cookie jar 分开管理，是写会话模型的关键
- `src/api/*.ts` 按域的 REST 函数与写编排（`saveAndActivate*`、`resolveTransportForWrite`）
- `src/domains/*.ts` 域门面（`client.adso` / `client.dtp` / …），`src/BWAdtClient.ts` 组装公共入口
- `docs/VERIFIED_APIS.md` 真实系统验证记录（证据账本）；`docs/ROADMAP.md` 模块进度；`docs/API_MAPPING.md` 端点映射

## Invariants

- **所有写路径遵循已验证会话模型**：lock（stateful）→ transportCheck/PUT/activate（stateless，`lockHandle` 上 URL）→ unlock（stateful，放 `finally`）。见[会话模型笔记](.agents/notes/implemented/architecture/2026-09-18-write-session-model.md)。
- **传输显式解析，绝不自动取第一个 TR**：解析次序为显式 transport > 复用 lock 的 corrNr > createTransport:true > 抛 TransportRequiredError。
- **服务端行为断言必须先入证据账本**：对 SAP 行为的新断言先在 `docs/VERIFIED_APIS.md` 记录实测证据；凭据与系统信息不入库。写此类断言时用 [test-dont-assume](.agents/skills/test-dont-assume/SKILL.md) 技能。
- **新增端点落在 api 函数层**：`src/api/<域>.ts` 写函数与编排；`src/domains/` 门面只做转发，不藏逻辑（[rationale](.agents/notes/implemented/architecture/2026-09-18-api-domains-two-layer.md)）。

本文件预算 ≤ 2000 字符（按字符计，中英文同口径）。超出先搬家（挪到笔记或 README）、再压缩；确需更多才改这个数字，并在提交说明里给理由。

## Agent Notes

非平凡变更必须在同一提交新增或更新至少一篇 Agent Note（[规则](.agents/notes/README.md#何时必须写)）；每篇新笔记触发 supersession 检查。决策语料在 [.agents/notes/](.agents/notes/AGENTS.md)。门禁 `npm run verify:agents` 校验根文件预算、笔记格式与链接。
