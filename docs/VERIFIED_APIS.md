# 已验证 API 文档

> 本文档记录在真实 BW/4HANA 系统上实测通过的行为与会话模型。  
> **不含**具体主机、账号、会话令牌、传输号或客户对象技术名；本地验证请用 `.env` 与自有测试对象。

验证日期基准：2026-07-15（写会话模型）；后续模块以同模型复测为准。  
**2026-09-19 全量复测**：61 个域门面方法 + 客户端方法逐一实测，见[第 6 节](#6-2026-09-19-全量复测发现)。  
**2026-09-20 读 API 全量验证**：86 个读类 API 逐一真机验证（多样本：标准 0\*/客户 Z\*/系统生成 id/双段 RSDS/不同源系统），63 ✅ / 5 ⚠️ / 18 ❌；逐 API 状态见 [API_REFERENCE.md](./API_REFERENCE.md) 状态列，新发现见[第 7 节](#7-2026-09-20-读-api-全量验证发现)。

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
| Process Chain | ✅（读路径，2026-09-20 rspc JSON 化） | `getProcessChainDetails` 端到端；版本/日志/状态后缀本系统不支持，execute/stop 未实测 |

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

- 运维：`execute` / `stop` / `logs`（未复测——不允许对业务链执行）。
- **PC 建模前缀实测为 `/sap/bw/modeling/rspc/{id}`，读路径服务 JSON**（库已 rspc 化，2026-09-20）；`/versions`、`/logs`、`/status` 后缀本系统返回「不支持对象版本 V/L/S」。PC 名大小写敏感。
- InfoObject：读 + validate。  
- System：`info` / `getProperty` / `hasCapability`（`properties[]` 数组结构，如 `system.logsys`、`bw.planning_supported=X`）。

---

## 5. 本地复测

```bash
cp .env.example .env   # 填入本机凭据，勿提交
npm test -- --testPathPattern=adso-write
```

完整 API 清单（读/写分类与验证状态）见 [API_REFERENCE.md](./API_REFERENCE.md)。

---

## 6. 2026-09-19 全量复测发现

证据：只读 48 项 + 归因探针 + 写场景（create/saveAndActivate/addField/改字段类型/删字段/混合字段/delete），全部在真实系统实测。写操作仅在测试 InfoArea 以 $TMP 本地对象进行；对象清单与逐项结果在本地 `.local/`（不入库）。

**库缺陷（需修复）**

- **F1（已修复 2026-09-20，读路径）PC 前缀**：库用 `/sap/bw/modeling/pc/{id}`，本系统实际为 **`/sap/bw/modeling/rspc/{id}`**（`/pc/` 404，`/rspc/{id}/m` 200）。修复不止换前缀：**`/rspc/{id}/m` 服务的是 JSON**（`application/vnd.sap.bw4.modeling.processvariant.chain-v1_0_0+json`；payload 仅 `{ bActive, sVariantDescription, oDetail, aSocket[], aExecutionOption[] }`，无链名/步骤/时间戳字段），`pc-v1_0_0+xml`、`rspc-v1_0_0+xml`、`application/xml` 一律 415。库已按 JSON 重写 PC 读路径并端到端复测（搜索 → getProcessChainDetails 全链通过）；`/versions`、`/logs`、`/status` 后缀本系统拒绝（「不支持对象版本 V/L/S」），execute/stop 未实测（不允许动业务链）。PC 名大小写敏感，URI 不再转小写（`preserveCase`）。另：搜索 objectType 过滤值为 `RSPC`（见 N2）。
- **F2（已修复）TRFN 瞬态创建 500**：根因是创建 POST 用了 `stateful` 会话——与 3 月成功日志（该 POST 为 **stateless**）及会话模型相悖。改为 `session_types.stateless` 后创建稳定成功并端到端复测（创建→更新→激活→删除，见下）。库从 47504da 起引入此回归。
- **F3（已修复 2026-09-20）空白 ADSO 无法激活**：「XML 被写入字面量 `undefined` 节点」用当前已提交库代码**不可复现**（疑出自当时未入库的临时脚本）。可复现的真实缺陷：空白创建 → 加字段 → PUT 成功但**激活报「Key definition missing」**，对象卡 inactive。**键的完整形态已实测闭环**：`<keyElement>#///{iobj}</keyElement>` + 一个**同名引用元素**，且该元素必须带 `inlineType`（`globalElementName={iobj}`）——裸引用元素（无 inlineType）被服务器 500 拒绝。库已加 `addADSOKeyToXml`/`addADSOKey`/`adso.addKey`（发射实测形态）与 `addField` 无键 fail-fast；端到端复测：空白创建 → addKey → addField → 激活成功（回读 active）。注：keyElement 的 inlineType length 仅实测过 40（0MATERIAL），服务器是否校验长度未验证。
- **F4（已修复 2026-09-20）模板校验无视类型**：`adso.create` 门面对 `template.type=IOBJ` 仍按 ADSO 校验模板名。实测 validation objectType 合法 token 仅 **ADSO / IOBJ / RSDS**（`DSO`、`ISRC` 直接报「Object type … is not valid」）；修复为 `templateValidationObjectType` 按 tlogo 映射（DSO→RSDS），ISRC 无合法 token 跳过预检交服务端裁决。修复后门面端到端复测通过（IOBJ 模板创建 → 水合 InfoObject 引用字段 + keyElement → 删除）。
- **F5（已修复 2026-09-20）包根导出缺口**：根 `src/index.ts` 现整体再导出 `./api`；`api/index.ts` 补 `createTransformation`/`createDTP` 及其选项类型。
- **F6（已修复 2026-09-20）门面缺口**：`TrfnDomain` 增加 `create()`（转发 api 层 `createTransformation`）。

**2026-09-20 复核新增库缺陷（均已修复）**

- **N1 JSON 响应保真**：`AxiosHttpClient` 曾把 axios 自动解析的 JSON 对象串化为 `"[object Object]"`（数据丢失，`/rspc` JSON 端点首个受害者）。修复：`responseBody()`——字符串透传、其余 `JSON.stringify`。
- **N2 搜索枚举错值**：`SearchObjectType.PROCESS_CHAIN` 旧值 `"PROCS_CHAIN"` 使 bwsearch 直接 500；实测正确值 `"RSPC"`。

**服务端行为（新证据）**

- **F7 会话中毒**：任一请求 500 之后，同一 stateful 会话的后续请求连锁失败（500/400/501），重新登录后恢复。编排层遇到 500 应换新会话重试，而非原地重试。**已实现（2026-09-20）**：`withFreshSessionOnServerError` 接入 `BWObject.lock`/`lockDataSource`/`createTransformation` CREA lock——lock 失败不留服务端状态，5xx 换新会话重登重试一次安全；PUT/activate 不自动重试（无法判断是否已部分生效）。恢复机制本身未真机触发（无法安全制造中毒场景），离线单测覆盖。
- **F8 本地对象写不需要 TR**：$TMP 对象 `transportchecks` 返回 RECORDING 空、无 TRANSPORTS，`resolveTransportForWrite` 全链（lock→PUT→activation→unlock）无需传输号即可完成。`lock` 响应 `IS_LOCAL=X` 可判定本地对象。**已实现（2026-09-20）**：`LockResult.isLocal`（实测 $TMP 对象 lock 返回 true）；顺带修复 `lockHandle` 纯数字被 fullParse 转 number 的类型偏差。
- **F9 ddicTableLink 是模板**：ADSO 响应头 Link 中 `rel=ddicTableLink` 指向 `…/ddic/tables/{table_name}/source/main`（字面量占位符），`adsoDdicTableName` 因此返回 undefined。真实表名应从 ADSO XML `tables` 取。**已修复（2026-09-20）**：`getADSODDICTableName` 改读 `/m` XML `tables` 段（activeTable 优先），实测返回真实表名。
- **F10 querySql 语法**：`/sap/bc/adt/datapreview/ddic` 的 SELECT 语句**不带引号、大写表名**（`SELECT * FROM /BIC/AZxxxxxxx` 形式）；带双引号会被拒「仅允许 SELECT 语句」。
- **F11（已修复 2026-09-20）infoObject 引用字段**：字段级引用 IOBJ 的元素形如 `<element xsi:type="adso:AdsoElement" name="X" infoObjectName="X" …>`；**PUT 只需最小形态（name + infoObjectName，无 inlineType），服务器水合 inlineType/association 等其余属性**（实测水合出 `inlineType globalElementName=…` 等）。库已加 `infoObjectName` 字段与 `buildADSOInfoObjectElementXml`，经 `addADSOField` 端到端复测：PUT 接受 + 服务器水合确认（激活报错均为模板自带标准单位字段的「主数据检查不能为无报表」配置，与引用字段无关）。

**TRFN 规则专项证据（2026-09-19/20）**

- 真实 TRFN 的 rule 谱（46 个 TRFN 全量只读扫描）：`StepDirect` 1556、`StepNoUpdate` 632、`StepTime` 240、`StepInitial` 82、`StepRoutine` 66、`StepConstant` 25、`StepFormula` 22。各类型 XML 形态已采样（Constant 为 `constant="…"` 属性、Formula 为 `formula="…"` 表达式属性、Routine 带 `classNameM/methodNameM`）。
- **通用规则入口 `addRule()`（2026-09-20 实现并真机验证）**：DIRECT/CONSTANT/INITIAL/FORMULA/NO_UPDATE 五类；组引用前缀按实际 S 组推导（不再硬编码 group1）；rule id 组内最大 +1 且全局唯一；目标字段已有规则默认**替换**（Eclipse 改规则类型语义）。真机回读：FORMULA、CONSTANT、INITIAL、NO_UPDATE 均被服务器接受并按写入类型持久化。
- **服务器行为（新增）**：① `nextRuleId` 类正则若写死 `<rule id="…">` 会对水合规则全盲——水合规则是 `description` 在前（已修）；② **键字段上的 INITIAL 会被服务器静默规范化为 StepNoUpdate**（实测 ISVAID；非键字段 ZNID/ZDATE/ZS4 的 StepInitial 原样持久化）；③ 激活时对关键规则给 Warning（"已选择初始更新"），check 仍 success。
- **例程 = ABAP 运行时类**：END 例程类名形如 `/BIC/F{TRFN id 尾段}_M`、方法 `GLOBAL_END`，`getAbapClassSource` 只读读取通过。例程类为系统生成的本地对象。
- **服务器水合**：8TRANSIENT 创建后，服务器按源/目标同名字段自动生成 DIRECT 规则（实测 9 条）——新建 TRFN 无需 autoMap 即有初始映射。
- **运行时切换可写**：根属性 `HANARuntime="true|false"`，`switchTransformationRuntime` 翻转 + `saveAndActivate` 端到端验证（true→false 回读生效、check 通过）。
- **TRFN 删除（已入库 2026-09-20）**：transportchecks 路径需 `transport`（本地对象没有）；实测服务端路径 `lock(?action=lock)` → `DELETE /m?lockHandle=…` → `unlock` 可删本地 TRFN，裸 lock 必须带 `Accept: …trfn-v1_0_0+xml`，否则 415。`BWObject.delete` 已把 TRFN 归入 lockHandle 模式（可带 `transport` 作 corrNr），端到端复测通过（创建 → delete({lockHandle}) → 回读确认不存在）。
- **缺口**：START/END/EXPERT 例程的**创建**无 REST 路径（库的 `setEndRoutineFields` 只能在已有 END 规则上加字段）；新字段的结构同步（Eclipse「同步结构」）库也未实现——跨名字段的 DIRECT 规则写链因此无法端到端测试。

**BICS / DDIC 实证补充**：`query.initialView/preview/updateView` 全链通过（provider → 首特征 → preview 15 状态行 → updateView 回写）；DDIC `describe/getData/querySql` 通过（`selectStar` 运行时路径可用）。

---

## 7. 2026-09-20 读 API 全量验证发现

样本多样性：ADSO×3（0\* 标准 / Z\* 客户×2）、TRFN×2、DTP×2、RSDS×2（真实 ds×源系统组合发现）、InfoObject×2（特征+定制）、流程链×2、InfoArea、命名空间对象专项。无写操作；BICS 用 initialView→state 复用→preview/update 顺序。

**服务端事实（新证据，影响 API 可用性）**

- **V1（已处置 2026-09-20：移除）validation 端点仅支持 `action=exists`（加可创建类型的 `new`）**：`action=delete`、`action=activate` 被全类型拒绝（"Action 'delete'/'activate' is not valid"——ADSO/TRFN/DTP/IOBJ/PC 五类 × CanDelete/CanActivate 共 10 个函数全部 ❌）；`objectType=PC` 整体非法（"Object type 'PC' is not valid"）；DTPA/PC 的 `new` 被拒（"Creation of objects of type 'DTPA'/'PC' not supported"）。**共 13 个 validate\* 函数在本系统不可用——已从 API 面移除**（含 `BWObject.canDelete/canActivate` 与 `ValidationAction.DELETE/ACTIVATE`；存活的验证面收敛为 exists + 可创建类型的 new）。
- **V2 repository.ts 模块端点在本系统不存在**：`/sap/bc/adt/bw/objects/infoobject[/name]`、`/infocatalog` 一律 404（"Resource does not exist"）——3 个函数本系统不可用，疑似面向其他发行版/产品。
- **V3 BICS initialView-first 顺序可用**：ADSO 提供者 initialView → 复用 state → updateView 回写成功；直接 preview 用 XML 元素名作 rows 会被拒（"Unknown row characteristic(s)"）——rows 必须用 BICS 视图状态里的特征名，不能用建模字段名。

**库缺陷（新发现，待修）**

- **V4 命名空间对象名未编码**：`/NS/OBJ` 形态的名字拼入 ADSO 读 URL 时未 encodeURIComponent，`/` 被当作路径切开 → 404。getADSO/getADSODetails/getADSOXml/getADSOTables/getADSOConfiguration 同构共享此模式（本轮实测 getADSOTables 复现 404）。
- **V5（已修复 2026-09-20）getADSONodePath 双重编码**：根因是调用方预编码 `encodeURIComponent(objectUri)` 后再交给传输层（axios params 单次编码），上线成 `%252F...`，服务端报「Data type "" does not exist」。真机三组对照定位（预编码❌ / 单次编码✅ 200 同字节 / 原始串进 qs✅）；Eclipse 抓包（08:51 日志）线上形态即单次编码。修复后实测 adso URI 返回 3 节点；nodepath 端点本身对 iobj URI 同样可用（iobj 探针 200）。回归锁 `adso-nodepath-encoding.test.ts`：qs 必须收原始串。
  同轮 Eclipse 日志对照发现 5 个库外端点（iobj/versions、iobj/configuration、rules/qprops[需 vendor Accept `…ov_query_props-v3_0_0+xml`]、queryint user_props、repo/infoproviderstructure）均真机 200，未入库待决策。

- **V6（2026-09-21）Eclipse 日志对照批**：`GET /sap/bw/modeling/repo/infoproviderstructure/area/{area}/{type}` 已入库（`getInfoproviderStructure`，门面 `repository.infoproviderStructure`）——atom:feed + bwModel:object（objectName/objectType/objectSubtype/objectStatus + atom:id/atom:title）；实测 iobj_cha/iobj_kyf/iobj/adso 三 type 均 200，无内容返回空 feed 不报错。**qprops（`GET /rules/qprops?objectType=&infoprovider=&version=`）端点存在但 vendor Accept 未知**：服务端 415 报错对两侧内容类型的中间段一律以 `…` 缩写（`application/vnd.sap.bw…ov_query_props-v3_0_0+xml`），17 个候选命名空间全部不中，ADT discovery（atomsvc，148KB）未登记该服务——待 Eclipse 请求头佐证后实现。

## 安全说明

（2026-09-19 复测发现见第 6 节；2026-09-20 读验证新发现见第 7 节。）

本文件及仓库历史**不得**包含：内网 IP/主机名、用户名/工号、密码、CSRF/Session cookie、真实 TR 号、客户业务对象清单式导出。  
若曾误提交，须从 git 历史清除并轮换可能泄露的会话/密码。
