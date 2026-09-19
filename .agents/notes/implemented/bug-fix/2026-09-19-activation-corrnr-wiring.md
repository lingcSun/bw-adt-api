# Agent Note: activation 透传 corrNr，消除 activate* 死参数

Status: implemented

## Problem

`activateADSO` / `activateProcessChain` 声明并文档化了 `corrNr` 参数，实现却直接丢弃（只传 lockHandle）；而 `activateDTP` / `activateDataSource` 的激活真的把 corrNr 放进 query（有实测依据）。`saveAndActivateADSO` 把 transport 传给激活也被静默丢掉。同类参数在不同域的行为分叉，调用方无法建立预期。

## Decision

向"已验证"的方向统一——接通而不是删参数：

- `common.ts` 的 `activateObject` 增加可选 `corrNr`，非空时以 `{ corrNr }` 作为激活 POST 的 query；
- `BWObject.activate(lockHandle?, corrNr?)` 透传；
- `activateADSO` / `activateProcessChain` 补上传递（`saveAndActivate*` 链路随之把 TR 带到激活步）。

## Alternatives considered

- **删掉死参数**：表面更干净，但调用方传 corrNr 的预期是"发送"，且与 DTP/RSDS 已验证用法相悖，等于向未验证的方向统一。
- **激活永远不带 corrNr（三处都删）**：若真机复核发现 ADSO/PC 拒绝该 query 参数，则退回此方案并反向删除 DTP/RSDS 的传递——作为 fallback 记录在案。

## Consequences

- ADSO/PC 的激活请求开始携带 `corrNr` query（行为变化）。DTP/RSDS 先例表明未知 query 参数会被服务端接受，但**此判断对 ADSO/PC 仍待真机复核**，见 [VERIFIED_APIS](../../../../docs/VERIFIED_APIS.md) 中标注的待验证条目；公共签名不变（参数本就声明）。
