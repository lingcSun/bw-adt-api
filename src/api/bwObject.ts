import { AdtHTTP } from "../AdtHTTP"
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
}

/**
 * BW Object Configuration Map - 对象配置映射
 */
const BW_OBJECT_CONFIGS: Record<BWObjectType, BWObjectConfig> = {
  [BWObjectType.ADSO]: {
    endpoint: "/sap/bw/modeling/adso",
    contentType: "application/vnd.sap.bw.modeling.adso-v1_5_0+xml",
    versionSuffix: true
  },
  [BWObjectType.TRANSFORMATION]: {
    endpoint: "/sap/bw/modeling/trfn",
    contentType: "application/vnd.sap.bw.modeling.trfn-v1_0_0+xml",
    versionSuffix: true
  },
  [BWObjectType.DTP]: {
    endpoint: "/sap/bw/modeling/dtpa",
    contentType: "application/vnd.sap.bw.modeling.dtpa-v1_0_0+xml",
    versionSuffix: true
  },
  [BWObjectType.PROCESS_CHAIN]: {
    endpoint: "/sap/bw/modeling/pc",
    contentType: "application/vnd.sap.bw.modeling.pc-v1_0_0+xml",
    versionSuffix: true
  },
  [BWObjectType.INFO_OBJECT]: {
    endpoint: "/sap/bw/modeling/iobj",
    contentType: "application/vnd.sap-bw-modeling.iobj-v2_1_0+xml",
    versionSuffix: true
  },
  [BWObjectType.DATA_SOURCE]: {
    endpoint: "/sap/bw/modeling/datasource",
    contentType: "application/vnd.sap.bw.modeling.datasource+xml",
    versionSuffix: false
  },
  [BWObjectType.INFO_SOURCE]: {
    endpoint: "/sap/bw/modeling/infosource",
    contentType: "application/vnd.sap.bw.modeling.infosource+xml",
    versionSuffix: false
  },
  [BWObjectType.INFO_AREA]: {
    endpoint: "/sap/bw/modeling/area",
    contentType: "application/vnd.sap.bw.modeling.infoarea+xml",
    versionSuffix: false
  }
}

// ============================================================================
// BW Object Generic Base Class
// ============================================================================

/**
 * BW Object - 泛型基类
 *
 * 提供所有 BW 对象类型的通用操作：
 * - Lock / Unlock
 * - Activate / Check
 * - Get Versions
 * - Validate (exists, new name, etc.)
 *
 * @template T - BW 对象类型
 */
export class BWObject<T extends BWObjectType> {
  constructor(
    protected client: AdtHTTP,
    public readonly objectType: T,
    public readonly objectName: string
  ) {}

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
  async lock(): Promise<LockResult> {
    const response = await this.client.request(
      `${this.config.endpoint}/${this.objectName.toLowerCase()}?action=lock`,
      {
        method: "POST",
        headers: {
          "Accept": this.config.contentType
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
      `${this.buildUri("m")}/versions`,
      {
        method: "GET",
        headers: {
          "Accept": "application/atom+xml;type=feed"
        }
      }
    )
    return parseObjectVersions(response.body)
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
 * @returns BWObject 实例
 */
export function createBWObject<T extends BWObjectType>(
  client: AdtHTTP,
  objectType: T,
  objectName: string
): BWObject<T> {
  return new BWObject(client, objectType, objectName)
}
