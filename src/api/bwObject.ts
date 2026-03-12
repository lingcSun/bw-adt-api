import { AdtHTTP, session_types } from "../AdtHTTP"
import {
  LockResult,
  ActivationResult,
  ValidationResult,
  ObjectVersion,
  ValidationAction,
  validateObject,
  activateObject,
  parseLockResponse,
  parseObjectVersions
} from "./common"

// ============================================================================
// Types for CRUD Operations
// ============================================================================

/**
 * XML Builder Function - XML 构建器函数类型
 * 用于构建 create/update 请求的 XML body
 */
export type XMLBuilderFunction<T = any> = (options: T) => string

/**
 * Create Options - 创建对象选项
 */
export interface CreateOptionsBase {
  transport?: string      // 传输请求号
  parent?: string         // 父对象（如 InfoArea 的 parentInfoArea）
}

/**
 * Update Options - 更新对象选项
 */
export interface UpdateOptionsBase {
  lockHandle?: string     // 锁定句柄（如果已锁定）
  transport?: string      // 传输请求号
  timestamp?: string      // 时间戳（某些对象更新需要）
}

// ============================================================================
// BW Object Type Enum and Configuration
// ============================================================================

/**
 * BW Object Type - BW 对象类型枚举
 */
export enum BWObjectType {
  ADSO = "adso",
  TRANSFORMATION = "trfn",
  DTP = "dtpa",
  PROCESS_CHAIN = "pc",
  INFO_OBJECT = "iobj",
  DATA_SOURCE = "dso",
  INFO_SOURCE = "isrc",
  INFO_AREA = "area"
}

/**
 * BW Object Configuration - 对象类型配置
 */
interface BWObjectConfig {
  endpoint: string          // 如 "/sap/bw/modeling/adso"
  contentType: string       // 如 "application/vnd.sap.bw.modeling.adso-v1_5_0+xml"
  versionSuffix?: boolean   // URI 是否需要版本后缀 (/m, /a, /d)
  needsActivate?: boolean   // 创建后是否需要激活（InfoArea 为 false）
  versionChar?: string      // 版本字符（InfoArea 用 "a"，其他用 "m"）
}

/**
 * BW Object Configuration Map - 对象配置映射
 */
const BW_OBJECT_CONFIGS: Record<BWObjectType, BWObjectConfig> = {
  [BWObjectType.ADSO]: {
    endpoint: "/sap/bw/modeling/adso",
    contentType: "application/vnd.sap.bw.modeling.adso-v1_5_0+xml",
    versionSuffix: true,
    needsActivate: true,
    versionChar: "m"
  },
  [BWObjectType.TRANSFORMATION]: {
    endpoint: "/sap/bw/modeling/trfn",
    contentType: "application/vnd.sap.bw.modeling.trfn-v1_0_0+xml",
    versionSuffix: true,
    needsActivate: true,
    versionChar: "m"
  },
  [BWObjectType.DTP]: {
    endpoint: "/sap/bw/modeling/dtpa",
    contentType: "application/vnd.sap.bw.modeling.dtpa-v1_0_0+xml",
    versionSuffix: true,
    needsActivate: true,
    versionChar: "m"
  },
  [BWObjectType.PROCESS_CHAIN]: {
    endpoint: "/sap/bw/modeling/pc",
    contentType: "application/vnd.sap.bw.modeling.pc-v1_0_0+xml",
    versionSuffix: true,
    needsActivate: true,
    versionChar: "m"
  },
  [BWObjectType.INFO_OBJECT]: {
    endpoint: "/sap/bw/modeling/iobj",
    contentType: "application/vnd.sap-bw-modeling.iobj-v2_1_0+xml",
    versionSuffix: true,
    needsActivate: true,
    versionChar: "m"
  },
  [BWObjectType.DATA_SOURCE]: {
    endpoint: "/sap/bw/modeling/datasource",
    contentType: "application/vnd.sap.bw.modeling.datasource+xml",
    versionSuffix: false,
    needsActivate: true,
    versionChar: "m"
  },
  [BWObjectType.INFO_SOURCE]: {
    endpoint: "/sap/bw/modeling/infosource",
    contentType: "application/vnd.sap.bw.modeling.infosource+xml",
    versionSuffix: false,
    needsActivate: true,
    versionChar: "m"
  },
  [BWObjectType.INFO_AREA]: {
    endpoint: "/sap/bw/modeling/area",
    contentType: "application/vnd.sap.bw.modeling.area-v1_1_0+xml",
    versionSuffix: false,
    needsActivate: false,  // InfoArea 不需要激活
    versionChar: "a"       // InfoArea 使用 /a 表示 active 版本
  }
}

// ============================================================================
// BW Object Generic Base Class
// ============================================================================

/**
 * BW Object - 泛型基类
 *
 * 提供所有 BW 对象类型的通用操作：
 * - Create / Update / Delete
 * - Lock / Unlock
 * - Activate / Check
 * - Get Versions
 * - Validate (exists, new name, etc.)
 *
 * @template T - BW 对象类型
 */
export class BWObject<T extends BWObjectType> {
  private xmlBuilder?: XMLBuilderFunction

  constructor(
    protected client: AdtHTTP,
    public readonly objectType: T,
    public readonly objectName: string,
    xmlBuilder?: XMLBuilderFunction
  ) {
    this.xmlBuilder = xmlBuilder
  }

  /**
   * Set XML Builder - 设置 XML 构建器
   * 用于 create/update 操作
   */
  public setXMLBuilder(builder: XMLBuilderFunction): void {
    this.xmlBuilder = builder
  }

  /**
   * Get object configuration
   */
  protected get config(): BWObjectConfig {
    return BW_OBJECT_CONFIGS[this.objectType]
  }

  /**
   * Build object URI with optional version suffix
   *
   * @param version - Version (m=active, a=modified, d=revised)
   * @returns Full object URI
   */
  protected buildUri(version?: "m" | "a" | "d"): string {
    const base = `${this.config.endpoint}/${this.objectName.toLowerCase()}`
    return version && this.config.versionSuffix ? `${base}/${version}` : base
  }

  /**
   * Lock Object - 锁定对象
   *
   * 对应请求: POST /sap/bw/modeling/{endpoint}/{name}?action=lock
   *
   * @returns 锁定结果（包含 lockHandle）
   */
  async lock(options: { headers?: Record<string, string> } = {}): Promise<LockResult> {
    const { headers = {} } = options
    const response = await this.client.request(
      `${this.config.endpoint}/${this.objectName.toLowerCase()}?action=lock`,
      {
        method: "POST",
        sessionType: session_types.stateful,
        headers: {
          "Accept": this.config.contentType,
          ...headers
        }
      }
    )
    return parseLockResponse(response.body)
  }

  /**
   * Unlock Object - 解锁对象
   *
   * 对应请求: POST /sap/bw/modeling/{endpoint}/{name}?action=unlock
   */
  async unlock(): Promise<void> {
    await this.client.request(
      `${this.config.endpoint}/${this.objectName.toLowerCase()}?action=unlock`,
      {
        method: "POST",
        sessionType: session_types.stateful,
        headers: {
          "Accept": this.config.contentType
        }
      }
    )
  }

  /**
   * Check Object - 检查对象一致性
   *
   * @returns 检查结果
   */
  async check(): Promise<ActivationResult> {
    return activateObject(
      this.client,
      this.buildUri("m"),
      "",
      "inactive",
      this.config.contentType
    )
  }

  /**
   * Activate Object - 激活对象
   *
   * @param lockHandle - 锁定句柄
   * @returns 激活结果
   */
  async activate(lockHandle?: string): Promise<ActivationResult> {
    return activateObject(
      this.client,
      this.buildUri("m"),
      lockHandle || "",
      "inactive",
      this.config.contentType
    )
  }

  /**
   * Validate Object - 验证对象
   *
   * @param action - 验证动作
   * @returns 验证结果
   */
  async validate(action: ValidationAction): Promise<ValidationResult> {
    return validateObject(
      this.client,
      this.objectType.toUpperCase(),
      this.objectName,
      action
    )
  }

  /**
   * Check if Object Exists - 检查对象是否存在
   *
   * @returns 验证结果
   */
  async exists(): Promise<ValidationResult> {
    return this.validate(ValidationAction.EXISTS)
  }

  /**
   * Check if New Name is Available - 检查新名称是否可用
   *
   * @returns 验证结果
   */
  async isNewNameAvailable(): Promise<ValidationResult> {
    return this.validate(ValidationAction.NEW)
  }

  /**
   * Check if Object Can be Deleted - 检查对象是否可删除
   *
   * @returns 验证结果
   */
  async canDelete(): Promise<ValidationResult> {
    return this.validate(ValidationAction.DELETE)
  }

  /**
   * Check if Object Can be Activated - 检查对象是否可激活
   *
   * @returns 验证结果
   */
  async canActivate(): Promise<ValidationResult> {
    return this.validate(ValidationAction.ACTIVATE)
  }

  /**
   * Get Object Versions - 获取对象版本历史
   *
   * 对应请求: GET /sap/bw/modeling/{endpoint}/{name}/versions
   *
   * @returns 版本历史列表
   */
  async getVersions(): Promise<ObjectVersion[]> {
    const response = await this.client.request(
      `${this.buildUri(this.config.versionChar === "a" ? "a" : "m")}/versions`,
      {
        method: "GET",
        headers: {
          "Accept": "application/atom+xml;type=feed"
        }
      }
    )
    return parseObjectVersions(response.body)
  }

  // ========================================
  // CRUD Operations
  // ========================================

  /**
   * Create Object - 创建对象
   *
   * 流程：验证 → 锁定 → 创建 → （可选激活）→ 解锁
   *
   * 对应请求: POST /sap/bw/modeling/{endpoint}/{name}?lockHandle={lock_handle}
   *
   * @param xmlBody - 对象 XML 内容
   * @param options - 创建选项
   * @returns 创建结果
   */
  async create(
    xmlBody: string,
    options: CreateOptionsBase & {
      parent?: string           // 父对象（用于验证）
      headers?: Record<string, string>  // 额外的请求头
    } = {}
  ): Promise<void> {
    const { transport, parent, headers = {} } = options

    // Step 1: 验证父对象（如果提供）
    if (parent) {
      await validateObject(this.client, this.objectType.toUpperCase(), parent, ValidationAction.EXISTS)
    }

    // Step 2: 验证新名称是否可用
    await this.isNewNameAvailable()

    // Step 3: 锁定对象
    const lockResult = await this.lock({
      // ADT 创建流程会带此上下文，部分系统缺失时会导致后续 create 失败
      headers: { "activity_context": "CREA" }
    })

    // Step 4: 创建对象
    const qs: Record<string, string> = { lockHandle: lockResult.lockHandle }
    if (transport) qs["transport"] = transport

    await this.client.request(this.buildUri(), {
      method: "POST",
      qs,
      headers: {
        "Content-Type": this.config.contentType,
        "Accept": this.config.contentType,
        ...headers
      },
      body: xmlBody
    })

    // Step 5: 激活（如果需要）并解锁
    if (this.config.needsActivate) {
      await this.activate(lockResult.lockHandle)
    }

    await this.unlock()
  }

  /**
   * Update Object - 更新对象
   *
   * 流程：锁定 → 更新 → （可选激活）
   *
   * 对应请求: POST /sap/bw/modeling/{endpoint}/{name}?lockHandle={lock_handle}
   *
   * @param xmlBody - 对象 XML 内容
   * @param options - 更新选项
   * @returns 更新结果
   */
  async update(
    xmlBody: string,
    options: UpdateOptionsBase & {
      headers?: Record<string, string>
    } = {}
  ): Promise<ActivationResult | void> {
    const { lockHandle: providedLockHandle, transport, timestamp, headers = {} } = options

    // Step 1: 锁定（如果未提供 lockHandle）
    const lockResult = providedLockHandle
      ? { lockHandle: providedLockHandle }
      : await this.lock()

    // Step 2: 更新对象
    const qs: Record<string, string> = { lockHandle: lockResult.lockHandle }
    if (transport) qs["transport"] = transport

    const isInfoArea = this.objectType === BWObjectType.INFO_AREA
    const isADSO = this.objectType === BWObjectType.ADSO
    const updateUri = isInfoArea
      ? this.buildUri("a" as "m" | "a")
      : isADSO
        ? this.buildUri("m")
        : this.buildUri()
    const method = (isInfoArea || isADSO) ? "PUT" : "POST"
    const contentType = (isInfoArea || isADSO)
      ? `application/xml, ${this.config.contentType}`
      : this.config.contentType

    const requestHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Accept": this.config.contentType,
      ...headers
    }
    if (timestamp) requestHeaders["timestamp"] = timestamp

    await this.client.request(updateUri, {
      method,
      qs,
      headers: requestHeaders,
      body: xmlBody
    })

    // Step 3: 激活（如果需要）
    if (this.config.needsActivate) {
      return this.activate(lockResult.lockHandle)
    }
  }

  /**
   * Delete Object - 删除对象
   *
   * InfoArea: DELETE /sap/bw/modeling/area/{name}/a?lockHandle={lockHandle}
   * ADSO: DELETE /sap/bw/modeling/adso/{name}/m?lockHandle={lockHandle}
   * 其他对象: DELETE /sap/bw/modeling/{endpoint}/{name}?transport={transport}
   *
   * @param lockHandleOrTransport - 锁定句柄 或 传输请求号
   * @returns 删除结果
   */
  async delete(lockHandleOrTransport: string): Promise<void> {
    const useLockHandleMode =
      this.objectType === BWObjectType.INFO_AREA ||
      this.objectType === BWObjectType.ADSO

    const lockVersion: "m" | "a" = this.objectType === BWObjectType.INFO_AREA ? "a" : "m"
    const uri = useLockHandleMode ? this.buildUri(lockVersion) : this.buildUri()
    const qs = useLockHandleMode
      ? { lockHandle: lockHandleOrTransport }
      : { transport: lockHandleOrTransport }

    await this.client.request(uri, { method: "DELETE", qs })

    if (useLockHandleMode) {
      try {
        await this.unlock()
      } catch {
        // 删除后对象可能已不存在，unlock 失败可忽略
      }
    }
  }

  /**
   * Get Object Details - 获取对象详细信息
   *
   * 对应请求: GET /sap/bw/modeling/{endpoint}/{name}/{version}
   *
   * @returns 对象详细信息（原始 XML 字符串）
   */
  async getDetails(): Promise<string> {
    const version = this.config.versionChar === "a" ? "a" : "m"
    const response = await this.client.request(
      this.buildUri(version as "m" | "a"),
      {
        method: "GET",
        headers: {
          "Accept": this.config.contentType
        }
      }
    )
    return response.body
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create BW Object - 创建 BW 对象实例
 *
 * @param client - ADT HTTP 客户端
 * @param objectType - 对象类型
 * @param objectName - 对象名称
 * @param xmlBuilder - 可选的 XML 构建器函数
 * @returns BWObject 实例
 */
export function createBWObject<T extends BWObjectType>(
  client: AdtHTTP,
  objectType: T,
  objectName: string,
  xmlBuilder?: XMLBuilderFunction
): BWObject<T> {
  return new BWObject(client, objectType, objectName, xmlBuilder)
}
