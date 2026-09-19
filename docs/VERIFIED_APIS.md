# 已验证 API 文档

> 本文档记录在真实 BW/4HANA 系统上实测通过的行为与会话模型。  
> **不含**具体主机、账号、会话令牌、传输号或客户对象技术名；本地验证请用 `.env` 与自有测试对象。

验证日期基准：2026-07-15（写会话模型）；后续模块以同模型复测为准。  
**2026-09-19 全量复测**：61 个域门面方法 + 客户端方法逐一实测（只读用既有测试对象，写全部在测试 InfoArea 以 $TMP 本地对象进行），发现若干偏差，见[第 6 节](#6-2026-09-19-全量复测发现)。

---

## 验证状态总览

| 模块 | 状态 | 主要测试 |
|------|------|---------|
| 登录 / 会话 / contextid | ✅ | `login.test.ts` |
| 系统信息 | ✅ | `login.test.ts` |
| 搜索 / ADSO 关联 / 血缘 | ✅ | `search*.ts` / `adso-relations` / `dataflow` |
| ADSO / DTP / TRFN 读 | ✅ | 各域 `*-*.test.ts` |
| ADSO / RSDS 写 | ✅（2026-09-19 复测，$TMP 本地对象） | `*-write.test.ts`（见下文会话模型） |
| TRFN 写（创建/更新/切换/删除） | ✅（F2 修复后复测） | 瞬态流创建 + 水合规则 + HANARuntime 切换 |
| TRFN 例程创建 | ❌ 无 REST 路径 | `setEndRoutineFields` 仅限已有 END 规则 |
| TRFN 例程类读/写 | ✅ | `trfn-routine-*.test.ts` |
| DataSource / Replication 读 | ✅ | `datasource*.ts` / `replication.test.ts` |
| RSDS / Replication 写 | ⚠️ 未复测 | 无本地 RSDS 靶子（仅允许动自建对象） |
| CTS transport | ⚠️ | `transportCheck` 复测通过（本地对象行为 F8）；`createTransport` 未复测 |
| BICS reporting preview | ✅（2026-09-19 复测） | `reporting.test.ts` |
| Process Chain | ❌ | 库前缀 `/pc/` 应为 `/rspc/`（F1） |

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

> 0.4.0 起 activation 也可携带 `corrNr`（query 参数，与 DTP/RSDS 的实测用法一致）。DTP/RSDS 已验证；**ADSO/PC 侧接受该参数尚待真机复核**，复核通过后本条转为已验证记录。

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

- **创建**：`createTransformation()` 走 8TRANSIENT 瞬态流（GET 铸 id → stateful+CREA lock → POST 极简创建体 → unlock → 水合读回；packageName 非 $TMP 时再 PUT 改包并登记 transport）。2026-09-11 实测全程创建成功；**2026-09-19 复测创建 POST 稳定 500（新会话下亦复现，疑似服务端行为变更，见 F2）**。通用的泛型 POST 流仍不可用（服务端在 CL_RSTRAN_TRFN->GET_PROGID 抛 CX_SY_REF_IS_INITIAL），`createObject("trfn")` 会显式拒绝并指引到 `createTransformation`。  
- 读 / 更新 / 激活 / 删除 / check 正常。  
- 结束例程 setFields、规则 XML 辅助、例程 ABAP 类源码读写已实测；类 lock 使用 `_action=LOCK/UNLOCK`，类激活走 `/sap/bc/adt/activation`（非 BW modeling activation）。**例程类是系统生成的本地对象**（不挂包、不参与 CTS 录制），保存类源码不需要 TR——Eclipse 保存例程的日志序列中本就没有 transportchecks 步骤；`saveAndActivateTransformationClassSource` 的 `transport` 参数仅作用于随后的 TRFN 重新激活。

### DataSource (RSDS)

- 读：details / fields / xml / versions。  
- 写：stateful lock/unlock + stateless PUT/activate；`mergeProposal` 用于适配器变更后字段合并。  
- Replication：预检 + `replicate` / `replicateFull`。

### Reporting / DDIC

- BICS：`query.preview` / `initialView` / `updateView`（ADSO / 特征 / HCPR）。  
- DDIC：`describe` / `getData` / `querySql`；部分列需 `SELECT *` 运行时路径（见 `selectStar` 选项）。

### Process Chain / InfoObject / System

- 运维：`execute` / `stop` / `logs`（本次未复测——不允许对业务链执行）。
- **PC 建模前缀实测为 `/sap/bw/modeling/rspc/{id}`**；库内 `/sap/bw/modeling/pc/{id}` 在本系统 404（见第 7 节 F1）。`GET /rspc/{id}/m` 200；`/versions`、`/logs` 后缀本系统返回「不支持对象版本 V/L」。
- InfoObject：读 + validate。  
- System：`info` / `getProperty` / `hasCapability`（`properties[]` 数组结构，如 `system.logsys`、`bw.planning_supported=X`）。

---

## 5. 本地复测

```bash
cp .env.example .env   # 填入本机凭据，勿提交
npm test -- --testPathPattern=adso-write
```

更多端点路径见 [API_MAPPING.md](./API_MAPPING.md)。

---

## 6. 2026-09-19 全量复测发现

证据：只读 48 项 + 归因探针 + 写场景（create/saveAndActivate/addField/改字段类型/删字段/混合字段/delete），全部在真实系统实测。写操作仅在测试 InfoArea 以 $TMP 本地对象进行；对象清单与逐项结果在本地 `.local/`（不入库）。

**库缺陷（需修复）**

- **F1 PC 前缀**：库用 `/sap/bw/modeling/pc/{id}`，本系统实际为 **`/sap/bw/modeling/rspc/{id}`**（`/pc/` 404，`/rspc/{id}/m` 200）。`details/check/logs` 因此全挂；且 `/versions`、`/logs` 后缀本系统不支持（「不支持对象版本 V/L」）。另：`checkProcessChain` 会把 chainId 小写——PC 名大小写敏感时是隐患。
- **F2（已修复）TRFN 瞬态创建 500**：根因是创建 POST 用了 `stateful` 会话——与 3 月成功日志（该 POST 为 **stateless**）及会话模型相悖。改为 `session_types.stateless` 后创建稳定成功并端到端复测（创建→更新→激活→删除，见下）。库从 47504da 起引入此回归。
- **F3 空白模板 ADSO 无法激活**：`createADSO` 无 template 时，创建成功但 XML 被写入字面量 `undefined` 节点；后续 PUT 成功、激活报「名称 undefined 不是以字母开头」（errorPosition `#///undefined`），check=false，对象永久 inactive。ADSO/IOBJ 模板创建不受影响。
- **F4 模板校验无视类型**：`adso.create` 门面对 `template.type=IOBJ` 仍按 ADSO 校验模板名（validation 404 → 直接失败）。绕过门面走 api 层 `createADSO` + IOBJ 模板，服务器**接受**且 20/20 元素生成为 infoObject 引用字段——门面预检过严，不是服务端限制。
- **F5 包根导出缺口**：`src/index.ts` 未再导出 `./api/*`（`createBWObject`/`BWObjectType`/`createTransformation` 等只能从 `build/api/...` 子路径导入）。
- **F6 门面缺口**：`TrfnDomain` 没有 `createTransformation` 方法（api 层有）。

**服务端行为（新证据）**

- **F7 会话中毒**：任一请求 500 之后，同一 stateful 会话的后续请求连锁失败（500/400/501），重新登录后恢复。编排层遇到 500 应换新会话重试，而非原地重试。
- **F8 本地对象写不需要 TR**：$TMP 对象 `transportchecks` 返回 RECORDING 空、无 TRANSPORTS，`resolveTransportForWrite` 全链（lock→PUT→activation→unlock）无需传输号即可完成。`lock` 响应 `IS_LOCAL=X` 可判定本地对象。
- **F9 ddicTableLink 是模板**：ADSO 响应头 Link 中 `rel=ddicTableLink` 指向 `…/ddic/tables/{table_name}/source/main`（字面量占位符），`adsoDdicTableName` 因此返回 undefined。真实表名应从 ADSO XML `tables` 取。
- **F10 querySql 语法**：`/sap/bc/adt/datapreview/ddic` 的 SELECT 语句**不带引号、大写表名**（`SELECT * FROM /BIC/AZxxxxxxx` 形式）；带双引号会被拒「仅允许 SELECT 语句」。
- **F11 infoObject 引用字段**：字段级引用 IOBJ 的元素形如 `<element xsi:type="adso:AdsoElement" name="X" infoObjectName="X" …>`（无 inlineType）。库内 `addADSOFieldToXml` 仅支持本地字段（inlineType），IOBJ 引用字段需手工拼元素（手工拼接 PUT 激活链路实测可行——对象本身因 F3 无法激活，字段写入/更新路径已验证）。

**TRFN 规则专项证据（2026-09-19/20）**

- 真实 TRFN 的 rule 谱（46 个 TRFN 全量只读扫描）：`StepDirect` 1556、`StepNoUpdate` 632、`StepTime` 240、`StepInitial` 82、`StepRoutine` 66、`StepConstant` 25、`StepFormula` 22。各类型 XML 形态已采样（Constant 为 `constant="…"` 属性、Formula 为 `formula="…"` 表达式属性、Routine 带 `classNameM/methodNameM`）。
- **通用规则入口 `addRule()`（2026-09-20 实现并真机验证）**：DIRECT/CONSTANT/INITIAL/FORMULA/NO_UPDATE 五类；组引用前缀按实际 S 组推导（不再硬编码 group1）；rule id 组内最大 +1 且全局唯一；目标字段已有规则默认**替换**（Eclipse 改规则类型语义）。真机回读：FORMULA、CONSTANT、INITIAL、NO_UPDATE 均被服务器接受并按写入类型持久化。
- **服务器行为（新增）**：① `nextRuleId` 类正则若写死 `<rule id="…">` 会对水合规则全盲——水合规则是 `description` 在前（已修）；② **键字段上的 INITIAL 会被服务器静默规范化为 StepNoUpdate**（实测 ISVAID；非键字段 ZNID/ZDATE/ZS4 的 StepInitial 原样持久化）；③ 激活时对关键规则给 Warning（"已选择初始更新"），check 仍 success。
- **例程 = ABAP 运行时类**：END 例程类名形如 `/BIC/F{TRFN id 尾段}_M`、方法 `GLOBAL_END`，`getAbapClassSource` 只读读取通过。例程类为系统生成的本地对象。
- **服务器水合**：8TRANSIENT 创建后，服务器按源/目标同名字段自动生成 DIRECT 规则（实测 9 条）——新建 TRFN 无需 autoMap 即有初始映射。
- **运行时切换可写**：根属性 `HANARuntime="true|false"`，`switchTransformationRuntime` 翻转 + `saveAndActivate` 端到端验证（true→false 回读生效、check 通过）。
- **TRFN 删除**：库路径需 `transport`（本地对象没有）→ 实测服务端路径 `lock(?action=lock)` → `DELETE /m?lockHandle=…` → `unlock` 可删本地 TRFN；裸 lock 必须带 `Accept: …trfn-v1_0_0+xml`，否则 415。
- **缺口**：START/END/EXPERT 例程的**创建**无 REST 路径（库的 `setEndRoutineFields` 只能在已有 END 规则上加字段）；新字段的结构同步（Eclipse「同步结构」）库也未实现——跨名字段的 DIRECT 规则写链因此无法端到端测试。

**BICS / DDIC 实证补充**：`query.initialView/preview/updateView` 全链通过（provider → 首特征 → preview 15 状态行 → updateView 回写）；DDIC `describe/getData/querySql` 通过（`selectStar` 运行时路径可用）。

---

## 安全说明

（2026-09-19 复测发现见第 6 节。）

本文件及仓库历史**不得**包含：内网 IP/主机名、用户名/工号、密码、CSRF/Session cookie、真实 TR 号、客户业务对象清单式导出。  
若曾误提交，须从 git 历史清除并轮换可能泄露的会话/密码。
