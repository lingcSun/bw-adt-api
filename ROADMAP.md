# BW-ADT-API 实现路线图

根据 `/sap/bw/modeling/discovery` 端点返回的系统能力，规划功能实现优先级。

## ✅ 已完成模块

| 模块 | 端点 | 文件 | 状态 |
|------|------|------|------|
| **通用 BW 对象基类** | - | `bwObject.ts`, `common.ts`, `types.ts` | ✅ 泛型基类 + Validation |
| ADSO | `/sap/bw/modeling/adso` | `adso.ts` | ✅ 完整 CRUD + 激活 + Validation |
| DTP | `/sap/bw/modeling/dtpa` | `dtp.ts` | ✅ + Validation |
| Transformation | `/sap/bw/modeling/trfn` | `transformation.ts` | ✅ 完整 CRUD + 激活 + Validation |
| InfoObject | `/sap/bw/modeling/iobj` | `infoobject.ts` | ✅ 读取 + 元数据 + Validation |
| Process Chain | `/sap/bw/modeling/pc` | `processchain.ts` | ✅ + Validation |
| InfoProvider | `/sap/bw/modeling/repo/infoproviderstructure` | `infoprovider.ts` | ✅ |
| System Info | `/sap/bw/modeling/repo/is/systeminfo` | `systemInfo.ts` | ✅ |
| Search | `/sap/bw/modeling/repo/is/bwsearch` | `search.ts` | ✅ |
| DDIC Tables | `/sap/bc/adt/ddic/tables/*` | `ddic.ts` | ✅ |
| ABAP Class | `/sap/bc/adt/programs/programs/*` | `abapClass.ts` | ✅ |

### 最新更新 (2026-03-11)
- **BW 对象操作抽象重构**:
  - 新增泛型基类 `BWObject<T>` 统一所有 BW 对象操作
  - 统一类型定义在 `types.ts`
  - 通用 Validation 功能 (exists, newName, delete, activate)
  - 所有对象类型支持相同的操作接口
- **Validation API**: 所有对象类型 (ADSO, Transformation, DTP, ProcessChain, InfoObject) 现在支持验证操作
- **代码复用**: Lock/Unlock/Activate/Check/GetVersions 只需实现一次
- **向后兼容**: 现有 API 函数保持不变

### 架构说明

#### 三层架构
1. **通用层** (`common.ts`, `bwObject.ts`, `types.ts`)
   - 通用类型定义 (LockResult, ActivationResult, ValidationResult, etc.)
   - 泛型基类 BWObject<T> 提供统一操作接口
   - 通用 API 函数 (activateObject, validateObject, etc.)

2. **API 层** (`src/api/*.ts`)
   - 按功能模块分文件：adso, transformation, dtp, processchain, infoobject, etc.
   - 每个模块使用泛型基类实现通用操作
   - 保留模块特有的功能

3. **客户端层** (`BWAdtClient.ts`)
   - 提供便捷方法访问所有 API
   - 支持 `bwObject()` 方法获取泛型对象实例

#### 支持的通用操作
所有 BW 对象类型 (ADSO, Transformation, DTP, ProcessChain, InfoObject) 都支持：
- `lock()` / `unlock()`
- `activate()` / `check()`
- `getVersions()`
- `exists()` / `isNewNameAvailable()` / `canDelete()` / `canActivate()`

## 🔜 高优先级（核心 BW 对象）

| 模块 | 端点 | 描述 | 优先级 |
|------|------|------|--------|
| **核心对象验证** | - | ADSO/InfoArea/DTP/Transformation 全流程验证 | **P0** 🔥 |
| **Query** | `/sap/bw/modeling/query` | BW 查询设计器、查询执行、变量管理 | P1 |
| **DataSource** | `/sap/bw/modeling/repo/datasourcestructure` | 数据源结构查询、源系统数据源 | P1 |
| **InfoArea** | `/sap/bw/modeling/area` | InfoArea 管理 | P1 |
| **Open Hub** | `/sap/bw/modeling/dest` | Open Hub Destination（数据分发） | P2 |
| **InfoObject CRUD** | `/sap/bw/modeling/iobj` | InfoObject 创建/更新/删除（当前仅读取） | P2 |

## 📋 中优先级（高级功能）

| 模块 | 端点 | 描述 | 优先级 |
|------|------|------|--------|
| **CompositeProvider** | `/sap/bw/modeling/hcpr` | 复合提供者 | P2 |
| **Open ODS View** | `/sap/bw/modeling/odso` | 开放式操作型数据存储视图 | P2 |
| **DataSource Nodes** | `/sap/bw/modeling/repo` | DataSource 节点操作 | P2 |
| **Source System** | `/sap/bw/modeling/lsys` | 源系统管理 | P2 |
| **Planning** | `/sap/bw/modeling/plse`, `/sap/bw/modeling/plst` | 计划序列、计划服务 | P2 |

## 🔧 辅助功能

| 模块 | 端点 | 描述 | 优先级 |
|------|------|------|--------|
| **Jobs** | `/sap/bw/modeling/jobs` | 作业服务（读取、管理后台作业） | P3 |
| **Transport** | `/sap/bw/modeling/move_requests` | 传输请求管理 | P3 |
| **Validation** | `/sap/bw/modeling/validation` | 验证规则 | P3 |
| **Formula** | `/sap/bw/modeling/trfn/formula/tokens` | 转换公式 tokens | P3 |

## 📊 按业务场景分组

### 数据加载流程
- ✅ ADSO (目标)
- ✅ DTP (数据传输)
- ✅ Transformation (转换规则)
- 🔜 DataSource (数据源)
- 🔜 Source System (源系统)

### 数据查询与分析
- 🔜 Query (查询)
- ✅ InfoObject (信息对象 - 读取功能)
- ✅ InfoProvider (提供者结构)
- 🔜 Variable (变量)

### 数据建模
- 🔜 CompositeProvider (复合提供者)
- 🔜 Open ODS View (开放 ODS 视图)
- ✅ Process Chain (流程链)

### 数据分发
- 🔜 Open Hub Destination

## 实现建议顺序

1. **Query** - 最常用的数据查询接口
2. **InfoObject** - 基础信息对象管理
3. **DataSource** - 数据加载的起点
4. **CompositeProvider** - 现代数据建模核心
5. **Open ODS View** - 虚拟数据层
6. **Planning** - 计划功能

## 需要的 Communication Logs

要实现上述模块，需要收集对应的 Communication Log：
- `sapbwmodelingquery*` - Query 操作
- `sapbwmodelingiobj*` - InfoObject 操作
- `sapbwmodelingrepodatasourcestructure*` - DataSource 结构
- `sapbwmodelinghcpr*` - CompositeProvider
- 等等...

---

## 📋 任务跟踪

详细的验证任务请参阅：**[tasks/CORE_OBJECTS_VERIFICATION.md](tasks/CORE_OBJECTS_VERIFICATION.md)**

当前重点：核心对象 (ADSO、InfoArea、DTP、Transformation) 的全流程验证
