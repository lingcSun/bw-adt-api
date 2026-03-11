# 核心对象全流程验证任务

## 任务目标

对 BW 系统中的核心对象 (ADSO、InfoArea、DTP、Transformation) 进行端到端的全流程验证，确保 API 封装的完整性和正确性。

## 验证对象

1. **ADSO (Advanced DataStore Object)** - 高级数据存储对象
2. **InfoArea** - 信息区域
3. **DTP (Data Transfer Process)** - 数据传输流程
4. **Transformation** - 转换规则

---

## 1. ADSO 全流程验证

### 1.1 基础查询验证 ✅

- [x] **获取 ADSO 详情**
  - [ ] 验证 `getADSODetails()` 返回完整信息
  - [ ] 验证字段：name, technicalName, description, adsoType, status, infoArea
  - [ ] 验证不同 ADSO 类型的返回

- [x] **获取 ADSO 版本历史**
  - [ ] 验证 `getADSOVersions()` 返回版本列表
  - [ ] 验证版本标识：m=active, a=modified, d=revised
  - [ ] 验证版本元数据：created, user, description

- [ ] **获取 ADSO 配置**
  - [ ] 验证 `getADSOConfiguration()` 返回配置信息
  - [ ] 验证配置字段：semanticPartitioning, reportingEnabled, etc.

- [ ] **获取 ADSO 表名**
  - [ ] 验证 `getADSOTables()` 返回关联表信息
  - [ ] 验证表类型：AT=active table, AQ=inbound table, CL=changelog

### 1.2 对象操作验证

- [ ] **锁定/解锁操作**
  - [ ] 验证 `lockADSO()` 返回有效的 lockHandle
  - [ ] 验证锁定后无法重复锁定
  - [ ] 验证 `unlockADSO()` 释放锁定
  - [ ] 验证解锁后可以重新锁定

- [ ] **检查操作**
  - [ ] 验证 `checkADSO()` 返回检查结果
  - [ ] 验证检查结果中的 messages 数组
  - [ ] 验证错误场景下的错误信息

- [ ] **激活操作**
  - [ ] 验证 `activateADSO()` 激活成功
  - [ ] 验证带 lockHandle 的激活
  - [ ] 验证激活后对象状态变为 active

### 1.3 更新操作验证

- [ ] **更新 ADSO 元数据**
  - [ ] 验证 `updateADSO()` 更新描述信息
  - [ ] 验证更新时 lockHandle 的有效性验证
  - [ ] 验证更新后版本变为 modified (A)
  - [ ] 验证 timestamp header 的处理

### 1.4 Validation 功能验证 ✅

- [x] **验证 InfoArea 存在**
  - [x] 验证 `validateInfoArea()` 返回正确结果
  - [ ] 验证不存在的 InfoArea 返回 valid=false

- [x] **验证模板 ADSO 存在**
  - [x] 验证 `validateTemplateADSO()` 返回正确结果
  - [ ] 验证不存在的模板返回 valid=false

- [x] **验证新 ADSO 名称可用**
  - [x] 验证 `validateNewADSOName()` 返回正确结果
  - [ ] 验证已存在名称返回 valid=false
  - [ ] 验证无效名称格式的处理

- [ ] **新增 Validation 方法**
  - [ ] 验证 `validateADSOExists()` 检查对象存在性
  - [ ] 验证 `validateADSONewName()` 检查新名称
  - [ ] 验证 `validateADSOCanDelete()` 检查可删除性
  - [ ] 验证 `validateADSOCanActivate()` 检查可激活性

### 1.5 创建流程验证 ✅

- [x] **模板类型验证**
  - [ ] 支持以 DataSource 为模板 (type: "DSO")
  - [ ] 支持以 InfoProvider 为模板 (type: "ADSO")
  - [ ] 支持以 InfoObject 为模板 (type: "IOBJ")
  - [ ] 支持以 InfoSource 为模板 (type: "ISRC")
  - [ ] 支持空白创建 (无模板)

- [x] **创建流程验证**
  - [ ] 验证完整的创建流程：验证 → 锁定 → 创建 → 解锁
  - [ ] 验证 autoActivate 选项
  - [ ] 验证创建失败时的错误处理

### 1.6 节点路径验证

- [ ] **获取 ADSO 节点路径**
  - [ ] 验证 `getADSONodePath()` 返回层级结构
  - [ ] 验证路径节点类型和名称

### 1.7 泛型基类验证

- [ ] **BWObject<ADSO> 验证**
  - [ ] 验证 `new BWObject(client, BWObjectType.ADSO, name)`
  - [ ] 验证所有继承的方法：lock, unlock, activate, check, getVersions
  - [ ] 验证所有 Validation 方法：exists, isNewNameAvailable, canDelete, canActivate

---

## 2. InfoArea 全流程验证

### 2.1 基础查询验证

- [ ] **获取 InfoArea 结构**
  - [ ] 验证 `infoProviderStructure()` 返回根 InfoArea 列表
  - [ ] 验证 InfoArea 节点信息：name, type, description

- [ ] **获取 InfoArea 下的 ADSO 列表**
  - [ ] 验证 `infoAreaADSOs()` 返回 ADSO 列表
  - [ ] 验证 ADSO 节点信息：name, type, techName, uri

### 2.2 Validation 功能验证

- [ ] **验证 InfoArea 存在**
  - [ ] 验证使用通用验证接口验证 InfoArea
  - [ ] 验证不存在的 InfoArea 返回错误
  - [ ] 验证大小写敏感性

### 2.3 泛型基类验证

- [ ] **BWObject<INFO_AREA> 验证**
  - [ ] 验证 `new BWObject(client, BWObjectType.INFO_AREA, name)`
  - [ ] 验证所有继承的方法和 Validation 方法

---

## 3. DTP 全流程验证

### 3.1 基础查询验证

- [x] **获取 DTP 详情**
  - [ ] 验证 `getDTPDetails()` 返回完整信息
  - [ ] 验证字段：name, source, target, dtpType, status, deltaRequest, realTimeLoad
  - [ ] 验证不同 DTP 类型的返回 (LOAD vs EXECUTE)

- [x] **获取 DTP 版本历史**
  - [ ] 验证 `getDTPVersions()` 返回版本列表
  - [ ] 验证版本标识和元数据

### 3.2 对象操作验证

- [ ] **锁定/解锁操作**
  - [ ] 验证 `lockDTP()` 返回有效的 lockHandle
  - [ ] 验证 `unlockDTP()` 释放锁定

- [ ] **检查操作**
  - [ ] 验证 `checkDTP()` 返回检查结果

- [ ] **激活操作**
  - [ ] 验证 `activateDTP()` 激活成功
  - [ ] 验证 corrNr 参数传递

### 3.3 执行操作验证

- [ ] **执行 DTP**
  - [ ] 验证 `executeDTP()` 触发数据加载
  - [ ] 验证返回执行结果：requestID, message, recordsProcessed

### 3.4 Validation 功能验证

- [ ] **新增 Validation 方法**
  - [ ] 验证 `validateDTPExists()` 检查对象存在性
  - [ ] 验证 `validateDTPNewName()` 检查新名称
  - [ ] 验证 `validateDTPCanDelete()` 检查可删除性
  - [ ] 验证 `validateDTPCanActivate()` 检查可激活性

### 3.5 泛型基类验证

- [ ] **BWObject<DTP> 验证**
  - [ ] 验证 `new BWObject(client, BWObjectType.DTP, name)`
  - [ ] 验证所有继承的方法和 Validation 方法

---

## 4. Transformation 全流程验证

### 4.1 基础查询验证

- [x] **获取 Transformation 详情**
  - [ ] 验证 `getTransformationDetails()` 返回完整信息
  - [ ] 验证字段：name, source, target, sourceType, targetType, ruleCount, status
  - [ ] 验证 forceCacheUpdate 选项

- [x] **获取 Transformation 版本历史**
  - [ ] 验证 `getTransformationVersions()` 返回版本列表

### 4.2 对象操作验证

- [ ] **锁定/解锁操作**
  - [ ] 验证 `lockTransformation()` 返回有效的 lockHandle
  - [ ] 验证 `unlockTransformation()` 释放锁定

- [ ] **检查操作**
  - [ ] 验证 `checkTransformation()` 返回检查结果

- [ ] **激活操作**
  - [ ] 验证 `activateTransformation()` 激活成功

### 4.3 更新操作验证

- [ ] **更新 Transformation**
  - [ ] 验证 `updateTransformation()` 更新转换规则
  - [ ] 验证 lockHandle 和 corrNr 参数
  - [ ] 验证 timestamp header 的处理
  - [ ] 验证更新后版本变化

### 4.4 ABAP 类关联验证

- [ ] **获取 Transformation 关联的 ABAP 类**
  - [ ] 验证 `getTransformationClass()` 获取类元数据
  - [ ] 验证 `getTransformationClassSource()` 获取源代码
  - [ ] 验证 `extractAbapClassName()` 正确提取类名

- [ ] **更新 Transformation ABAP 类**
  - [ ] 验证 `updateTransformationClassSource()` 更新源代码
  - [ ] 验证类锁定/解锁：`lockTransformationClass()` / `unlockTransformationClass()`

### 4.5 运行时模式切换验证

- [ ] **切换运行时模式**
  - [ ] 验证 `switchTransformationRuntime()` 切换 HANA/ABAP 运行时
  - [ ] 验证 HANARuntime 属性正确更新
  - [ ] 验证切换后的转换仍然可用

### 4.6 Validation 功能验证

- [ ] **新增 Validation 方法**
  - [ ] 验证 `validateTransformationExists()` 检查对象存在性
  - [ ] 验证 `validateTransformationNewName()` 检查新名称
  - [ ] 验证 `validateTransformationCanDelete()` 检查可删除性
  - [ ] 验证 `validateTransformationCanActivate()` 检查可激活性

### 4.7 Transformation Routine 验证

- [ ] **Routine 信息提取**
  - [ ] 验证 `parseTransformationSettings()` 提取 routine 设置
  - [ ] 验证 `hasStartRoutine()`, `hasEndRoutine()`, `hasExpertRoutine()` 检测 routine
  - [ ] 验证 `extractAbapClassName()` 和 `extractRoutineMethodName()` 提取类/方法名

### 4.8 泛型基类验证

- [ ] **BWObject<TRANSFORMATION> 验证**
  - [ ] 验证 `new BWObject(client, BWObjectType.TRANSFORMATION, name)`
  - [ ] 验证所有继承的方法和 Validation 方法

---

## 5. 通用功能验证

### 5.1 泛型基类 BWObject<T> 验证

- [ ] **对象类型映射**
  - [ ] 验证所有 BWObjectType 枚举值正确映射
  - [ ] 验证 endpoint 和 contentType 配置正确

- [ ] **URI 构建**
  - [ ] 验证 `buildUri()` 正确构建对象 URI
  - [ ] 验证版本后缀处理 (versionSuffix 配置)
  - [ ] 验证对象名称转小写处理

- [ ] **通用操作一致性**
  - [ ] 验证所有对象类型的 lock/unlock 行为一致
  - [ ] 验证所有对象类型的 activate/check 行为一致
  - [ ] 验证所有对象类型的 getVersions 行为一致

### 5.2 Validation 通用功能验证

- [ ] **ValidationAction 枚举**
  - [ ] 验证 EXISTS, NEW, DELETE, ACTIVATE 四种动作类型

- [ ] **validateObject() 通用函数**
  - [ ] 验证对不同对象类型的调用
  - [ ] 验证不同 action 参数的处理
  - [ ] 验证响应解析正确性

### 5.3 BWAdtClient 验证

- [ ] **bwObject() 方法**
  - [ ] 验证返回的 BWObject 实例可用
  - [ ] 验证对象类型字符串映射正确

- [ ] **通用验证方法**
  - [ ] 验证 `validateObjectExists()` 适用于所有对象类型
  - [ ] 验证 `validateNewObjectName()` 适用于所有对象类型

### 5.4 类型定义验证

- [ ] **types.ts 统一类型**
  - [ ] 验证所有 Details 类型定义完整
  - [ ] 验证没有重复类型定义冲突
  - [ ] 验证导出/导入正确

---

## 6. 集成测试场景

### 6.1 ADSO 完整生命周期

```
1. 验证 InfoArea 存在
2. 验证新 ADSO 名称可用
3. 创建 ADSO (以模板创建)
4. 获取 ADSO 详情验证创建成功
5. 锁定 ADSO
6. 检查 ADSO 一致性
7. 激活 ADSO
8. 解锁 ADSO
9. 获取 ADSO 版本历史
10. 验证 ADSO 存在
```

### 6.2 Transformation 完整生命周期

```
1. 验证 Transformation 存在
2. 获取 Transformation 详情
3. 获取 Transformation 版本历史
4. 锁定 Transformation
5. 检查 Transformation 一致性
6. 获取关联的 ABAP 类信息
7. 更新 Transformation (如需要)
8. 激活 Transformation
9. 解锁 Transformation
```

### 6.3 DTP 完整生命周期

```
1. 验证 DTP 存在
2. 获取 DTP 详情
3. 获取 DTP 版本历史
4. 锁定 DTP
5. 检查 DTP 一致性
6. 激活 DTP
7. 执行 DTP
8. 解锁 DTP
```

### 6.4 跨对象关联验证

```
1. 创建/使用 InfoArea
2. 在 InfoArea 下创建 ADSO
3. 为 ADSO 创建 Transformation
4. 为 ADSO 创建 DTP
5. 验证完整的对象链路
```

---

## 7. 错误场景验证

### 7.1 对象不存在场景

- [ ] 获取不存在的 ADSO
- [ ] 锁定不存在的 Transformation
- [ ] 激活不存在的 DTP

### 7.2 权限和锁定场景

- [ ] 重复锁定同一对象
- [ ] 解锁未锁定的对象
- [ ] 无 lockHandle 激活对象

### 7.3 数据验证场景

- [ ] 无效的名称格式
- [ ] 冲突的对象名称
- [ ] 不一致的元数据

### 7.4 并发场景

- [ ] 同时锁定同一对象
- [ ] 修改冲突处理

---

## 8. 测试数据准备

### 8.1 创建测试对象

- [ ] 准备测试用 InfoArea (如：ZTEST_AREA)
- [ ] 准备测试用 ADSO (如：ZTEST_ADSO)
- [ ] 准备测试用 Transformation
- [ ] 准备测试用 DTP

### 8.2 测试数据清理

- [ ] 测试完成后清理创建的测试对象
- [ ] 确保不影响生产数据

---

## 9. 验证标准

### 9.1 功能正确性

- [ ] 所有 API 调用返回预期结果
- [ ] 错误场景返回适当的错误信息
- [ ] 数据一致性得到保证

### 9.2 类型安全性

- [ ] TypeScript 编译无错误
- [ ] 类型定义完整且准确
- [ ] 运行时类型验证正确

### 9.3 API 完整性

- [ ] 所有规划的功能已实现
- [ ] 文档与实现一致
- [ ] 示例代码可运行

### 9.4 向后兼容性

- [ ] 现有 API 调用不受影响
- [ ] 新功能通过新方法或参数提供
- [ ] 不破坏现有代码

---

## 10. 进度跟踪

| 对象 | 基础查询 | 对象操作 | Validation | 创建/更新 | 泛型基类 | 集成测试 |
|------|----------|----------|------------|-----------|----------|----------|
| ADSO | 🟡 | 🟡 | ✅ | ✅ | 🟡 | 🔲 |
| InfoArea | 🟡 | - | 🔲 | - | 🟡 | 🔲 |
| DTP | 🟡 | 🟡 | 🟡 | - | 🟡 | 🔲 |
| Transformation | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 | 🔲 |

**图例**: ✅ 已完成 | 🟡 部分完成 | 🔲 待完成

---

## 11. 下一步行动

1. **优先级 1**: 完成 ADSO 的泛型基类验证和集成测试
2. **优先级 2**: 完成 DTP 和 Transformation 的完整验证
3. **优先级 3**: 完成 InfoArea 相关功能验证
4. **优先级 4**: 编写集成测试脚本
5. **优先级 5**: 整理验证结果和问题列表

---

## 12. 问题跟踪

### 已发现问题

- [ ] 无

### 待解决问题

- [ ] 无

### 已解决问题

- [x] 重复类型定义冲突 - 通过 types.ts 统一解决
- [x] BWObjectType 命名冲突 - 通过重命名 search.ts 中的类型解决
