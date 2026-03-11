# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个用于访问 SAP BW/4HANA ADT (ABAP Developer Tools) REST API 的 TypeScript 库。所有 API 端点都基于 SAP BW Communication Log 实际追踪结果实现。

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
   - 按功能模块分文件：`adso.ts`, `dtp.ts`, `transformation.ts`, `processchain.ts`, `ddic.ts`, `infoprovider.ts`, `search.ts`, `systemInfo.ts`, `common.ts`
   - 每个模块导出类型定义（使用 `io-ts`）和 API 函数
   - 使用 `fullParse` 和 XML 工具函数解析响应

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
