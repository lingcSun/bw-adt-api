import { AdtHTTP, session_types } from "../AdtHTTP"
import {
  LockResult,
  ActivationResult,
  ValidationResult,
  ObjectVersion,
  ValidationAction,
  validateObject,
  activateObject,
  checkObject,
  parseLockResponse,
  parseObjectVersions,
  withFreshSessionOnServerError
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
  /** true 时对象名保持原样进入 URI（PC 大小写敏感）；缺省 toLowerCase */
  preserveCase?: boolean
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
    // 实测 (2026-09-20, VERIFIED_APIS F1): 本系统端点为 /rspc，/pc 404；
    // GET /rspc/{id}/m 服务 JSON (processvariant.chain-v1_0_0+json)，
    // pc/rspc 的 vendor XML 一律 415。读路径已实测；lock/unlock/activate
    // 在本系统未验证（不允许动业务链），沿用统一前缀并如实标注。
    endpoint: "/sap/bw/modeling/rspc",
    contentType: "application/vnd.sap.bw4.modeling.processvariant.chain-v1_0_0+json",
    versionSuffix: true,
    needsActivate: true,
    versionChar: "m",
    // PC 技术名大小写敏感，禁止 toLowerCase（其他对象类型维持小写行为）
    preserveCase: true
  },
  [BWObjectType.INFO_OBJECT]: {
    endpoint: "/sap/bw/modeling/iobj",
    contentType: "application/vnd.sap-bw-modeling.iobj-v2_1_0+xml",
    versionSuffix: true,
    needsActivate: true,
    versionChar: "m"
  },
  [BWObjectType.DATA_SOURCE]: {
    // 实测修正 (2026-07-16 Eclipse Communication Log): 真实端点是 /rsds, 非 /datasource。
    // ⚠️ RSDS 是双段标识 /rsds/{datasource}/{sourceSystem}/m, 基类 buildUri() 只拼单段,
    // 不适用于 DataSource。完整的读写操作见 src/api/datasource.ts。此配置仅作对象类型登记。
    endpoint: "/sap/bw/modeling/rsds",
    contentType: "application/vnd.sap.bw.modeling.rsds-v1_1_0+xml",
    versionSuffix: true,
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
    // true so buildUri("a") → /area/{name}/a (Eclipse GET/PUT/DELETE active)
    versionSuffix: true,
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
   *
   * 未登记的类型（如调用方把参数顺序写反，传了对象名当类型）会让 config 变成
   * undefined，后续读 `.endpoint` 只会抛出 "Cannot read properties of undefined"。
   * 这里提前给出可操作的报错。
   */
  protected get config(): BWObjectConfig {
    const config = BW_OBJECT_CONFIGS[this.objectType]
    if (!config) {
      throw new Error(
        `Unknown BW object type ${JSON.stringify(this.objectType)} for object ` +
        `${JSON.stringify(this.objectName)}. Valid types: ${Object.keys(BW_OBJECT_CONFIGS).join(", ")}.`
      )
    }
    return config
  }

  /**
   * 对象名进入 URI 的形式：PC preserveCase，其余统一小写（历史行为）。
   * 统一 encodeURIComponent——命名空间名（/NS/OBJ）里的 / 不编码会被当
   * 路径切开（V4，2026-09-21）；对常规名（字母数字下划线）编码是无操作。
   */
  private get uriName(): string {
    const name = this.config.preserveCase ? this.objectName : this.objectName.toLowerCase()
    return encodeURIComponent(name)
  }

  /**
   * Build object URI with optional version suffix
   *
   * @param version - Version (m=active, a=modified, d=revised)
   * @returns Full object URI
   */
  protected buildUri(version?: "m" | "a" | "d"): string {
    const base = `${this.config.endpoint}/${this.uriName}`
    return version && this.config.versionSuffix ? `${base}/${version}` : base
  }

  /**
   * Lock Object - 锁定对象
   *
   * 对应请求: POST /sap/bw/modeling/{endpoint}/{name}?action=lock
   *
   * 会话模型 (实测验证, 对照 Eclipse Communication Log):
   * - lock 必须用 "stateful" 会话头。服务端返回 sap-contextid 建立会话,
   *   锁由该会话持有; 同会话内重复 lock 返回相同 lockHandle。
   * - 注意不要用 "stateful;enqueue" —— 实测该头会导致服务端销毁会话 (contextid=0),
   *   锁立即丢失。Eclipse 日志中的 "stateful, enqueue" 只是服务端会话的展示标签。
   * - 后续写操作 (PUT update / activation) 走 stateless 且不带 contextid,
   *   服务端通过 enqueue 锁表验证 URL 上的 lockHandle。
   *
   * @returns 锁定结果（包含 lockHandle）
   */
  async lock(options: { headers?: Record<string, string> } = {}): Promise<LockResult> {
    const { headers = {} } = options
    // lock 是写编排的入口且失败不留服务端状态——5xx 时按 F7 换新会话重试一次
    return withFreshSessionOnServerError(this.client, async () => {
      const response = await this.client.request(
        `${this.config.endpoint}/${this.uriName}?action=lock`,
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
    })
  }

  /**
   * Unlock Object - 解锁对象
   *
   * 对应请求: POST /sap/bw/modeling/{endpoint}/{name}?action=unlock
   *
   * 必须回到持锁的 stateful 会话中执行 (stateful 头 + contextid, 由 AdtHTTP 自动携带)。
   */
  async unlock(): Promise<void> {
    await this.client.request(
      `${this.config.endpoint}/${this.uriName}?action=unlock`,
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
   * Check Object - 检查对象一致性（只读，不激活）
   *
   * 发到 /sap/bw/modeling/checkruns，只检查不激活。
   * 激活用 activate()（POST /sap/bw/modeling/activation）。
   *
   * @returns 检查结果
   */
  async check(): Promise<ActivationResult> {
    return checkObject(
      this.client,
      this.buildUri("m"),
      this.config.contentType
    )
  }

  /**
   * Activate Object - 激活对象
   *
   * @param lockHandle - 锁定句柄
   * @param corrNr - 传输请求号（可选，随激活请求以 corrNr query 传递，
   *   与 activateDTP / activateDataSource 的实测用法一致）
   * @returns 激活结果
   */
  async activate(lockHandle?: string, corrNr?: string): Promise<ActivationResult> {
    return activateObject(
      this.client,
      this.buildUri("m"),
      lockHandle || "",
      "inactive",
      this.config.contentType,
      corrNr
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

  // canDelete()/canActivate() 已移除（2026-09-20 实测：validation 端点拒绝
  // action=delete/activate，"Action 'delete' is not valid"，见 VERIFIED_APIS 第 7 节 V1）。

  /**
   * Get Object Versions - 获取对象版本历史
   *
   * 对应请求: GET /sap/bw/modeling/{endpoint}/{name}/versions
   *
   * @returns 版本历史列表
   */
  async getVersions(): Promise<ObjectVersion[]> {
    const response = await this.client.request(
      `${this.buildUri()}/versions`,
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

    // create 失败也必须释放锁（与 saveAndActivate* 的 finally 约定一致）
    try {
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

      // Step 5: 激活（如果需要）
      if (this.config.needsActivate) {
        await this.activate(lockResult.lockHandle)
      }
    } finally {
      await this.unlock()

      // InfoArea create 后若仍持有 stateful context，同会话内紧接着 lock+delete
      // 会报「active version 不存在」。dropSession 清掉 create 会话再交还调用方。
      if (this.objectType === BWObjectType.INFO_AREA) {
        try {
          await this.client.dropSession()
        } catch {
          // 会话已失效时忽略
        }
      }
    }
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
      /** 保存后是否自动激活 (默认 true; 调用方需要带 corrNr 激活时传 false 自行处理) */
      activate?: boolean
    } = {}
  ): Promise<ActivationResult | void> {
    const { lockHandle: providedLockHandle, transport, timestamp, headers = {}, activate = true } = options

    // Step 1: 锁定（如果未提供 lockHandle）。
    // 自己加的锁在 finally 中释放；调用方传入的 lockHandle 归调用方管理，绝不代解。
    const ownLock = !providedLockHandle
    const lockResult = providedLockHandle
      ? { lockHandle: providedLockHandle }
      : await this.lock()

    try {
      // Step 2: 更新对象
      // 实测 (Eclipse Communication Log):
      //   DTP: PUT /sap/bw/modeling/dtpa/{id}/m?lockHandle=...   (有 /m, 用 PUT)
      //   ADSO: PUT /sap/bw/modeling/adso/{id}/m?lockHandle=...
      //   InfoArea: PUT /sap/bw/modeling/area/{id}/a?lockHandle=...
      // PUT 走 stateless 会话 (Eclipse 亦如此), 不带 contextid;
      // 服务端通过 enqueue 锁表验证 lockHandle, 锁由 lock 建立的 stateful 会话持有
      // TR 号通过 Transport-Lock-Holder header 传递 (复用已有 TR 时)
      // 或 corrNr query 参数 (新建 TR 时)
      // Eclipse 实测两种传 TR 方式均可见:
      //   ADSO: PUT .../m?corrNr={tr}&lockHandle={h}
      //   TRFN setFields: PUT .../m?lockHandle={h} + header Transport-Lock-Holder: {tr}
      // 同时带上两者最稳妥
      const qs: Record<string, string> = { lockHandle: lockResult.lockHandle }
      if (transport) qs["corrNr"] = transport

      const isInfoArea = this.objectType === BWObjectType.INFO_AREA
      // 有 versionSuffix 的对象 (ADSO/DTP/TRFN/PC/IOBJ) 用 /m, InfoArea 用 /a
      const updateUri = isInfoArea
        ? this.buildUri("a" as "m" | "a")
        : this.config.versionSuffix
          ? this.buildUri("m")
          : this.buildUri()
      // 所有 BW 对象 update 都用 PUT
      const method = "PUT"
      const contentType = `application/xml, ${this.config.contentType}`

      const requestHeaders: Record<string, string> = {
        "Content-Type": contentType,
        "Accept": this.config.contentType,
        ...headers
      }
      if (timestamp) requestHeaders["timestamp"] = timestamp
      if (transport) requestHeaders["Transport-Lock-Holder"] = transport

      await this.client.request(updateUri, {
        method,
        qs,
        sessionType: session_types.stateless,
        headers: requestHeaders,
        body: xmlBody
      })

      // Step 3: 激活（如果需要）
      if (activate && this.config.needsActivate) {
        return this.activate(lockResult.lockHandle)
      }
    } finally {
      if (ownLock) await this.unlock()
    }
  }

  /**
   * Delete Object - 删除对象
   *
   * InfoArea / ADSO / TRFN: DELETE /sap/bw/modeling/{endpoint}/{name}/{m|a}?lockHandle={lockHandle}[&corrNr={tr}]
   * 其他对象: DELETE /sap/bw/modeling/{endpoint}/{name}?transport={transport}
   *
   * 参数按类型二选一，**不再共用一个位置参数**——原先 ADSO/InfoArea 要 lockHandle、
   * 其余要 transport，同一个位置参数语义随类型漂移，极易传错：
   * - ADSO / InfoArea / TRFN：必须 `{ lockHandle }`（先 lock 再删），可选 `transport` 带 corrNr
   * - DTP / PC / InfoObject：必须 `{ transport }`
   *
   * TRFN 改走 lockHandle 路径的依据：transportchecks 路径要求 TR（本地对象没有），
   * 实测 `lock(?action=lock) → DELETE /m?lockHandle → unlock` 可删本地 TRFN
   * （docs/VERIFIED_APIS.md 第 6 节，2026-09-19/20 端到端验证）。
   *
   * @param options.lockHandle - ADSO/InfoArea/TRFN 的锁定句柄
   * @param options.transport - DTP/PC/IObj 的传输请求号；
   *   ADSO/InfoArea/TRFN 上传则为 corrNr。必须是**请求号**而非任务号——传任务号服务端报
   *   「请求 xxx 不是更改请求」。
   *   注意: 实测带 corrNr 删除后，E071 中该对象的历史登记项**不会**随之消失
   *   （登记项属于传输记录器，需在 SE10/SE01 删除或释放该请求才会清除）。
   * @returns 删除确认。不返回 undefined——上层（如 MCP 工具）直接序列化返回值时，
   *   undefined 会导致 content[0].text 缺失、schema 校验失败。
   */
  async delete(
    options: { lockHandle?: string; transport?: string } = {}
  ): Promise<{ deleted: true; objectType: T; objectName: string }> {
    const useLockHandleMode =
      this.objectType === BWObjectType.INFO_AREA ||
      this.objectType === BWObjectType.ADSO ||
      this.objectType === BWObjectType.TRANSFORMATION

    // 类型决定必填项，且拒绝走错分支（比静默拼出错误查询串好）。
    if (useLockHandleMode && !options.lockHandle) {
      throw new Error(
        `delete: ${this.objectType} requires options.lockHandle (obtain one via lock() first).`
      )
    }
    if (!useLockHandleMode && !options.transport) {
      throw new Error(
        `delete: ${this.objectType} requires options.transport (a workbench request number).`
      )
    }

    const lockVersion: "m" | "a" = this.objectType === BWObjectType.INFO_AREA ? "a" : "m"
    const uri = useLockHandleMode ? this.buildUri(lockVersion) : this.buildUri()
    const qs: Record<string, string> = useLockHandleMode
      ? { lockHandle: options.lockHandle! }
      : { transport: options.transport! }
    if (useLockHandleMode && options.transport) qs["corrNr"] = options.transport

    await this.client.request(uri, {
      method: "DELETE",
      qs,
      sessionType: session_types.stateless,
      headers: {
        Accept: this.config.contentType,
      },
    })

    if (useLockHandleMode) {
      try {
        await this.unlock()
      } catch {
        // 删除后对象可能已不存在，unlock 失败可忽略
      }
      if (this.objectType === BWObjectType.INFO_AREA) {
        try {
          await this.client.dropSession()
        } catch {
          // ignore
        }
      }
    }

    return { deleted: true, objectType: this.objectType, objectName: this.objectName }
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
