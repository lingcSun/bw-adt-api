import * as t from "io-ts"
import { orUndefined } from "../utilities"

// ============================================================================
// Re-export Common Types
// ============================================================================

export type { LockResult, ActivationResult, ObjectVersion } from "./common"
export { ValidationAction, ValidationResult } from "./common"

// ============================================================================
// ADSO Details
// ============================================================================

/**
 * ADSO Details - ADSO 详细信息
 */
export const ADSODetails = t.type({
  name: t.string,
  technicalName: t.string,
  description: orUndefined(t.string),
  objVers: orUndefined(t.string),
  adsoType: orUndefined(t.string),
  status: orUndefined(t.string),
  infoArea: orUndefined(t.string),
  isRealTime: orUndefined(t.boolean),
  partitioning: orUndefined(t.string),
  activationStatus: orUndefined(t.string)
})

export type ADSODetails = t.OutputOf<typeof ADSODetails>

// ============================================================================
// Transformation Details
// ============================================================================

/**
 * Transformation Details - 转换详细信息
 */
export const TransformationDetails = t.type({
  name: t.string,
  technicalName: t.string,
  description: orUndefined(t.string),
  objVers: orUndefined(t.string),
  source: orUndefined(t.string),
  target: orUndefined(t.string),
  sourceType: orUndefined(t.string),
  targetType: orUndefined(t.string),
  ruleCount: orUndefined(t.number),
  status: orUndefined(t.string)
})

export type TransformationDetails = t.OutputOf<typeof TransformationDetails>

// ============================================================================
// DTP Details
// ============================================================================

/**
 * DTP Details - DTP 详细信息
 */
export const DTPDetails = t.type({
  name: t.string,
  technicalName: t.string,
  source: t.string,
  target: t.string,
  description: orUndefined(t.string),
  objVers: orUndefined(t.string),
  sourceType: orUndefined(t.string),
  targetType: orUndefined(t.string),
  dtpType: orUndefined(t.string),
  status: orUndefined(t.string),
  deltaRequest: orUndefined(t.boolean),
  realTimeLoad: orUndefined(t.boolean)
})

export type DTPDetails = t.OutputOf<typeof DTPDetails>

// ============================================================================
// Process Chain Details
// ============================================================================

/**
 * Process Chain Step - 流程链步骤
 */
export const ProcessChainStep = t.type({
  stepId: t.string,
  stepType: t.string,
  description: orUndefined(t.string),
  status: orUndefined(t.string),
  source: orUndefined(t.string),
  target: orUndefined(t.string)
})

export type ProcessChainStep = t.OutputOf<typeof ProcessChainStep>

/**
 * Process Chain Details - 流程链详细信息
 */
export const ProcessChainDetails = t.type({
  name: t.string,
  technicalName: t.string,
  description: orUndefined(t.string),
  objVers: orUndefined(t.string),
  chainType: orUndefined(t.string),
  status: orUndefined(t.string),
  steps: orUndefined(t.array(ProcessChainStep)),
  created: orUndefined(t.string),
  changed: orUndefined(t.string),
  changedBy: orUndefined(t.string)
})

export type ProcessChainDetails = t.OutputOf<typeof ProcessChainDetails>

// ============================================================================
// InfoObject Details
// ============================================================================

/**
 * InfoObject Text - InfoObject 文本描述
 */
export const InfoObjectText = t.type({
  language: orUndefined(t.string),
  shortText: orUndefined(t.string),
  longText: orUndefined(t.string)
})

export type InfoObjectText = t.OutputOf<typeof InfoObjectText>

/**
 * InfoObject TLogo Properties - InfoObject 技术属性
 */
export const InfoObjectTLogoProperties = t.type({
  name: orUndefined(t.string),
  type: orUndefined(t.string),
  description: orUndefined(t.string),
  responsible: orUndefined(t.string),
  masterLanguage: orUndefined(t.string),
  masterSystem: orUndefined(t.string),
  changedAt: orUndefined(t.string),
  changedBy: orUndefined(t.string),
  createdAt: orUndefined(t.string),
  createdBy: orUndefined(t.string),
  language: orUndefined(t.string),
  infoArea: orUndefined(t.string),
  objectVersion: orUndefined(t.string),
  objectStatus: orUndefined(t.string),
  contentState: orUndefined(t.string),
  package: orUndefined(t.string)
})

export type InfoObjectTLogoProperties = t.OutputOf<typeof InfoObjectTLogoProperties>

/**
 * InfoObject Details - InfoObject 详细信息
 */
export const InfoObjectDetails = t.type({
  name: t.string,
  technicalName: t.string,
  description: orUndefined(t.string),
  infoObjectType: orUndefined(t.string),
  dataType: orUndefined(t.string),
  length: orUndefined(t.number),
  decimals: orUndefined(t.number),
  shortDescription: orUndefined(t.string),
  longDescription: orUndefined(t.string),
  attributeOnly: orUndefined(t.boolean),
  outputLength: orUndefined(t.number),
  fieldName: orUndefined(t.string),
  dataElement: orUndefined(t.string),
  infoArea: orUndefined(t.string),
  objectVersion: orUndefined(t.string),
  objectStatus: orUndefined(t.string),
  texts: orUndefined(t.array(InfoObjectText)),
  tlogoProperties: orUndefined(InfoObjectTLogoProperties),
  sidTable: orUndefined(t.string),
  textTable: orUndefined(t.string),
  masterDataTable: orUndefined(t.string),
  attributeSIDTable: orUndefined(t.string)
})

export type InfoObjectDetails = t.OutputOf<typeof InfoObjectDetails>

// ============================================================================
// DataSource (RSDS)
// ============================================================================

/**
 * DataSource Details - DataSource (RSDS) 详细信息
 *
 * 对应请求: GET /sap/bw/modeling/rsds/{datasource}/{sourceSystem}/m
 * 根节点: <rsds:dataSource name="..." sourceSystemName="..." type="..." .../>
 *
 * 注意 RSDS 是双段标识 (datasource + sourceSystem), 与 ADSO/DTP 的单段 id 不同。
 */
export const DataSourceDetails = t.type({
  name: t.string,
  technicalName: t.string,
  description: orUndefined(t.string),
  /** DataSource 类型 (如 "D") */
  type: orUndefined(t.string),
  /** 源系统 (逻辑系统名, 如 "S4DCLNT300") */
  sourceSystem: orUndefined(t.string),
  /** 对象版本 (M=Active, A=Modified, D=Revised) */
  objectVersion: orUndefined(t.string),
  /** 对象状态 (active/inactive) */
  objectStatus: orUndefined(t.string),
  /** 应用组件 (如 "FI") */
  applicationComponent: orUndefined(t.string),
  /** 抽取适配器类型 (如 "ODP") */
  adapterType: orUndefined(t.string)
})

export type DataSourceDetails = t.OutputOf<typeof DataSourceDetails>

/**
 * DataSource Field - DataSource 字段 (位于 <segment>/<field>)
 */
export const DataSourceField = t.type({
  name: t.string,
  dataType: orUndefined(t.string),    // CHAR/NUMC/DATS/DEC...
  length: orUndefined(t.number),
  label: orUndefined(t.string),
  position: orUndefined(t.number),
  transfer: orUndefined(t.boolean)
})

export type DataSourceField = t.OutputOf<typeof DataSourceField>

/**
 * DataSource Version - DataSource 版本信息
 *
 * 与通用 ObjectVersion 形状一致, 单独命名以匹配 RSDS 语义。
 * 版本字符从 <atom:id>A</atom:id> 提取 (RSDS 特有, 非 uri 后缀)。
 */
export const DataSourceVersion = t.type({
  version: t.string,           // m=Active, a=Modified, d=Revised
  uri: t.string,
  created: orUndefined(t.string),
  user: orUndefined(t.string),
  description: orUndefined(t.string)
})

export type DataSourceVersion = t.OutputOf<typeof DataSourceVersion>

// ============================================================================
// DataSource Replication
// ============================================================================

/**
 * Replication Task - 数据源复制任务 (GET 预检返回的单个任务)
 *
 * 对应 XML: <dsReplication:replicationTask datasource="..." tlogo="RSDS" .../>
 */
export const ReplicationTask = t.type({
  datasource: t.string,
  tlogo: orUndefined(t.string),          // 通常 "RSDS"
  externalObject: orUndefined(t.string), // 外部对象名
  externalObjectDescription: orUndefined(t.string),
  description: orUndefined(t.string),
  /** 操作类型 (UEQ=Update if Equal) */
  operation: orUndefined(t.string),
  execute: orUndefined(t.boolean),
  /** 复制后对象的 URI (如 /sap/bw/modeling/rsds/{ds}/{src}/m) */
  uri: orUndefined(t.string)
})

export type ReplicationTask = t.OutputOf<typeof ReplicationTask>

/**
 * Replication Result - 复制触发结果 (POST 返回的后台 job 信息)
 *
 * 对应 XML: <dataContainer><simpleParams jobCount="..."/><simpleParams jobName="..."/></dataContainer>
 */
export const ReplicationResult = t.type({
  /** 后台 job 名 (如 "RSDS_REPLICATION") */
  jobName: orUndefined(t.string),
  /** 后台 job 计数 (如 "09172600") */
  jobCount: orUndefined(t.string)
})

export type ReplicationResult = t.OutputOf<typeof ReplicationResult>

// ============================================================================
// Generic Object Details
// ============================================================================

/**
 * Generic BW Object Details - 通用 BW 对象详细信息
 * 适用于所有对象类型的通用字段
 */
export const BWObjectDetails = t.type({
  name: t.string,
  technicalName: t.string,
  description: orUndefined(t.string),
  objVers: orUndefined(t.string),
  status: orUndefined(t.string)
})

export type BWObjectDetails = t.OutputOf<typeof BWObjectDetails>
