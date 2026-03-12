# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个用于访问 SAP BW/4HANA ADT (ABAP Developer Tools) REST API 的 TypeScript 库。所有 API 端点都基于 SAP BW Communication Log 实际追踪结果实现。

---

## 项目初衷

**核心目标：通过 API 调用实现 SAP BW 开发自动化**

本项目旨在提供一套完整的 TypeScript API，使开发者能够通过编程方式完成 SAP BW/4HANA 中的常见开发任务，而非通过 GUI (如 SAP GUI 或 Eclipse ADT) 手动操作。

### 开发原则

在添加新功能时，必须确认符合以下原则：

#### ✅ 应该实现（核心开发 API）
- **对象操作**：创建、修改、删除、激活 BW 对象（ADSO、DTP、Transformation、ProcessChain 等）
- **数据操作**：执行 DTP、加载和转换数据
- **查询检索**：获取对象详情、字段结构、关联关系
- **搜索功能**：按名称、类型、条件搜索对象
- **批量操作**：批量处理多个对象
- **监控功能**：查看执行状态、日志

#### ⚠️ 已知不支持（服务端限制）
- **Transformation 创建**：TRFN 创建依赖 SAP JCo (Java Connector) 的特殊机制，包括：
  - **ModalContext 执行上下文**：Eclipse ADT 在特殊的执行上下文中执行创建操作
  - **JCoEnqueueSystemSession**：使用 "stateful,enqueue" 会话模式进行对象锁定
  - **跨会话 lockHandle 绑定**：lockHandle 在不同会话类型间的状态由 JCo 维护
  - 纯 HTTP/REST 客户端无法模拟这些 JCo 特性，因此无法通过 API 创建 TRFN

  **支持的操作**：read（读取详情、字段映射）、update（修改内容）、activate（激活）、delete（删除）、lock/unlock（锁定/解锁）、check（检查一致性）、getVersions（版本历史）

  **替代方案**：使用 SAP GUI 手动创建，或使用 ABAP 程序批量创建。创建后可使用本 API 进行其他所有操作。

#### ❌ 不应该实现（UI 导航 API）
- **树形结构**：`/sap/bw/modeling/repo/infoproviderstructure` - ADT 显示导航树用
- **节点路径**：`/sap/bw/modeling/repo/nodepath` - 定位对象在树中的位置
- **区域浏览**：按 InfoArea 层级浏览对象

> **理由**：这些 API 是为 UI 导航设计的，API 开发时用搜索功能更高效。

### 功能偏离检查清单

添加新功能前，问自己：

1. **这个 API 是用于实际 BW 开发操作，还是 UI 展示？**
2. **如果只有对象名称，能否通过搜索 API 替代树形导航？**
3. **这个功能是否会被自动化脚本或 CI/CD 流程使用？**

### 替代方案

| UI 导航 API | 替代方案 |
|------------|---------|
| `infoProviderStructure()` | `searchBWObjects()` |
| `infoAreaADSOs()` | `searchBWObjects({ objectType: "ADSO" })` |
| `adsoTransformations()` | `searchBWObjects({ objectType: "TRFN" })` + 过滤 |
| `getADSONodePath()` | 已知对象名，无需路径 |

## 构建命令

- `npm run build` - 编译 TypeScript 到 `build/` 目录
- `npm run watch` - 监听模式编译
- `npm test` - 运行 Jest 测试
- `npm run prepublishOnly` - 发布前编译

## 测试

测试需要真实的 SAP BW 系统连接。复制 `.env.example` 到 `.env` 并配置：

```
BW_BASE_URL=http://your-bw-server:8000
BW_USERNAME=your-username
BW_PASSWORD=your-password
BW_CLIENT=100
BW_LANGUAGE=EN
```

运行特定测试文件：`npm test -- --testPathPattern=login`

## 架构概览

### 三层架构

1. **HTTP 层** (`AdtHTTP.ts`, `AxiosHttpClient.ts`)
   - 处理认证、CSRF token、cookies、会话管理
   - 支持 stateful/stateless 会话模式
   - 自动登录重试逻辑

2. **API 层** (`src/api/*.ts`)
   - 按功能模块分文件：`adso.ts`, `dtp.ts`, `transformation.ts`, `processchain.ts`, `ddic.ts`, `infoobject.ts`, `search.ts`, `systemInfo.ts`, `common.ts`, `abapClass.ts`, `repository.ts`
   - 每个模块导出类型定义（使用 `io-ts`）和 API 函数
   - 使用 `fullParse` 和 XML 工具函数解析响应
   - **注意**：只包含核心开发 API，不包含 UI 导航相关 API

3. **客户端层** (`BWAdtClient.ts`)
   - 主要入口类，暴露所有 BW 操作方法
   - 使用动态 import 延迟加载 API 模块
   - 管理 AdtHTTP 实例和会话状态

### 关键模式

- **XML 解析**：SAP ADT 返回 ATOM Feed 格式 XML，使用 `utilities.ts` 中的工具函数解析
- **类型验证**：使用 `io-ts` 进行运行时类型检查和验证
- **锁定-激活-解锁模式**：修改对象前需 lock，完成后 unlock
- **版本标识**：m=active, a=modified, d=revised

### 添加新 API 模块

1. 在 `src/api/` 创建新文件，使用 io-ts 定义类型
2. 导出 API 函数，签名为 `(client: AdtHTTP, ...) => Promise<T>`
3. 在 `src/api/index.ts` 中导出
4. 在 `BWAdtClient.ts` 中添加便捷方法，使用动态 import
5. 在 `src/__tests__/` 添加对应测试文件

## 环境变量

测试使用 `dotenv` 加载环境变量（见 `jest.setup.js`）。
