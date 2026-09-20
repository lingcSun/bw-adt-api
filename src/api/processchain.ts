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
//
// 2026-09-20 复核（docs/VERIFIED_APIS.md F1）：本系统端点为 /sap/bw/modeling/rspc
// （/pc 404）；GET /rspc/{id}/m 服务 JSON
// (application/vnd.sap.bw4.modeling.processvariant.chain-v1_0_0+json)，
// pc/rspc 的 vendor XML 一律 415。读路径（meta/details）已实测并按下述 JSON 解析；
// versions/logs/status 后缀本系统拒绝（「不支持对象版本 V/L/S」），函数保留，
// 服务端错误原样上抛；execute/stop 未实测（不允许对业务链执行），仅修正前缀。
// ============================================================================

/** rspc JSON 端点的 Accept/Content-Type */
export const PC_JSON_CONTENT_TYPE =
  "application/vnd.sap.bw4.modeling.processvariant.chain-v1_0_0+json"

/**
 * Lock Process Chain - 锁定流程链
 *
 * 对应请求: POST /sap/bw/modeling/rspc/{chain_id}?action=lock
 * ⚠️ 本系统未实测（不允许对业务链执行）；URL/会话模型沿用已验证的统一 lock 模式。
 *
 * @param client - ADT HTTP 客户端
 * @param chainId - Process Chain ID（大小写敏感，不转小写）
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
 * 对应请求: POST /sap/bw/modeling/rspc/{chain_id}?action=unlock
 * ⚠️ 本系统未实测（同 lock）。
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
 * 对应请求: GET /sap/bw/modeling/rspc/{chain_id}/m
 * 实测 (2026-09-20): 服务 JSON (processvariant.chain-v1_0_0+json)。
 *
 * @param client - ADT HTTP 客户端
 * @param chainId - Process Chain ID（大小写敏感）
 * @returns 流程链元数据
 */
export async function getProcessChain(
  client: AdtHTTP,
  chainId: string
): Promise<ProcessChainMetaData> {
  const response = await client.request(
    `/sap/bw/modeling/rspc/${encodeURIComponent(chainId)}/m`,
    {
      headers: {
        "Accept": PC_JSON_CONTENT_TYPE
      }
    }
  )

  return parseProcessChainMetaData(response.body, chainId)
}

/**
 * Parse Process Chain Metadata - 解析流程链元数据（rspc JSON）
 *
 * 实测 JSON 顶层形态: { bActive, sVariantDescription, oDetail, aSocket[], aExecutionOption[] }。
 * 无链名字段（名字即 URL id）；bActive 为建模活动版本标记，非运行状态。
 *
 * @param jsonBody - JSON 响应体
 * @param chainId - Process Chain ID（payload 不含名字，由调用方回填）
 * @returns 流程链元数据
 */
export function parseProcessChainMetaData(jsonBody: string, chainId: string): ProcessChainMetaData {
  const json = safeJsonParse(jsonBody)

  return {
    name: chainId,
    description: json?.sVariantDescription,
    // bActive=true 表示活动版本存在（实测 active 链为 true）；否则视为仅修改版
    objVers: json?.bActive === true ? "M" : json?.bActive === false ? "A" : undefined,
    chainType: undefined,
    status: json?.bActive === true ? "active" : json?.bActive === false ? "inactive" : undefined
  }
}

/** 解析 JSON 响应体；非法 JSON 时带原始片段抛错（rspc 读路径应始终是合法 JSON） */
function safeJsonParse(body: string): any {
  try {
    return JSON.parse(body)
  } catch {
    throw new Error(
      `rspc endpoint returned non-JSON payload (first 120 chars): ${body.slice(0, 120)}`
    )
  }
}

/**
 * Parse Process Chain Details - 解析流程链详细信息（rspc JSON）
 *
 * 实测 payload 不含步骤/时间戳/责任人字段（本系统样例 oDetail 为空），
 * steps/created/changed/changedBy 恒为 undefined——如实保留缺口，不虚构字段。
 *
 * @param jsonBody - JSON 响应体
 * @param chainId - Process Chain ID（payload 不含名字，由调用方回填）
 * @returns 流程链详细信息
 */
export function parseProcessChainDetails(jsonBody: string, chainId?: string): ProcessChainDetails {
  const json = safeJsonParse(jsonBody)
  const name = chainId || ""

  return {
    name,
    technicalName: name,
    description: json?.sVariantDescription,
    objVers: json?.bActive === true ? "M" : json?.bActive === false ? "A" : undefined,
    chainType: undefined,
    status: json?.bActive === true ? "active" : json?.bActive === false ? "inactive" : undefined,
    steps: undefined,
    created: undefined,
    changed: undefined,
    changedBy: undefined
  }
}

/**
 * Get Process Chain Details - 获取流程链详细信息
 *
 * 对应请求: GET /sap/bw/modeling/rspc/{chain_id}/m（JSON，已实测）
 *
 * @param client - ADT HTTP 客户端
 * @param chainId - Process Chain ID（大小写敏感）
 * @returns 流程链详细信息
 */
export async function getProcessChainDetails(
  client: AdtHTTP,
  chainId: string
): Promise<ProcessChainDetails> {
  const response = await client.request(
    `/sap/bw/modeling/rspc/${encodeURIComponent(chainId)}/m`,
    {
      headers: {
        "Accept": PC_JSON_CONTENT_TYPE
      }
    }
  )

  return parseProcessChainDetails(response.body, chainId)
}

/**
 * Get Process Chain Versions - 获取流程链版本历史
 *
 * 对应请求: GET /sap/bw/modeling/rspc/{chain_id}/versions
 * ⚠️ 本系统拒绝该后缀（「不支持对象版本 V」，2026-09-19/20 实测），错误原样上抛。
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
 * ⚠️ 本系统未实测（不允许动业务链）；URI/lockHandle/corrNr 语义同其他 BW 对象。
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
  return obj.activate(lockHandle, corrNr)
}

/**
 * Check Process Chain - 检查流程链一致性
 *
 * 对应请求: POST /sap/bw/modeling/activation（checkruns 路径）
 * ⚠️ 本系统未实测。
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
 * 对应请求: POST /sap/bw/modeling/rspc/{chain_id}?action=execute
 * ⚠️ 未实测（不允许对业务链执行）；响应格式未知，以下解析沿用旧 XML 假设，
 * 结果字段在真实响应上可能为空——运行后请以日志核实。
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
    `/sap/bw/modeling/rspc/${chainId}?action=execute`,
    {
      method: "POST",
      headers: {
        "Accept": PC_JSON_CONTENT_TYPE
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
 * 对应请求: POST /sap/bw/modeling/rspc/{chain_id}?action=stop
 * ⚠️ 未实测（不允许对业务链执行）；响应格式未知，解析同 execute 的旧 XML 假设。
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
    `/sap/bw/modeling/rspc/${chainId}?action=stop`,
    {
      method: "POST",
      headers: {
        "Accept": PC_JSON_CONTENT_TYPE
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
 * 对应请求: GET /sap/bw/modeling/rspc/{chain_id}/logs
 * ⚠️ 本系统拒绝该后缀（「不支持对象版本 L」，2026-09-19/20 实测），错误原样上抛；
 * PC 运行日志需走 RSPC 应用日志（如 RSA1/BW4MT），本库暂无对应端点。
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
    `/sap/bw/modeling/rspc/${chainId}/logs`,
    {
      headers: {
        "Accept": PC_JSON_CONTENT_TYPE
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
 * 对应请求: GET /sap/bw/modeling/rspc/{chain_id}/status
 * ⚠️ 本系统拒绝该后缀（「不支持对象版本 S」，2026-09-20 实测），错误原样上抛。
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
    `/sap/bw/modeling/rspc/${chainId}/status`,
    {
      headers: {
        "Accept": PC_JSON_CONTENT_TYPE
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

/**
 * Validate New Process Chain Name - 验证新流程链名称是否可用
 *
 * @param client - ADT HTTP 客户端
 * @param chainId - Process Chain ID
 * @returns 验证结果
 */

/**
 * Validate Process Chain Can Delete - 验证流程链是否可删除
 *
 * @param client - ADT HTTP 客户端
 * @param chainId - Process Chain ID
 * @returns 验证结果
 */

/**
 * Validate Process Chain Can Activate - 验证流程链是否可激活
 *
 * @param client - ADT HTTP 客户端
 * @param chainId - Process Chain ID
 * @returns 验证结果
 */
