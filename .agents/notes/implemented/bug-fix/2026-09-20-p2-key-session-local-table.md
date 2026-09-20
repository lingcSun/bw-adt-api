# Agent Note: 2026-09 复测 P2 修复批次（F3 键定义闭环、F7 会话恢复、F8 isLocal、F9 表名）

Status: implemented

## Problem

复测遗留的最后四项：F3 空白 ADSO 因键定义不完整而永久 inactive（键的完整 XML 形态在 P0/P1 时仍未钉死）；F7 会话中毒后编排连锁失败无恢复；F8 lock 响应的本地对象标记未解析；F9 `getADSODDICTableName` 从模板占位符 Link 头提表名，恒返回 undefined。

## Decision

- **F3 键定义（真机闭环）**：受控实验钉死激活要求的完整形态——`<keyElement>#///{iobj}</keyElement>` + **同名引用元素**，且元素必须带 `inlineType`（`globalElementName={iobj}`）；裸引用元素（P1 的 F11 最小形态）在键场景被服务器 500 拒绝。据此新增纯函数 `addADSOKeyToXml`（幂等，发射与实测逐字节一致的形态）、编排 `addADSOKey`（默认不激活——只有键没有字段时激活会报「需至少一个字段」，让随后的 addField 负责激活）、门面 `adso.addKey`；`addADSOFieldToXml` 对无键 XML fail-fast 并指引 addKey。
- **F7 会话恢复**：`withFreshSessionOnServerError(client, op)`——5xx 时 `dropSession` + 重登 + 重试一次。只接入三处 lock 入口（`BWObject.lock`/`lockDataSource`/`createTransformation` CREA lock）：lock 失败不留服务端状态，重试安全；PUT/activate 刻意不接入，自动重试无法判断服务端是否已部分生效。
- **F8**：`LockResult.isLocal`（`IS_LOCAL=X`）。顺带修复 `parseLockResponse` 对纯数字锁句柄被 fullParse 转 number 的类型偏差（`String()` 收敛，对外契约本就是 string）。
- **F9**：`getADSODDICTableName` 改读 ADSO `/m` XML `tables` 段（activeTable 优先，其次 activeDataTables 首个）；`getADSODDICLinks` 保留但 docstring 标明 ddicTableLink 是模板占位符。

## Alternatives considered

- **F3 键形态用完整水合拷贝**（含 endUserTexts/association/consumptionViewProperties）：能激活的最小形态已经钉死（带 inlineType 的引用元素 + keyElement），多出的属性是噪音，服务器会自行水合。
- **F7 做成传输层全局重试**：写请求（POST 创建体）重试可能重复建对象；AdtHTTP 层也无从区分"安全可重试"的操作。编排入口 lock 是唯一失败无副作用的注入点。
- **F7 覆盖 400**：账本记的中毒链路含 400/501，但 lock 的 400 更可能是真实业务拒绝（如对象已锁），盲目换会话重试会把业务错误变成重试风暴。只对 5xx 恢复，400 上抛。
- **addKey 默认激活**：空白 ADSO 只有键没有字段时激活必报「需至少一个字段」，默认激活等于默认失败；让 addField 收尾激活是唯一顺的流程。
- **F9 直接删掉 Link 头解析**：defaultDataPreview 等其他链接仍有用，保留 `getADSODDICLinks` 并标注。

## Consequences

- `addADSOFieldToXml` 对无键 XML 从"静默产出不可激活对象"变为抛错——依赖它在无键对象上加字段的调用方需先 addKey（这正是要阻断的失败路径）。
- `addADSOKeyToXml` 的 inlineType `length` 默认 40，是唯一实测值；服务器是否校验长度未验证，选项暴露给调用方。
- `parseLockResponse.lockHandle` 现在恒为 string；此前依赖"数字句柄"的调用方（如有）需适配——按 codec 声明本就应是 string。
- F7 恢复机制未真机触发（无法安全制造中毒场景）：离线单测覆盖分支，真机行为断言仅限账本原有的中毒现象记录。

## Testing

`npm run build` 通过；离线套件 54/54 绿（新增 `p2-lock-key-ddic`：isLocal 解析、会话恢复三分支、键构建/幂等/fail-fast）。真机端到端（build 产物）：空白创建 → `addKey(0MATERIAL)` → `addADSOField` → 激活成功（"Object activated / DataStore consistent"，回读 active）→ 删除；$TMP lock `isLocal=true`；`getADSODDICTableName` 返回真实表名。

## Related

- 证据账本：[VERIFIED_APIS](../../../../docs/VERIFIED_APIS.md) 第 6 节（F3 关闭，F7/F8/F9 标注已实现）。
- 前两批：[P0](2026-09-20-p0-review-batch.md)、[P1](2026-09-20-p1-pc-rspc-trfn-delete-iobj-field.md)。
