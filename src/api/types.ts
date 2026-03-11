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
