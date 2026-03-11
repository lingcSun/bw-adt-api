# BW-ADT-API 实现路线图

根据 `/sap/bw/modeling/discovery` 端点返回的系统能力，规划功能实现优先级。

## ✅ 已完成模块

| 模块 | 端点 | 文件 | 状态 |
|------|------|------|------|
| ADSO | `/sap/bw/modeling/adso` | `adso.ts` | ✅ 完整 CRUD + 激活 |
| DTP | `/sap/bw/modeling/dtpa` | `dtp.ts` | ✅ |
| Transformation | `/sap/bw/modeling/trfn` | `transformation.ts` | ✅ 完整 CRUD + 激活 |
| InfoObject | `/sap/bw/modeling/iobj` | `infoobject.ts` | ✅ 读取 + 元数据 |
| Process Chain | `/sap/bw/modeling/rspc` | `processchain.ts` | ✅ |
| InfoProvider | `/sap/bw/modeling/repo/infoproviderstructure` | `infoprovider.ts` | ✅ |
| System Info | `/sap/bw/modeling/repo/is/systeminfo` | `systemInfo.ts` | ✅ |
| Search | `/sap/bw/modeling/repo/is/bwsearch` | `search.ts` | ✅ |
| DDIC Tables | `/sap/bc/adt/ddic/tables/*` | `ddic.ts` | ✅ |

### 最新更新 (2025-03-11)
- **InfoObject API**: 新增 getInfoObject() 和 getInfoObjectMetadata()
- **ADSO 更新**: updateADSO() 支持完整 XML 更新
- **Transformation 更新**: updateTransformation() 支持完整 XML 更新和 timestamp header

## 🔜 高优先级（核心 BW 对象）

| 模块 | 端点 | 描述 | 优先级 |
|------|------|------|--------|
| **Query** | `/sap/bw/modeling/query` | BW 查询设计器、查询执行、变量管理 | P0 |
| **DataSource** | `/sap/bw/modeling/repo/datasourcestructure` | 数据源结构查询、源系统数据源 | P0 |
| **InfoArea** | `/sap/bw/modeling/area` | InfoArea 管理 | P1 |
| **Open Hub** | `/sap/bw/modeling/dest` | Open Hub Destination（数据分发） | P1 |
| **InfoObject CRUD** | `/sap/bw/modeling/iobj` | InfoObject 创建/更新/删除（当前仅读取） | P1 |

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
