import * as t from "io-ts"
import { fullParse, xmlNodeAttr, xmlArray, xmlNode, orUndefined } from "../utilities"
import { AdtHTTP } from "../AdtHTTP"
import { ActivationResult, ActivationMessage, LockResult, activateObject, parseActivationResponse, parseLockResponse, parseObjectVersions, ValidationAction, ValidationResult } from "./common"
import { BWObject, BWObjectType } from "./bwObject"
import { ProcessChainDetails } from "./types"

// ============================================================================
// Types and Codecs for Process Chain (流程链)
// ============================================================================

// Re-export common types as ProcessChain-specific types for compatibility
export type ProcessChainLockResult = LockResult

// Re-export Validation types for convenience
export { ValidationAction, ValidationResult } from "./common"

/**
 * Process Chain Status - 流程链状态
 */
export enum ProcessChainStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  REVISED = "objectStatus:revised",
  EXISTING = "objectStatus:existing"
}

/**
 * Process Chain Type - 流程链类型
 */
export enum ProcessChainType {
  LOAD_CHAIN = "processChainType:load",
  EXECUTION_CHAIN = "processChainType:execution"
}

/**
 * Process Chain Metadata - 流程链元数据
 */
export const ProcessChainMetaData = t.type({
  name: t.string,
  description: orUndefined(t.string),
  objVers: orUndefined(t.string),  // M=Active, A=Modified, D=Revised
  chainType: orUndefined(t.string),
  status: orUndefined(t.string)
})

export type ProcessChainMetaData = t.OutputOf<typeof ProcessChainMetaData>

/**
 * Process Chain Step - 流程链步骤
 */
export const ProcessChainStep = t.type({
  stepId: t.string,
  stepType: t.string,          // 步骤类型：LOAD, EXECUTE, DELETE等
  description: orUndefined(t.string),
  status: orUndefined(t.string),
  source: orUndefined(t.string),
  target: orUndefined(t.string)
})

export type ProcessChainStep = t.OutputOf<typeof ProcessChainStep>

// ProcessChainDetails is now imported from types.ts to avoid duplication

/**
 * Process Chain Version - 流程链版本信息
 */
export const ProcessChainVersion = t.type({
  version: t.string,           // m=active, a=modified, d=revised
  uri: t.string,
  created: orUndefined(t.string),
  user: orUndefined(t.string),
  description: orUndefined(t.string)
})

export type ProcessChainVersion = t.OutputOf<typeof ProcessChainVersion>

/**
 * Process Chain Execution Result - 流程链执行结果
 */
export const ProcessChainExecutionResult = t.type({
  success: t.boolean,
  requestID: orUndefined(t.string),
  message: orUndefined(t.string),
  startTime: orUndefined(t.string),
  endTime: orUndefined(t.string),
  status: orUndefined(t.string)
})

export type ProcessChainExecutionResult = t.OutputOf<typeof ProcessChainExecutionResult>

/**
 * Process Chain Log Entry - 流程链日志条目
 */
export const ProcessChainLogEntry = t.type({
  chainName: t.string,
  stepName: orUndefined(t.string),
  timestamp: orUndefined(t.string),
  status: t.string,           // S=成功, E=错误, W=警告, R=运行中
  message: orUndefined(t.string),
  duration: orUndefined(t.number),
  recordsProcessed: orUndefined(t.number)
})

export type ProcessChainLogEntry = t.OutputOf<typeof ProcessChainLogEntry>

/**
 * Process Chain Status Info - 流程链运行状态信息
 */
export const ProcessChainStatusInfo = t.type({
  chainName: t.string,
  status: t.string,           // RUNNING, COMPLETED, FAILED, CANCELLED
  currentStep: orUndefined(t.string),
  totalSteps: orUndefined(t.number),
  completedSteps: orUndefined(t.number),
  startTime: orUndefined(t.string),
  endTime: orUndefined(t.string),
  message: orUndefined(t.string)
})

export type ProcessChainStatusInfo = t.OutputOf<typeof ProcessChainStatusInfo>

// ============================================================================
// API Functions
// ============================================================================

/**
 * Lock Process Chain - 锁定流程链
 *
 * 对应请求: POST /sap/bw/modeling/pc/{chain_id}?action=lock
 *
 * @param client - ADT HTTP 客户端
 * @param chainId - Process Chain ID
 * @returns 锁定结果（包含 lockHandle）
 */
export async function lockProcessChain(
  client: AdtHTTP,
  chainId: string
): Promise<ProcessChainLockResult> {
  const obj = new BWObject(client, BWObjectType.PROCESS_CHAIN, chainId)
  return obj.lock()
}

/**
 * Unlock Process Chain - 解锁流程链
 *
 * 对应请求: POST /sap/bw/modeling/pc/{chain_id}?action=unlock
 *
 * @param client - ADT HTTP 客户端
 * @param chainId - Process Chain ID
 */
export async function unlockProcessChain(
  client: AdtHTTP,
  chainId: string
): Promise<void> {
  const obj = new BWObject(client, BWObjectType.PROCESS_CHAIN, chainId)
  return obj.unlock()
}

/**
 * Get Process Chain Metadata - 获取流程链元数据
 *
 * 对应请求: GET /sap/bw/modeling/pc/{chain_id}/m
 *
 * @param client - ADT HTTP 客户端
 * @param chainId - Process Chain ID
 * @returns 流程链元数据
 */
export async function getProcessChain(
  client: AdtHTTP,
  chainId: string
): Promise<ProcessChainMetaData> {
  const response = await client.request(
    `/sap/bw/modeling/pc/${chainId}/m`,
    {
      headers: {
        "Accept": "application/vnd.sap.bw.modeling.pc-v1_0_0+xml"
      }
    }
  )

  return parseProcessChainMetaData(response.body)
}

/**
 * Parse Process Chain Metadata - 解析流程链元数据
 *
 * @param xmlBody - XML响应体
 * @returns 流程链元数据
 */
function parseProcessChainMetaData(xmlBody: string): ProcessChainMetaData {
  const parsed = fullParse(xmlBody)
  const root = parsed["bwModel:processChain"] || parsed

  return {
    name: root["bwModel:chainName"] || root["bwModel:name"] || root["name"] || "",
    description: root["bwModel:description"] || root["description"],
    objVers: root["bwModel:objVers"] || root["objVers"],
    chainType: root["bwModel:chainType"] || root["chainType"],
    status: root["bwModel:status"] || root["status"]
  }
}

/**
 * Parse Process Chain Details - 解析流程链详细信息
 *
 * @param xmlBody - XML响应体
 * @returns 流程链详细信息
 */
export function parseProcessChainDetails(xmlBody: string): ProcessChainDetails {
  const root = fullParse(xmlBody) as any

  // 提取流程链基本信息
  const chainNode = root["bwModel:processChain"] || root
  const name = chainNode["bwModel:chainName"] || chainNode["bwModel:name"]
  const technicalName = chainNode["bwModel:technicalName"] || name
  const description = chainNode["bwModel:description"]
  const objVers = chainNode["bwModel:objVers"]
  const chainType = chainNode["bwModel:chainType"]
  const status = chainNode["bwModel:status"]

  // 提取流程链步骤
  let steps: ProcessChainStep[] = []
  const stepsNode = chainNode["bwModel:steps"] || chainNode["steps"]
  if (stepsNode) {
    const stepList = Array.isArray(stepsNode) ? stepsNode : [stepsNode]
    const stepItems = stepList.flatMap(s => s["bwModel:step"] || s["step"] || [])

    steps = stepItems.map((step: any) => ({
      stepId: step["bwModel:stepId"] || step["stepId"],
      stepType: step["bwModel:stepType"] || step["stepType"],
      description: step["bwModel:description"] || step["description"],
      status: step["bwModel:status"] || step["status"],
      source: step["bwModel:source"] || step["source"],
      target: step["bwModel:target"] || step["target"]
    }))
  }

  return {
    name: name || technicalName,
    technicalName,
    description,
    objVers,
    chainType,
    status,
    steps: steps.length > 0 ? steps : undefined,
    created: chainNode["bwModel:created"],
    changed: chainNode["bwModel:changed"],
    changedBy: chainNode["bwModel:changedBy"]
  }
}

/**
 * Get Process Chain Details - 获取流程链详细信息
 *
 * 对应请求: GET /sap/bw/modeling/pc/{chain_id}/m
 *
 * @param client - ADT HTTP 客户端
 * @param chainId - Process Chain ID
 * @returns 流程链详细信息
 */
export async function getProcessChainDetails(
  client: AdtHTTP,
  chainId: string
): Promise<ProcessChainDetails> {
  const response = await client.request(
    `/sap/bw/modeling/pc/${chainId}/m`,
    {
      headers: {
        "Accept": "application/vnd.sap.bw.modeling.pc-v1_0_0+xml"
      }
    }
  )

  return parseProcessChainDetails(response.body)
}

/**
 * Get Process Chain Versions - 获取流程链版本历史
 *
 * 对应请求: GET /sap/bw/modeling/pc/{chain_id}/versions
 *
 * @param client - ADT HTTP 客户端
 * @param chainId - Process Chain ID
 * @returns 版本历史列表
 */
export async function getProcessChainVersions(
  client: AdtHTTP,
  chainId: string
): Promise<ProcessChainVersion[]> {
  const obj = new BWObject(client, BWObjectType.PROCESS_CHAIN, chainId)
  return obj.getVersions()
}

/**
 * Activate Process Chain - 激活流程链
 *
 * 对应请求: POST /sap/bw/modeling/activation
 *
 * @param client - ADT HTTP 客户端
 * @param chainId - Process Chain ID
 * @param lockHandle - 锁定句柄
 * @param corrNr - 传输请求号（可选）
 * @returns 激活结果
 */
export async function activateProcessChain(
  client: AdtHTTP,
  chainId: string,
  lockHandle?: string,
  corrNr?: string
): Promise<ActivationResult> {
  const obj = new BWObject(client, BWObjectType.PROCESS_CHAIN, chainId)
  return obj.activate(lockHandle)
}

/**
 * Check Process Chain - 检查流程链一致性
 *
 * 对应请求: POST /sap/bw/modeling/activation
 *
 * @param client - ADT HTTP 客户端
 * @param chainId - Process Chain ID
 * @returns 检查结果
 */
export async function checkProcessChain(
  client: AdtHTTP,
  chainId: string
): Promise<ActivationResult> {
  const obj = new BWObject(client, BWObjectType.PROCESS_CHAIN, chainId)
  return obj.check()
}

/**
 * Execute Process Chain - 执行流程链
 *
 * 对应请求: POST /sap/bw/modeling/pc/{chain_id}?action=execute
 *
 * @param client - ADT HTTP 客户端
 * @param chainId - Process Chain ID
 * @returns 执行结果
 */
export async function executeProcessChain(
  client: AdtHTTP,
  chainId: string
): Promise<ProcessChainExecutionResult> {
  const response = await client.request(
    `/sap/bw/modeling/pc/${chainId}?action=execute`,
    {
      method: "POST",
      headers: {
        "Accept": "application/vnd.sap.bw.modeling.pc-v1_0_0+xml"
      }
    }
  )

  const root = fullParse(response.body) as any
  const resultNode = root["bwModel:executionResult"] || root

  return {
    success: resultNode["bwModel:success"] === "true" || resultNode["success"] === true,
    requestID: resultNode["bwModel:requestID"] || resultNode["requestID"],
    message: resultNode["bwModel:message"] || resultNode["message"],
    startTime: resultNode["bwModel:startTime"] || resultNode["startTime"],
    endTime: resultNode["bwModel:endTime"] || resultNode["endTime"],
    status: resultNode["bwModel:status"] || resultNode["status"]
  }
}

/**
 * Stop Process Chain - 停止正在运行的流程链
 *
 * 对应请求: POST /sap/bw/modeling/pc/{chain_id}?action=stop
 *
 * @param client - ADT HTTP 客户端
 * @param chainId - Process Chain ID
 * @returns 停止结果
 */
export async function stopProcessChain(
  client: AdtHTTP,
  chainId: string
): Promise<{ success: boolean; message?: string }> {
  const response = await client.request(
    `/sap/bw/modeling/pc/${chainId}?action=stop`,
    {
      method: "POST",
      headers: {
        "Accept": "application/vnd.sap.bw.modeling.pc-v1_0_0+xml"
      }
    }
  )

  const root = fullParse(response.body) as any
  const resultNode = root["bwModel:stopResult"] || root

  return {
    success: resultNode["bwModel:success"] === "true" || resultNode["success"] === true,
    message: resultNode["bwModel:message"] || resultNode["message"]
  }
}

/**
 * Get Process Chain Logs - 获取流程链执行日志
 *
 * 对应请求: GET /sap/bw/modeling/pc/{chain_id}/logs
 *
 * @param client - ADT HTTP 客户端
 * @param chainId - Process Chain ID
 * @returns 执行日志列表
 */
export async function getProcessChainLogs(
  client: AdtHTTP,
  chainId: string
): Promise<ProcessChainLogEntry[]> {
  const response = await client.request(
    `/sap/bw/modeling/pc/${chainId}/logs`,
    {
      headers: {
        "Accept": "application/vnd.sap.bw.modeling.pc-v1_0_0+xml"
      }
    }
  )

  const root = fullParse(response.body) as any
  const logsNode = root["bwModel:logs"] || root

  let logEntries: ProcessChainLogEntry[] = []
  const entryList = logsNode["bwModel:logEntry"] || logsNode["logEntry"]
  const entries = Array.isArray(entryList) ? entryList : (entryList ? [entryList] : [])

  logEntries = entries.map((entry: any) => ({
    chainName: entry["bwModel:chainName"] || entry["chainName"],
    stepName: entry["bwModel:stepName"] || entry["stepName"],
    timestamp: entry["bwModel:timestamp"] || entry["timestamp"],
    status: entry["bwModel:status"] || entry["status"],
    message: entry["bwModel:message"] || entry["message"],
    duration: entry["bwModel:duration"] || entry["duration"],
    recordsProcessed: entry["bwModel:recordsProcessed"] || entry["recordsProcessed"]
  }))

  return logEntries
}

/**
 * Get Process Chain Status - 获取流程链运行状态
 *
 * 对应请求: GET /sap/bw/modeling/pc/{chain_id}/status
 *
 * @param client - ADT HTTP 客户端
 * @param chainId - Process Chain ID
 * @returns 运行状态信息
 */
export async function getProcessChainStatus(
  client: AdtHTTP,
  chainId: string
): Promise<ProcessChainStatusInfo> {
  const response = await client.request(
    `/sap/bw/modeling/pc/${chainId}/status`,
    {
      headers: {
        "Accept": "application/vnd.sap.bw.modeling.pc-v1_0_0+xml"
      }
    }
  )

  const root = fullParse(response.body) as any
  const statusNode = root["bwModel:statusInfo"] || root

  return {
    chainName: statusNode["bwModel:chainName"] || statusNode["chainName"],
    status: statusNode["bwModel:status"] || statusNode["status"],
    currentStep: statusNode["bwModel:currentStep"] || statusNode["currentStep"],
    totalSteps: statusNode["bwModel:totalSteps"] || statusNode["totalSteps"],
    completedSteps: statusNode["bwModel:completedSteps"] || statusNode["completedSteps"],
    startTime: statusNode["bwModel:startTime"] || statusNode["startTime"],
    endTime: statusNode["bwModel:endTime"] || statusNode["endTime"],
    message: statusNode["bwModel:message"] || statusNode["message"]
  }
}

// ============================================================================
// Validation Functions (using BWObject base class)
// ============================================================================

/**
 * Validate Process Chain Exists - 验证流程链是否存在
 *
 * @param client - ADT HTTP 客户端
 * @param chainId - Process Chain ID
 * @returns 验证结果
 */
export async function validateProcessChainExists(
  client: AdtHTTP,
  chainId: string
): Promise<ValidationResult> {
  const obj = new BWObject(client, BWObjectType.PROCESS_CHAIN, chainId)
  return obj.exists()
}

/**
 * Validate New Process Chain Name - 验证新流程链名称是否可用
 *
 * @param client - ADT HTTP 客户端
 * @param chainId - Process Chain ID
 * @returns 验证结果
 */
export async function validateProcessChainNewName(
  client: AdtHTTP,
  chainId: string
): Promise<ValidationResult> {
  const obj = new BWObject(client, BWObjectType.PROCESS_CHAIN, chainId)
  return obj.isNewNameAvailable()
}

/**
 * Validate Process Chain Can Delete - 验证流程链是否可删除
 *
 * @param client - ADT HTTP 客户端
 * @param chainId - Process Chain ID
 * @returns 验证结果
 */
export async function validateProcessChainCanDelete(
  client: AdtHTTP,
  chainId: string
): Promise<ValidationResult> {
  const obj = new BWObject(client, BWObjectType.PROCESS_CHAIN, chainId)
  return obj.canDelete()
}

/**
 * Validate Process Chain Can Activate - 验证流程链是否可激活
 *
 * @param client - ADT HTTP 客户端
 * @param chainId - Process Chain ID
 * @returns 验证结果
 */
export async function validateProcessChainCanActivate(
  client: AdtHTTP,
  chainId: string
): Promise<ValidationResult> {
  const obj = new BWObject(client, BWObjectType.PROCESS_CHAIN, chainId)
  return obj.canActivate()
}
