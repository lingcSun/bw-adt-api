# 已验证 API 文档

> 本文档记录在真实 BW/4HANA 系统上实测通过的行为与会话模型。  
> **不含**具体主机、账号、会话令牌、传输号或客户对象技术名；本地验证请用 `.env` 与自有测试对象。

验证日期基准：2026-07-15（写会话模型）；后续模块以同模型复测为准。

---

## 验证状态总览

| 模块 | 状态 | 主要测试 |
|------|------|---------|
| 登录 / 会话 / contextid | ✅ | `login.test.ts` |
| 系统信息 | ✅ | `login.test.ts` |
| 搜索 / ADSO 关联 / 血缘 | ✅ | `search*.ts` / `adso-relations` / `dataflow` |
| ADSO / DTP / TRFN 读 | ✅ | 各域 `*-*.test.ts` |
| DTP / ADSO / TRFN / RSDS 写 | ✅ | `*-write.test.ts`（见下文会话模型） |
| TRFN 例程类读/写 | ✅ | `trfn-routine-*.test.ts` |
| DataSource / Replication | ✅ | `datasource*.ts` / `replication.test.ts` |
| CTS transport | ✅ | 写路径测试 + `transportCheck` / `createTransport` |
| BICS reporting preview | ✅ | `reporting.test.ts` |

---

## 1. 登录与会话管理

构造参数来自环境变量（勿写入仓库）：`BW_BASE_URL` / `BW_USERNAME` / `BW_PASSWORD` / `BW_CLIENT` / `BW_LANGUAGE`。

### stateful 与 `sap-contextid`

`AdtHTTP` 将 `sap-contextid` 与普通 cookie（如 `SAP_SESSIONID_*`）**分开管理**：

| 请求类型 | 是否携带 contextid | 服务端行为 |
|---------|------------------|-----------|
| stateful（首次） | 无 | 新建 stateful 会话，响应返回 `sap-contextid` |
| stateful（后续） | 有 | 同一持锁会话；重复 lock 返回相同 `lockHandle` |
| stateless | **绝不携带** | 不影响持锁会话 |
| stateless + contextid | 仅 `dropSession` | **销毁** stateful 会话，返回 `sap-contextid=0` |

> 踩坑：单一 cookie jar 把 contextid 混进 stateless 请求，会静默杀掉持锁会话，后续 PUT 报 423（lock handle could not be created）。

`dropSession()`：发送**携带 contextid 的 stateless** 请求以显式销毁服务端会话。

---

## 2. 写操作会话模型（核心，已核实）

早期曾误用 `X-sap-adt-sessiontype: stateful;enqueue`，并误判「纯 HTTP 无法更新 DTP」。实测结论：

1. **lock / unlock 必须发 `stateful`（不是 `stateful;enqueue`）**。发 `stateful;enqueue` 时服务端返回 `sap-contextid=0` 并销毁会话，锁立即丢失。Eclipse 日志里的 “stateful, enqueue” 是服务端展示标签，不是客户端 header 值。
2. **`sap-contextid` 只能随 stateful 请求发送。**
3. **PUT / `transportchecks` / `activation` / 多数 CTS 走 stateless**，不带 contextid；服务端用 enqueue 表校验 URL 上的 `lockHandle`。
4. **unlock 回到持锁的 stateful 会话**（stateful 头 + contextid）。
5. 编排应在 `finally` 中 unlock，避免中途失败留下锁。

### 典型写序列（ADSO / DTP / TRFN / RSDS 同构）

| 步骤 | 请求 | Session | API |
|------|------|---------|-----|
| 1 | `POST …?action=lock` | **stateful** | `lock*` |
| 2 | `POST /cts/transportchecks` | stateless | `transportCheck` |
| 3 | `POST /cts/transports`（若需新建 TR） | stateless | `createTransport` |
| 4 | `PUT …/m?lockHandle=…[&corrNr=…]` | **stateless** | `update*` |
| 5 | `POST /activation`（body 可含 lockHandle） | stateless | `activate*` |
| 6 | `POST …?action=unlock` | **stateful** | `unlock*` |

> 对象已挂在 TR 上时，lock 响应常带 `CORRNR`，PUT 可复用该号；首次进 TR 时 PUT 带 `corrNr`。

推荐入口：`saveAndActivate*`（api 层编排）或域 facade（如 `client.adso.saveAndActivate`）。

### Transport 解析（调用方显式选择）

`resolveTransportForWrite`：

1. 显式 `options.transport` → 使用该 TR  
2. 否则若 lock 已有 `corrNr` → 复用  
3. 否则若 `createTransport: true` → 新建  
4. 否则若需要录制 → 抛出 `TransportRequiredError`（附带可用 TR 列表）— **不会**自动取 `TRANSPORTS[0]`

```typescript
await client.adso.saveAndActivate(adsoId, xml, {
  transport: "<EXISTING_TR>",       // 或
  // createTransport: true,
  // transportDescription: "…"
})
```

### 版本标识

URI 后缀：`m` = active，`a` = modified，`d` = revised。  
RSDS 特例：版本字符在 `<atom:id>`，不在 URI 后缀。

---

## 3. CTS

| API | 请求 | 说明 |
|-----|------|------|
| `transportCheck(uri)` | `POST /sap/bc/adt/cts/transportchecks` | `RECORDING` / `KORRFLAG` / `TRANSPORTS` / `LOCKS` |
| `createTransport(refUri, description)` | `POST /sap/bc/adt/cts/transports` | 返回新 TR 号 |

`RECORDING` 为空有时表示对象**已锁在某 TR**，是否强制录制应结合 `KORRFLAG`；`LOCKS.LOCK_HOLDER` 可显示持锁 TR。

---

## 4. 各域读/写要点（脱敏摘要）

### 搜索 / 关联 / 血缘

- `searchBWObjects` / `repository.search`：按名、类型过滤。  
- `transformationsOf` / `dtpsOf`：按 ADSO 查关联 TRFN / DTP。  
- `getDataflow` / `getDataflowLineage`：DMOD 血缘；`upstream` / `downstream` / `both`。

### ADSO

- 读：`details` / `xml` / `versions` / `check`。  
- 写：`saveAndActivate`；本地 field 可用 XML 辅助（`addADSOFieldToXml` 等）再写回。  
- Field 类型：无 `infoObjectName`，`sidDeterminationMode="N"`，标签在 `localProperties/descriptions`。

### DTP

- 读：`details` 需正确解析 `source`/`target` 子元素与 `tlogoProperties`。  
- 写：与上表会话模型一致；`execute` 为运维执行。

### TRFN

- **创建**经本库仍不可用（历史曾疑 JCo；创建需在修复后的会话模型下再验证）。读 / 更新 / 激活 / 删除 / check 正常。  
- 结束例程 setFields、规则 XML 辅助、例程 ABAP 类源码读写已实测；类 lock 使用 `_action=LOCK/UNLOCK`，类激活走 `/sap/bc/adt/activation`（非 BW modeling activation）。

### DataSource (RSDS)

- 读：details / fields / xml / versions。  
- 写：stateful lock/unlock + stateless PUT/activate；`mergeProposal` 用于适配器变更后字段合并。  
- Replication：预检 + `replicate` / `replicateFull`。

### Reporting / DDIC

- BICS：`query.preview` / `initialView` / `updateView`（ADSO / 特征 / HCPR）。  
- DDIC：`describe` / `getData` / `querySql`；部分列需 `SELECT *` 运行时路径（见 `selectStar` 选项）。

### Process Chain / InfoObject / System

- 运维：`execute` / `stop` / `logs`。  
- InfoObject：读 + validate。  
- System：`info` / capabilities。

---

## 5. 本地复测

```bash
cp .env.example .env   # 填入本机凭据，勿提交
npm test -- --testPathPattern=adso-write
```

更多端点路径见 [API_MAPPING.md](./API_MAPPING.md)；贡献约定见 [CLAUDE.md](../CLAUDE.md)。

---

## 6. 安全说明

本文件及仓库历史**不得**包含：内网 IP/主机名、用户名/工号、密码、CSRF/Session cookie、真实 TR 号、客户业务对象清单式导出。  
若曾误提交，须从 git 历史清除并轮换可能泄露的会话/密码。
