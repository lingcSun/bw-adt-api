import { adtException } from "./AdtException"
import {
  AdtHTTP,
  ClientOptions,
  session_types,
  BearerFetcher,
  HttpClient
} from "./AdtHTTP"
import { followUrl, isString } from "./utilities"
import https from "https"
import {
  AdsoDomain,
  TrfnDomain,
  DtpDomain,
  DataSourceDomain,
  ProcessChainDomain,
  InfoObjectDomain,
  RepositoryDomain,
  QueryDomain,
  SystemDomain,
  DdicDomain,
  TransportDomain
} from "./domains"

export function createSSLConfig(
  allowUnauthorized: boolean,
  ca?: string
): ClientOptions {
  const httpsAgent = new https.Agent({
    keepAlive: true,
    ca,
    rejectUnauthorized: !allowUnauthorized // disable CA checks?
  })

  return { httpsAgent }
}

interface HttpOptions {
  baseUrlOrClient: string | HttpClient
  username: string
  password: string | BearerFetcher
  client: string
  language: string
  options: ClientOptions
}

export class BWAdtClient {
  private discovery?: any[]
  private fetcher?: () => Promise<string>

  /**
   * Preferred Public API: use domain facades (`client.adso`, `client.trfn`, …).
   * Flat methods below remain for compatibility and are progressively deprecated.
   */

  public get httpClient() {
    return this.h
  }

  get id() {
    return this.h.id
  }

  private h: AdtHTTP
  private pClone?: BWAdtClient
  private options: HttpOptions

  /** Public domain facades (preferred entry). */
  readonly adso: AdsoDomain
  readonly trfn: TrfnDomain
  readonly dtp: DtpDomain
  readonly dataSource: DataSourceDomain
  readonly processChain: ProcessChainDomain
  readonly infoObject: InfoObjectDomain
  readonly repository: RepositoryDomain
  readonly query: QueryDomain
  readonly system: SystemDomain
  readonly ddic: DdicDomain
  readonly transport: TransportDomain

  /**
   * Create a BW ADT client
   *
   * @argument baseUrlOrClient  Base url, i.e. http://vhcalnplci.local:8000
   * @argument username SAP logon user
   * @argument password Password
   * @argument client   Login client (optional)
   * @argument language Language key (optional)
   */
  constructor(
    baseUrlOrClient: string | HttpClient,
    username: string,
    password: string | BearerFetcher,
    client: string = "",
    language: string = "",
    options: ClientOptions = {}
  ) {
    if (
      !(baseUrlOrClient && username && (password || !isString(baseUrlOrClient)))
    )
      throw adtException(
        "Invalid BWAdtClient configuration: url, login and password are required"
      )
    if (typeof password !== "string") password = this.wrapFetcher(password)
    this.options = {
      baseUrlOrClient: baseUrlOrClient,
      username,
      password,
      client,
      language,
      options
    }
    this.h = this.createHttp()
    this.adso = new AdsoDomain(this.h)
    this.trfn = new TrfnDomain(this.h)
    this.dtp = new DtpDomain(this.h)
    this.dataSource = new DataSourceDomain(this.h)
    this.processChain = new ProcessChainDomain(this.h)
    this.infoObject = new InfoObjectDomain(this.h)
    this.repository = new RepositoryDomain(this.h)
    this.query = new QueryDomain(this.h)
    this.system = new SystemDomain(this.h)
    this.ddic = new DdicDomain(this.h)
    this.transport = new TransportDomain(this.h)
  }

  private createHttp() {
    const o = this.options
    return new AdtHTTP(
      o.baseUrlOrClient,
      o.username,
      o.password,
      o.client,
      o.language,
      o.options
    )
  }

  private get pIsClone() {
    return this.h.isClone
  }

  private set pIsClone(isClone: boolean) {
    this.h.isClone = isClone
  }

  private wrapFetcher: (f: BearerFetcher) => BearerFetcher = fetcher => {
    let fetchBearer: Promise<string>
    if (this.fetcher) return this.fetcher
    this.fetcher = () => {
      fetchBearer = fetchBearer || fetcher()
      return fetchBearer
    }
    return this.fetcher
  }

  public get statelessClone(): BWAdtClient {
    if (this.pIsClone) return this
    if (!this.pClone) {
      const pw = this.fetcher || this.password
      if (!pw) throw adtException("Not logged in")
      this.pClone = new BWAdtClient(
        this.baseUrl,
        this.username,
        pw,
        this.client,
        this.language,
        this.options.options
      )
      this.pClone.pIsClone = true
    }
    return this.pClone
  }

  public get stateful() {
    return this.h.stateful
  }

  public set stateful(stateful: session_types) {
    if (this.pIsClone)
      throw adtException("Stateful sessions not allowed in stateless clones")
    this.h.stateful = stateful
  }

  public get loggedin() {
    return this.h.loggedin
  }

  public get isStateful() {
    return this.h.isStateful
  }

  public get csrfToken() {
    return this.h.csrfToken
  }

  public get baseUrl() {
    return this.h.baseURL
  }

  public get client() {
    return this.h.client
  }

  public get language() {
    return this.h.language
  }

  public get username() {
    return this.h.username
  }

  private get password() {
    return this.h.password
  }

  /**
   * Logs on an ADT server. parameters provided on creation
   */
  public login() {
    // if loggedoff create a new client
    if (!this.h.username) this.h = this.createHttp()
    return this.h.login()
  }

  /**
   * Logs out current user, clearing cookies
   * NOTE: you won't be able to login again with this client
   *
   * @memberof BWAdtClient
   */
  public logout() {
    return this.h.logout()
  }

  public dropSession() {
    return this.h.dropSession()
  }

  public get sessionID() {
    const cookies = this.h.ascookies() || ""
    const sc = cookies.split(";").find(c => !!c.match(/SAP_SESSIONID/))
    return sc ? sc.split("=") : ""
  }

  public async reentranceTicket(): Promise<string> {
    const response = await this.h.request(
      "/sap/bc/adt/security/reentranceticket"
    )
    return "" + response.body || ""
  }

  // BW-specific methods will be added here
  // Examples:
  // - infoObjects(): query and manage InfoObjects
  // - transformations(): work with transformations
  // - dataTransferProcesses(): manage DTPs
  // - processChains(): execute and monitor process chains

  // ========================================
  // System Information
  // ========================================

  /**
   * Query System Information - 获取 BW 系统信息和能力
   * 对应请求: GET /sap/bw/modeling/repo/is/systeminfo
   *
   * @returns 系统能力信息
   */
  public async systemInfo() {
    const { systemInfo } = await import("./api/systemInfo")
    return systemInfo(this.h)
  }

  /**
   * Get System Property - 获取特定系统属性值
   *
   * @param propertyName - 属性名称
   * @returns 属性值或 undefined
   */
  public async getSystemProperty(propertyName: string) {
    const { getSystemProperty } = await import("./api/systemInfo")
    return getSystemProperty(this.h, propertyName)
  }

  /**
   * Check System Capability - 检查系统是否支持某个功能
   *
   * @param capabilityName - 功能属性名称
   * @returns 是否支持
   */
  public async hasCapability(capabilityName: string) {
    const { hasCapability } = await import("./api/systemInfo")
    return hasCapability(this.h, capabilityName)
  }

  // ========================================
  // Search
  // ========================================

  /**
   * Search BW Objects - 搜索 BW 对象
   * 对应请求: GET /sap/bw/modeling/repo/is/bwsearch
   *
   * @param options - 搜索选项
   * @returns 搜索结果列表
   */
  public async searchBWObjects(options: {
    searchTerm: string
    searchInName?: boolean
    searchInDescription?: boolean
    objectType?: string
    createdOnFrom?: string
    createdOnTo?: string
    changedOnFrom?: string
    changedOnTo?: string
  }) {
    const { searchBWObjects } = await import("./api/search")
    return searchBWObjects(this.h, options)
  }

  /**
   * Quick Search - 快速搜索 BW 对象
   *
   * @param searchTerm - 搜索关键词
   * @param objectType - 可选的对象类型过滤
   * @returns 搜索结果列表
   */
  public async quickSearch(searchTerm: string, objectType?: string) {
    const { quickSearch } = await import("./api/search")
    return quickSearch(this.h, searchTerm, objectType)
  }

  /**
   * Get Transformations of an InfoProvider - 获取 ADSO 关联的 Transformation
   *
   * 通过搜索对象名实现（替代 UI 导航端点 infoproviderstructure/.../trfn）。
   * 返回的 TRFN title 含 "SOURCE -> TARGET" 关系。
   *
   * @param adsoName - ADSO 技术名称
   * @returns 关联的 Transformation 列表
   */
  public async getADSOTransformations(adsoName: string) {
    const { getTransformationsOf } = await import("./api/search")
    return getTransformationsOf(this.h, adsoName)
  }

  /**
   * Get DTPs of an InfoProvider - 获取 ADSO 关联的 DTP
   *
   * 通过搜索对象名实现（替代 UI 导航端点 infoproviderstructure/.../dtpa）。
   * 返回的 DTP title 含 "SOURCE -> TARGET" 关系。
   *
   * @param adsoName - ADSO 技术名称
   * @returns 关联的 DTP 列表
   */
  public async getADSODataTransferProcesses(adsoName: string) {
    const { getDTPsOf } = await import("./api/search")
    return getDTPsOf(this.h, adsoName)
  }

  // ========================================
  // Data Flow (DMOD) Operations
  // ========================================

  /**
   * Get Dataflow Model - 获取对象的数据流血缘图
   *
   * 对应请求: GET /sap/bw/modeling/dmod/8TRANSIENT?objecttype={type}&objectname={name}&...
   *
   * 从指定对象出发展开上下游关系。返回的节点中,TRFN/DTPA 节点的
   * description 已自动解析为结构化的 relations 列表 (含 source/target)。
   *
   * 方向语义 (业务数据流角度,与 SAP 端点参数名相反):
   * - "upstream"  : 汇入 root 的来源链 (DataSource → ... → root)
   * - "downstream": root 流出的目标链 (root → ... → 消费者)
   * - "both" (默认): 同时向上、向下展开
   *
   * @param objectName - 起点对象名称 (如 "ZL_FID40")
   * @param objectType - 起点对象类型 (默认 "ADSO")
   * @param options - 展开选项 (direction, levels)
   * @returns 数据流模型 (含节点和关系)
   */
  public async getDataflow(
    objectName: string,
    objectType: string = "ADSO",
    options?: { direction?: "upstream" | "downstream" | "both"; levels?: number }
  ) {
    const { getDataflow } = await import("./api/dataflow")
    return getDataflow(this.h, objectName, objectType, options)
  }

  /**
   * Get Dataflow Lineage - 查询从指定来源到指定目标的转换和 DTP
   *
   * 典型场景: "查来源是 ZL_FID01 的 ZL_FID40 的转换和 DTP"
   *
   * @param targetName - 目标对象名称 (如 "ZL_FID40")
   * @param sourceName - 源对象名称 (如 "ZL_FID01")
   * @param targetType - 目标对象类型 (默认 "ADSO")
   * @returns 匹配的关系列表 (TRFN + DTPA)
   */
  public async getDataflowLineage(
    targetName: string,
    sourceName: string,
    targetType: string = "ADSO"
  ) {
    const { getDataflowLineage } = await import("./api/dataflow")
    return getDataflowLineage(this.h, targetName, sourceName, targetType)
  }

  // ========================================
  // Generic CRUD Operations
  // ========================================

  /**
   * Create BW Object - 创建 BW 对象（泛型方法）
   *
   * 使用 BWObject 基类进行统一的对象创建操作
   *
   * @param objectType - 对象类型
   * @param objectName - 对象名称
   * @param xmlBody - 对象 XML 内容
   * @param options - 创建选项
   * @returns 创建结果
   */
  public async createObject(
    objectType: "adso" | "trfn" | "dtpa" | "pc" | "iobj" | "area",
    objectName: string,
    xmlBody: string,
    options?: {
      parent?: string
      transport?: string
      headers?: Record<string, string>
    }
  ) {
    if (objectType === "trfn") {
      throw new Error(
        "Creating Transformation (TRFN) via API is not supported. " +
        "SAP BW server throws CX_SY_REF_IS_INITIAL in CL_RSTRAN_TRFN->GET_PROGID. " +
        "Please create Transformations manually via Eclipse ADT."
      )
    }
    const { BWObjectType, createBWObject } = await import("./api/bwObject")
    const typeMap: Record<string, keyof typeof BWObjectType> = {
      adso: "ADSO",
      trfn: "TRANSFORMATION",
      dtpa: "DTP",
      pc: "PROCESS_CHAIN",
      iobj: "INFO_OBJECT",
      area: "INFO_AREA"
    }
    const obj = createBWObject(this.h, BWObjectType[typeMap[objectType]], objectName)
    return obj.create(xmlBody, options)
  }

  /**
   * Update BW Object - 更新 BW 对象（泛型方法）
   *
   * @param objectType - 对象类型
   * @param objectName - 对象名称
   * @param xmlBody - 对象 XML 内容
   * @param options - 更新选项
   * @returns 更新结果
   */
  public async updateObject(
    objectType: "adso" | "trfn" | "dtpa" | "pc" | "iobj" | "area",
    objectName: string,
    xmlBody: string,
    options?: {
      lockHandle?: string
      transport?: string
      headers?: Record<string, string>
    }
  ) {
    const { BWObjectType, createBWObject } = await import("./api/bwObject")
    const typeMap: Record<string, keyof typeof BWObjectType> = {
      adso: "ADSO",
      trfn: "TRANSFORMATION",
      dtpa: "DTP",
      pc: "PROCESS_CHAIN",
      iobj: "INFO_OBJECT",
      area: "INFO_AREA"
    }
    const obj = createBWObject(this.h, BWObjectType[typeMap[objectType]], objectName)
    return obj.update(xmlBody, options)
  }

  /**
   * Delete BW Object - 删除 BW 对象（泛型方法）
   *
   * InfoArea: 需要先 lock 获取 lockHandle
   * 其他对象: 使用 transport 请求号
   *
   * @param objectType - 对象类型
   * @param objectName - 对象名称
   * @param lockHandleOrTransport - 锁定句柄（InfoArea）或传输请求号（其他对象）
   * @returns 删除结果
   */
  public async deleteObject(
    objectType: "adso" | "trfn" | "dtpa" | "pc" | "iobj" | "area",
    objectName: string,
    lockHandleOrTransport: string
  ) {
    const { BWObjectType, createBWObject } = await import("./api/bwObject")
    const typeMap: Record<string, keyof typeof BWObjectType> = {
      adso: "ADSO",
      trfn: "TRANSFORMATION",
      dtpa: "DTP",
      pc: "PROCESS_CHAIN",
      iobj: "INFO_OBJECT",
      area: "INFO_AREA"
    }
    const obj = createBWObject(this.h, BWObjectType[typeMap[objectType]], objectName)
    return obj.delete(lockHandleOrTransport)
  }

  /**
   * Get BW Object - 获取 BW 对象实例（泛型方法）
   *
   * 返回 BWObject 实例，可以执行 lock/unlock/activate/validate 等操作
   *
   * @param objectType - 对象类型
   * @param objectName - 对象名称
   * @returns BWObject 实例
   */
  public async getObject(
    objectType: "adso" | "trfn" | "dtpa" | "pc" | "iobj" | "area",
    objectName: string
  ) {
    const { BWObjectType, createBWObject } = await import("./api/bwObject")
    const typeMap: Record<string, keyof typeof BWObjectType> = {
      adso: "ADSO",
      trfn: "TRANSFORMATION",
      dtpa: "DTP",
      pc: "PROCESS_CHAIN",
      iobj: "INFO_OBJECT",
      area: "INFO_AREA"
    }
    return createBWObject(this.h, BWObjectType[typeMap[objectType]], objectName)
  }

  // ========================================
  // ADSO Operations
  // ========================================

  /**
   * Get ADSO Details - 获取 ADSO 详细信息
   * 对应请求: GET /sap/bw/modeling/adso/{adso_id}/m
   *
   * @param adsoId - ADSO ID (技术名称)
   * @param forceCacheUpdate - 是否强制更新缓存
   * @returns ADSO 详细信息
   */
  public async getADSO(adsoId: string, forceCacheUpdate?: boolean) {
    const { getADSO } = await import("./api/adso")
    return getADSO(this.h, adsoId, forceCacheUpdate)
  }

  /**
   * Get ADSO Details (Parsed) - 获取解析后的 ADSO 元数据
   *
   * @param adsoId - ADSO ID
   * @param forceCacheUpdate - 是否强制更新缓存
   * @returns ADSO 详细信息
   */
  public async getADSODetails(adsoId: string, forceCacheUpdate?: boolean) {
    const { getADSODetails } = await import("./api/adso")
    return getADSODetails(this.h, adsoId, forceCacheUpdate)
  }

  /**
   * Get ADSO Versions - 获取 ADSO 版本历史
   * 对应请求: GET /sap/bw/modeling/adso/{adso_id}/versions
   *
   * @param adsoId - ADSO ID
   * @returns 版本历史列表
   */
  public async getADSOVersions(adsoId: string) {
    const { getADSOVersions } = await import("./api/adso")
    return getADSOVersions(this.h, adsoId)
  }

  /**
   * Lock ADSO - 锁定 ADSO
   * 对应请求: POST /sap/bw/modeling/adso/{adso_id}?action=lock
   *
   * @param adsoId - ADSO ID
   * @returns 锁定结果（包含 lockHandle）
   */
  public async lockADSO(adsoId: string) {
    const { lockADSO } = await import("./api/adso")
    return lockADSO(this.h, adsoId)
  }

  /**
   * Unlock ADSO - 解锁 ADSO
   * 对应请求: POST /sap/bw/modeling/adso/{adso_id}?action=unlock
   *
   * @param adsoId - ADSO ID
   */
  public async unlockADSO(adsoId: string) {
    const { unlockADSO } = await import("./api/adso")
    return unlockADSO(this.h, adsoId)
  }

  /**
   * Activate ADSO - 激活 ADSO
   * 对应请求: POST /sap/bw/modeling/activation
   *
   * @param adsoId - ADSO ID
   * @param lockHandle - 锁定句柄
   * @param corrNr - 传输请求号（可选）
   * @returns 激活结果
   */
  public async activateADSO(adsoId: string, lockHandle?: string, corrNr?: string) {
    const { activateADSO } = await import("./api/adso")
    return activateADSO(this.h, adsoId, lockHandle || "", corrNr || "")
  }

  /**
   * Check ADSO - 检查 ADSO 一致性
   *
   * @param adsoId - ADSO ID
   * @returns 检查结果
   */
  public async checkADSO(adsoId: string) {
    const { checkADSO } = await import("./api/adso")
    return checkADSO(this.h, adsoId)
  }

  /**
   * Update ADSO - 更新 ADSO 元数据
   * 对应请求: PUT /sap/bw/modeling/adso/{adso_id}/m?lockHandle=xxx
   *
   * @param adsoId - ADSO ID
   * @param xmlContent - ADSO XML 内容（完整的 dataStore 定义）
   * @param lockHandle - 锁定句柄
   * @param options - 其他选项（corrNr, timestamp）
   * @returns 更新结果
   */
  public async updateADSO(
    adsoId: string,
    xmlContent: string,
    lockHandle: string,
    options?: { corrNr?: string; timestamp?: string }
  ) {
    const { updateADSO } = await import("./api/adso")
    return updateADSO(this.h, adsoId, xmlContent, {
      lockHandle,
      corrNr: options?.corrNr,
      timestamp: options?.timestamp
    })
  }

  /**
   * Get ADSO Raw XML - 获取 ADSO 原始 XML (供 PUT 使用)
   */
  public async getADSOXml(adsoId: string, forceCacheUpdate?: boolean) {
    const { getADSOXml } = await import("./api/adso")
    return getADSOXml(this.h, adsoId, forceCacheUpdate)
  }

  /**
   * Save and Activate ADSO - 完整的 ADSO 修改保存激活流程
   *
   * 对照 Eclipse Communication Log (ZL_FID37 加 field):
   *   1. lock (stateful)
   *   2. transportCheck / createTransport (如需要)
   *   3. PUT .../m?corrNr=&lockHandle= (stateless, 可带 timestamp 头)
   *   4. activation (stateless)
   *   5. unlock (stateful)
   */
  /** @deprecated Prefer `client.adso.saveAndActivate` */
  public async saveAndActivateADSO(
    adsoId: string,
    xmlContent: string,
    options?: {
      transport?: string
      createTransport?: boolean
      transportDescription?: string
      autoActivate?: boolean
      timestamp?: string
    }
  ) {
    const { saveAndActivateADSO } = await import("./api/adso")
    return saveAndActivateADSO(this.h, adsoId, xmlContent, options)
  }

  /**
   * Add Field to ADSO - 向 ADSO 添加 field 类型本地字段并保存激活
   *
   * @param adsoId - ADSO 技术名称
   * @param field - field 类型字段定义
   * @param options - 传输/激活选项
   */
  public async addADSOField(
    adsoId: string,
    field: {
      name: string
      dataType?: "CHAR" | "NUMC" | "DATS" | "TIMS" | "DEC" | "CUKY" | "CURR" | "QUAN" | "INT4" | "FLTP"
      length?: number
      label?: string
      dimension?: string
      semanticType?: string
      precision?: number
      scale?: number
    },
    options?: {
      transport?: string
      createTransport?: boolean
      transportDescription?: string
      autoActivate?: boolean
    }
  ) {
    const { getADSOXml, addADSOFieldToXml } = await import("./api/adso")
    const xml = await getADSOXml(this.h, adsoId, true)
    const nextXml = addADSOFieldToXml(xml, field)
    return this.saveAndActivateADSO(adsoId, nextXml, options)
  }

  /**
   * Get ADSO Configuration - 获取 ADSO 配置信息
   * 对应请求: GET /sap/bw/modeling/adso/{adso_id}/configuration
   *
   * @param adsoId - ADSO ID
   * @returns ADSO 配置信息
   */
  public async getADSOConfiguration(adsoId: string) {
    const { getADSOConfiguration } = await import("./api/adso")
    return getADSOConfiguration(this.h, adsoId)
  }

  /**
   * Validate InfoArea - 验证 InfoArea 是否存在
   * 对应请求: POST /sap/bw/modeling/validation?objectType=AREA&objectName={name}&action=exists
   *
   * @param infoAreaName - InfoArea 名称
   * @returns 验证结果
   */
  public async validateInfoArea(infoAreaName: string) {
    const { validateInfoArea } = await import("./api/adso")
    return validateInfoArea(this.h, infoAreaName)
  }

  /**
   * Validate Template ADSO - 验证模板 ADSO 是否存在
   * 对应请求: POST /sap/bw/modeling/validation?objectType=ADSO&objectName={name}&action=exists
   *
   * @param templateName - 模板 ADSO 名称
   * @returns 验证结果
   */
  public async validateTemplateADSO(templateName: string) {
    const { validateTemplateADSO } = await import("./api/adso")
    return validateTemplateADSO(this.h, templateName)
  }

  /**
   * Validate New ADSO Name - 验证新 ADSO 名称是否可用
   * 对应请求: POST /sap/bw/modeling/validation?objectType=ADSO&objectName={name}&action=new
   *
   * @param adsoName - ADSO 名称
   * @returns 验证结果
   */
  public async validateNewADSOName(adsoName: string) {
    const { validateNewADSOName } = await import("./api/adso")
    return validateNewADSOName(this.h, adsoName)
  }

  /**
   * Create ADSO - 创建 ADSO
   * 对应请求: POST /sap/bw/modeling/adso/{name}?lockHandle={lockHandle}
   *
   * 创建 ADSO 的完整流程:
   * 1. 验证 InfoArea 存在
   * 2. 验证模板存在 (如果提供)
   * 3. 验证新名称可用
   * 4. 锁定对象
   * 5. 创建 ADSO
   * 6. 解锁对象
   *
   * @param options - 创建选项
   * @returns 创建结果 (包含 lockHandle)
   */
  public async createADSO(options: {
    name: string                          // ADSO 技术名称
    description: string                   // 描述
    infoArea: string                      // InfoArea
    masterLanguage?: string               // 主语言 (默认: EN)
    responsible?: string                  // 负责人用户名 (默认: 当前用户)
    masterSystem?: string                 // 主系统 (默认: BPD)
    // 模板选项 (5种创建方式)
    template?: {
      objectName: string                  // 模板对象名称
      type: "ADSO" | "DSO" | "IOBJ" | "ISRC" | ""  // 模板类型
    }
    // ADSO 属性
    activateData?: boolean                // 激活数据 (默认: true)
    writeChangelog?: boolean              // 写入变更日志 (默认: true)
    readOnly?: boolean                    // 只读 (默认: false)
    autoActivate?: boolean                // 创建后自动激活 (默认: false)
  }) {
    const { createADSOFull } = await import("./api/adso")
    return createADSOFull(this.h, {
      ...options,
      masterLanguage: options.masterLanguage ?? "EN",
      responsible: options.responsible ?? this.username,
      masterSystem: options.masterSystem ?? "BPD"
    })
  }

  /**
   * Get ADSO Node Path - 获取 ADSO 节点路径
   * 对应请求: GET /sap/bw/modeling/repo/nodepath?objectUri={uri}
   *
   * @param adsoName - ADSO 名称
   * @param version - 版本 (m=active, a=modified, d=revised, 默认: m)
   * @returns 节点路径列表
   */
  public async getADSONodePath(adsoName: string, version?: "m" | "a" | "d") {
    const { getADSONodePath } = await import("./api/adso")
    return getADSONodePath(this.h, adsoName, version)
  }

  // ========================================
  // Transformation Operations
  // CREATE: createTransformation() —— 8TRANSIENT 瞬态流（Eclipse 新建向导同款）
  // ========================================

  /**
   * Lock Transformation - 锁定转换
   * 对应请求: POST /sap/bw/modeling/trfn/{trfn_id}?action=lock
   *
   * @param trfnId - Transformation ID
   * @returns 锁定结果（包含 lockHandle）
   */
  public async lockTransformation(trfnId: string) {
    const { lockTransformation } = await import("./api/transformation")
    return lockTransformation(this.h, trfnId)
  }

  /**
   * Unlock Transformation - 解锁转换
   * 对应请求: POST /sap/bw/modeling/trfn/{trfn_id}?action=unlock
   *
   * @param trfnId - Transformation ID
   */
  public async unlockTransformation(trfnId: string) {
    const { unlockTransformation } = await import("./api/transformation")
    return unlockTransformation(this.h, trfnId)
  }

  /**
   * Get Transformation Metadata - 获取转换元数据
   *
   * @param trfnId - Transformation ID
   * @param version - 版本 (m=active, a=modified, d=revised)
   * @param options - 获取选项 (forceCacheUpdate)
   * @returns Transformation 元数据
   */
  public async getTransformation(
    trfnId: string,
    version?: "m" | "a" | "d",
    options?: { forceCacheUpdate?: boolean }
  ) {
    const { getTransformation } = await import("./api/transformation")
    return getTransformation(this.h, trfnId, version, options)
  }

  /**
   * Activate Object - 激活 BW 对象
   * 对应请求: POST /sap/bw/modeling/activation
   *
   * @param objectUri - 对象 URI
   * @param lockHandle - 锁定句柄
   * @param version - 版本
   * @returns 激活结果
   */
  public async activateObject(
    objectUri: string,
    lockHandle: string,
    version?: "active" | "inactive"
  ) {
    const { activateObject } = await import("./api/common")
    return activateObject(this.h, objectUri, lockHandle, version)
  }

  /**
   * Activate Transformation - 激活转换
   *
   * @param trfnId - Transformation ID
   * @returns 激活结果
   */
  public async activateTransformation(trfnId: string, lockHandle?: string) {
    const { activateTransformation } = await import("./api/transformation")
    return activateTransformation(this.h, trfnId, lockHandle || "")
  }

  /**
   * Get Transformation Details - 获取转换详细信息（解析后）
   *
   * @param trfnId - Transformation ID
   * @param version - 版本 (m=active, a=modified, d=revised)
   * @param options - 获取选项 (forceCacheUpdate)
   * @returns 转换详细信息
   */
  public async getTransformationDetails(
    trfnId: string,
    version?: "m" | "a" | "d",
    options?: { forceCacheUpdate?: boolean }
  ) {
    const { getTransformationDetails } = await import("./api/transformation")
    return getTransformationDetails(this.h, trfnId, version, options)
  }

  /**
   * Get Transformation Versions - 获取转换版本历史
   * 对应请求: GET /sap/bw/modeling/trfn/{trfn_id}/versions
   *
   * @param trfnId - Transformation ID
   * @returns 版本历史列表
   */
  public async getTransformationVersions(trfnId: string) {
    const { getTransformationVersions } = await import("./api/transformation")
    return getTransformationVersions(this.h, trfnId)
  }

  /**
   * Check Transformation - 检查转换一致性
   *
   * @param trfnId - Transformation ID
   * @returns 检查结果
   */
  public async checkTransformation(trfnId: string) {
    const { checkTransformation } = await import("./api/transformation")
    return checkTransformation(this.h, trfnId)
  }

  /**
   * Update Transformation - 更新转换内容
   * 对应请求: PUT /sap/bw/modeling/trfn/{trfn_id}/{version}?lockHandle={lockHandle}
   *
   * @param trfnId - Transformation ID
   * @param content - Transformation XML 内容
   * @param lockHandle - 锁定句柄
   * @param version - 版本 (默认 "m" = active)
   * @returns 更新结果
   */
  public async updateTransformation(
    trfnId: string,
    xmlContent: string,
    options: { lockHandle: string; corrNr?: string; timestamp?: string },
    version: "m" | "a" | "d" = "m"
  ) {
    const { updateTransformation } = await import("./api/transformation")
    return updateTransformation(this.h, trfnId, xmlContent, options, version)
  }

  /**
   * Get Transformation Raw XML - 获取原始 XML (供 PUT 使用)
   */
  public async getTransformationXml(
    trfnId: string,
    version: "m" | "a" | "d" = "m",
    options?: { forceCacheUpdate?: boolean }
  ) {
    const { getTransformationXml } = await import("./api/transformation")
    return getTransformationXml(this.h, trfnId, version, options)
  }

  /**
   * Save and Activate Transformation - 完整的 TRFN 修改保存激活流程
   *
   * 对照 Eclipse setFields Communication Log:
   *   lock → transportchecks → PUT (lockHandle + Transport-Lock-Holder + timestamp) → activation → unlock
   */
  /** @deprecated Prefer `client.trfn.saveAndActivate` */
  /**
   * Create Transformation —— 8TRANSIENT 瞬态流创建转换（Eclipse 新建向导同款）。
   * 返回服务器生成的 trfnId 与水合后 XML；packageName 非 $TMP 时需 transport。
   */
  public async createTransformation(options: {
    sourceObjName: string
    targetObjName: string
    sourceObjType?: string
    targetObjType?: string
    packageName?: string
    transport?: string
    description?: string
    responsible?: string
    masterSystem?: string
    masterLanguage?: string
  }) {
    const { createTransformation } = await import("./api/transformation")
    return createTransformation(this.h, options)
  }

  /**
   * Create DTP —— 通用对象 POST 流创建 DTP（CREA lock + collection POST）。
   * 创建后为 inactive，配置 filter/抽取模式后再 saveAndActivateDTP。
   */
  public async createDTP(options: {
    id?: string
    sourceName: string
    targetName: string
    transformId: string
    extractionMode?: "F" | "D"
    packageName?: string
    transport?: string
    description?: string
    responsible?: string
    masterSystem?: string
  }) {
    const { createDTP } = await import("./api/dtp")
    return createDTP(this.h, options)
  }

  public async saveAndActivateTransformation(
    trfnId: string,
    xmlContent: string,
    options?: {
      transport?: string
      createTransport?: boolean
      transportDescription?: string
      autoActivate?: boolean
      timestamp?: string
    }
  ) {
    const { saveAndActivateTransformation } = await import("./api/transformation")
    return saveAndActivateTransformation(this.h, trfnId, xmlContent, options)
  }

  /**
   * Set End Routine Fields - 将目标字段勾进结束例程 setFields 并保存激活
   *
   * 对照 Eclipse SetGlobalRoutineFieldsAction:
   * 在 END routine 增加 elementRef, 必要时补 StepNoUpdate 规则。
   */
  public async setEndRoutineFields(
    trfnId: string,
    fieldNames: string[],
    options?: {
      transport?: string
      createTransport?: boolean
      transportDescription?: string
      autoActivate?: boolean
    }
  ) {
    const {
      getTransformationXml,
      addFieldToEndRoutine
    } = await import("./api/transformation")

    let xml = await getTransformationXml(this.h, trfnId, "m", {
      forceCacheUpdate: true
    })
    for (const name of fieldNames) {
      xml = addFieldToEndRoutine(xml, name)
    }
    return this.saveAndActivateTransformation(trfnId, xml, {
      ...options,
      transportDescription:
        options?.transportDescription ||
        `API set end routine fields: ${fieldNames.join(",")}`
    })
  }

  /**
   * Add Transformation Rule (纯 XML 辅助) - 往 TRFN XML 插入一条 DIRECT 映射 rule
   *
   * 对照 Eclipse (2026-07-16 PUT body): 在 Rules group (type="S") 中插入
   * sourceField → targetField 的 StepDirect 规则。source/target 字段必须已存在于
   * TRFN 结构 (ADSO/DataSource 加字段并同步后即满足)。
   *
   * 返回新 XML (不触发网络), 配合 saveAndActivateTransformation 保存。
   */
  public addTransformationRule(
    trfnXml: string,
    sourceField: string,
    targetField?: string
  ): string {
    // 纯函数, 但保持与同类 helper 一致的实例方法风格; 动态 import 避免顶层依赖
    const transformation = require("./api/transformation") as typeof import("./api/transformation")
    return transformation.addTransformationRule(trfnXml, sourceField, targetField)
  }

  /**
   * Auto Map Transformation Fields (纯 XML 辅助) - 批量同名 source→target 映射
   *
   * 扫描 source/target segment 同名字段, 为每个未映射的生成 DIRECT rule
   * (模拟 Eclipse "Auto Map")。返回 { xml, mapped }。
   */
  public autoMapTransformationFields(
    trfnXml: string
  ): { xml: string; mapped: string[] } {
    const transformation = require("./api/transformation") as typeof import("./api/transformation")
    return transformation.autoMapTransformationFields(trfnXml)
  }

  /**
   * Add Transformation Rule and Save - 一站式: 加映射 rule 并保存激活
   *
   * 读取当前 TRFN → 插入 rule(s) → saveAndActivate。
   *
   * @param trfnId - TRFN ID
   * @param rules - 映射规则列表 [{ source, target? }]; target 省略则同名
   * @param options - transport / autoActivate
   */
  public async addTransformationRulesAndSave(
    trfnId: string,
    rules: Array<{ source: string; target?: string }>,
    options?: {
      transport?: string
      createTransport?: boolean
      transportDescription?: string
      autoActivate?: boolean
    }
  ) {
    const {
      getTransformationXml,
      addTransformationRule
    } = await import("./api/transformation")

    let xml = await getTransformationXml(this.h, trfnId, "m", {
      forceCacheUpdate: true
    })
    for (const r of rules) {
      xml = addTransformationRule(xml, r.source, r.target)
    }
    return this.saveAndActivateTransformation(trfnId, xml, {
      ...options,
      transportDescription:
        options?.transportDescription ||
        `API add rules: ${rules.map(r => `${r.source}→${r.target || r.source}`).join(",")}`
    })
  }

  /**
   * Auto Map and Save - 一站式: 批量同名映射并保存激活
   *
   * @param trfnId - TRFN ID
   * @param options - transport / autoActivate
   * @returns saveAndActivate 结果 + 已映射字段列表
   */
  public async autoMapTransformationFieldsAndSave(
    trfnId: string,
    options?: {
      transport?: string
      createTransport?: boolean
      transportDescription?: string
      autoActivate?: boolean
    }
  ) {
    const {
      getTransformationXml,
      autoMapTransformationFields
    } = await import("./api/transformation")

    const xml = await getTransformationXml(this.h, trfnId, "m", {
      forceCacheUpdate: true
    })
    const { xml: mappedXml, mapped } = autoMapTransformationFields(xml)

    const result = await this.saveAndActivateTransformation(trfnId, mappedXml, {
      ...options,
      transportDescription:
        options?.transportDescription ||
        `API auto map: ${mapped.length} fields`
    })
    return { ...result, mapped }
  }

  /**
   * Get Transformation Class Metadata - 获取转换关联的 ABAP 类元数据
   *
   * 从转换元数据中提取 abapProgram 属性，获取对应的 ABAP 类信息
   *
   * @param trfnId - Transformation ID
   * @param options - 获取选项 (version, forceCacheUpdate)
   * @returns ABAP 类元数据
   */
  public async getTransformationClass(trfnId: string, options?: {
    version?: "m" | "a" | "d"
    forceCacheUpdate?: boolean
  }) {
    const { getTransformation, extractAbapClassName } = await import("./api/transformation")
    const { getAbapClassMetadata } = await import("./api/abapClass")

    const trfnRaw = await getTransformation(this.h, trfnId, options?.version, {
      forceCacheUpdate: options?.forceCacheUpdate
    })

    const className = extractAbapClassName(trfnRaw)
    if (!className) {
      throw new Error(`No ABAP class found for transformation ${trfnId}`)
    }

    return getAbapClassMetadata(this.h, className)
  }

  /**
   * Get Transformation Class Source - 获取转换关联的 ABAP 类源代码
   *
   * 获取转换的 ABAP 类（用于 start/end/expert routines）的源代码
   *
   * @param trfnId - Transformation ID
   * @param options - 获取选项 (version, forceCacheUpdate, classVersion)
   * @returns ABAP 类源代码信息
   */
  public async getTransformationClassSource(trfnId: string, options?: {
    version?: "m" | "a" | "d"
    forceCacheUpdate?: boolean
    classVersion?: "active" | "inactive" | "workingArea"
  }) {
    const { getTransformation, extractAbapClassName } = await import("./api/transformation")
    const { getAbapClassSource } = await import("./api/abapClass")

    const trfnRaw = await getTransformation(this.h, trfnId, options?.version, {
      forceCacheUpdate: options?.forceCacheUpdate
    })

    const className = extractAbapClassName(trfnRaw)
    if (!className) {
      throw new Error(`No ABAP class found for transformation ${trfnId}`)
    }

    return getAbapClassSource(this.h, className, options?.classVersion)
  }

  /**
   * Save and Activate Transformation Class Source - 保存并激活转换例程 ABAP 类
   *
   * 对照 Eclipse 结束例程编辑器保存/激活 Communication Log:
   *   1. LOCK class (_action=LOCK&accessMode=MODIFY) [stateful]
   *   2. PUT .../source/main?lockHandle=...         [stateless]
   *   3. UNLOCK class (_action=UNLOCK)               [stateful]
   *   4. POST /sap/bc/adt/activation                 [stateless]
   *   5. (关闭编辑器后) lock TRFN → PUT → modeling/activation → unlock
   *
   * @param trfnId - Transformation ID
   * @param sourceCode - 完整类源码
   * @param options.activateTransformation - 是否接着激活 TRFN (默认 true)
   */
  public async saveAndActivateTransformationClassSource(
    trfnId: string,
    sourceCode: string,
    options?: {
      activateTransformation?: boolean
      transport?: string
      createTransport?: boolean
      transportDescription?: string
    }
  ) {
    const { getTransformation, extractAbapClassName } = await import(
      "./api/transformation"
    )
    const { saveAndActivateAbapClassSource } = await import("./api/abapClass")

    const trfnRaw = await getTransformation(this.h, trfnId, "m", {
      forceCacheUpdate: true
    })
    const className = extractAbapClassName(trfnRaw)
    if (!className) {
      throw new Error(`No ABAP class found for transformation ${trfnId}`)
    }

    const classResult = await saveAndActivateAbapClassSource(
      this.h,
      className,
      sourceCode
    )

    const activateTrfn = options?.activateTransformation ?? true
    let trfnResult
    if (activateTrfn) {
      const xml = await this.getTransformationXml(trfnId, "m", {
        forceCacheUpdate: true
      })
      trfnResult = await this.saveAndActivateTransformation(trfnId, xml, {
        transport: options?.transport,
        transportDescription:
          options?.transportDescription || "API activate after routine edit"
      })
    }

    return {
      className,
      classResult,
      trfnResult
    }
  }

  /**
   * Update Transformation Class Source - 更新转换关联的 ABAP 类源代码
   *
   * 更新转换的 ABAP 类源代码（用于修改 start/end/expert routines）
   *
   * @param trfnId - Transformation ID
   * @param sourceCode - ABAP 源代码
   * @param lockHandle - 锁定句柄
   * @param options - 选项
   * @returns 更新结果（包含 etag 和 lastModified）
   */
  public async updateTransformationClassSource(
    trfnId: string,
    sourceCode: string,
    lockHandle: string,
    options?: { version?: "m" | "a" | "d"; forceCacheUpdate?: boolean }
  ) {
    const { getTransformation, extractAbapClassName } = await import("./api/transformation")
    const { updateAbapClassSource } = await import("./api/abapClass")

    const trfnRaw = await getTransformation(this.h, trfnId, options?.version, {
      forceCacheUpdate: options?.forceCacheUpdate
    })

    const className = extractAbapClassName(trfnRaw)
    if (!className) {
      throw new Error(`No ABAP class found for transformation ${trfnId}`)
    }

    return updateAbapClassSource(this.h, className, sourceCode, lockHandle)
  }

  /**
   * Switch Transformation Runtime - 切换转换运行时模式
   *
   * 在 HANA 运行时和 ABAP 运行时之间切换
   * 注意：切换到 ABAP 运行时后才能使用 start/end/expert routines
   *
   * @param trfnId - Transformation ID
   * @param useHanaRuntime - 是否使用 HANA 运行时 (true=HANA, false=ABAP)
   * @param lockHandle - 锁定句柄
   * @param options - 选项
   * @returns 更新结果
   */
  public async switchTransformationRuntime(
    trfnId: string,
    useHanaRuntime: boolean,
    lockHandle: string,
    options?: { version?: "m" | "a" | "d"; corrNr?: string; timestamp?: string }
  ) {
    const { getTransformation, switchTransformationRuntime, updateTransformation } = await import("./api/transformation")

    // Get current transformation XML
    const trfnRaw = await getTransformation(this.h, trfnId, options?.version)
    const xmlContent = switchTransformationRuntime(
      typeof trfnRaw === "string" ? trfnRaw : JSON.stringify(trfnRaw),
      useHanaRuntime
    )

    return updateTransformation(this.h, trfnId, xmlContent, {
      lockHandle,
      corrNr: options?.corrNr,
      timestamp: options?.timestamp
    }, options?.version)
  }

  /**
   * Lock Transformation Class - 锁定转换关联的 ABAP 类
   *
   * @param trfnId - Transformation ID
   * @param options - 选项
   * @returns 锁定结果
   */
  public async lockTransformationClass(trfnId: string, options?: {
    version?: "m" | "a" | "d"
    forceCacheUpdate?: boolean
  }) {
    const { getTransformation, extractAbapClassName } = await import("./api/transformation")
    const { lockAbapClass } = await import("./api/abapClass")

    const trfnRaw = await getTransformation(this.h, trfnId, options?.version, {
      forceCacheUpdate: options?.forceCacheUpdate
    })

    const className = extractAbapClassName(trfnRaw)
    if (!className) {
      throw new Error(`No ABAP class found for transformation ${trfnId}`)
    }

    return lockAbapClass(this.h, className)
  }

  /**
   * Unlock Transformation Class - 解锁转换关联的 ABAP 类
   *
   * @param trfnId - Transformation ID
   * @param lockHandle - 锁定句柄
   * @param options - 选项
   */
  public async unlockTransformationClass(
    trfnId: string,
    lockHandle: string,
    options?: { version?: "m" | "a" | "d"; forceCacheUpdate?: boolean }
  ) {
    const { getTransformation, extractAbapClassName } = await import("./api/transformation")
    const { unlockAbapClass } = await import("./api/abapClass")

    const trfnRaw = await getTransformation(this.h, trfnId, options?.version, {
      forceCacheUpdate: options?.forceCacheUpdate
    })

    const className = extractAbapClassName(trfnRaw)
    if (!className) {
      throw new Error(`No ABAP class found for transformation ${trfnId}`)
    }

    return unlockAbapClass(this.h, className, lockHandle)
  }

  // ========================================
  // InfoObject Operations
  // ========================================

  /**
   * Get InfoObject Details - 获取 InfoObject 详细信息
   * 对应请求: GET /sap/bw/modeling/iobj/{iobj_name}/a
   *
   * @param iobjName - InfoObject 名称 (如 0NAME, 0CUSTOMER)
   * @param options - 查询选项
   * @returns InfoObject 详细信息
   */
  public async getInfoObject(
    iobjName: string,
    options?: { notransientinfoobject?: boolean; lastChangedTimestampDb?: boolean }
  ) {
    const { getInfoObject } = await import("./api/infoobject")
    return getInfoObject(this.h, iobjName, options)
  }

  /**
   * Get InfoObject Metadata - 获取 InfoObject 元数据
   * 对应请求: GET /sap/bw/modeling/iobj/{iobj_name}/m
   *
   * @param iobjName - InfoObject 名称
   * @returns InfoObject 元数据
   */
  public async getInfoObjectMetadata(iobjName: string) {
    const { getInfoObjectMetadata } = await import("./api/infoobject")
    return getInfoObjectMetadata(this.h, iobjName)
  }

  // ========================================
  // Data Transfer Process (DTP) Operations
  // ========================================

  /**
   * Get DTP Details - 获取 DTP 详细信息
   * 对应请求: GET /sap/bw/modeling/dtpa/{dtp_id}/m
   *
   * @param dtpId - DTP ID (格式: DTP_*)
   * @param forceCacheUpdate - 是否强制更新缓存
   * @returns DTP 详细信息
   */
  public async getDTP(dtpId: string, forceCacheUpdate?: boolean) {
    const { getDTP } = await import("./api/dtp")
    return getDTP(this.h, dtpId, forceCacheUpdate)
  }

  /**
   * Get DTP Raw XML - 获取 DTP 原始 XML 字符串（供 PUT update 使用）
   * 对应请求: GET /sap/bw/modeling/dtpa/{dtp_id}/m
   *
   * 与 getDTP 同端点，但不解析，直接返回原始 XML 字符串（对称于
   * getADSOXml / getTransformationXml）。
   *
   * @param dtpId - DTP ID (格式: DTP_*)
   * @param forceCacheUpdate - 是否强制更新缓存
   * @returns DTP 原始 XML 字符串
   */
  public async getDTPXml(dtpId: string, forceCacheUpdate?: boolean) {
    const { getDTPXml } = await import("./api/dtp")
    return getDTPXml(this.h, dtpId, forceCacheUpdate)
  }

  /**
   * Get DTP Details (Parsed) - 获取解析后的 DTP 元数据
   *
   * @param dtpId - DTP ID
   * @param forceCacheUpdate - 是否强制更新缓存
   * @returns DTP 详细信息
   */
  public async getDTPDetails(dtpId: string, forceCacheUpdate?: boolean) {
    const { getDTPDetails } = await import("./api/dtp")
    return getDTPDetails(this.h, dtpId, forceCacheUpdate)
  }

  /**
   * Get DTP Versions - 获取 DTP 版本历史
   * 对应请求: GET /sap/bw/modeling/dtpa/{dtp_id}/versions
   *
   * @param dtpId - DTP ID
   * @returns 版本历史列表
   */
  public async getDTPVersions(dtpId: string) {
    const { getDTPVersions } = await import("./api/dtp")
    return getDTPVersions(this.h, dtpId)
  }

  /**
   * Lock DTP - 锁定 DTP
   * 对应请求: POST /sap/bw/modeling/dtpa/{dtp_id}?action=lock
   *
   * @param dtpId - DTP ID
   * @returns 锁定结果（包含 lockHandle）
   */
  public async lockDTP(dtpId: string) {
    const { lockDTP } = await import("./api/dtp")
    return lockDTP(this.h, dtpId)
  }

  /**
   * Unlock DTP - 解锁 DTP
   * 对应请求: POST /sap/bw/modeling/dtpa/{dtp_id}?action=unlock
   *
   * @param dtpId - DTP ID
   */
  public async unlockDTP(dtpId: string) {
    const { unlockDTP } = await import("./api/dtp")
    return unlockDTP(this.h, dtpId)
  }

  /**
   * Activate DTP - 激活 DTP
   * 对应请求: POST /sap/bw/modeling/activation
   *
   * @param dtpId - DTP ID
   * @param lockHandle - 锁定句柄
   * @param corrNr - 传输请求号（可选）
   * @returns 激活结果
   */
  public async activateDTP(dtpId: string, lockHandle?: string, corrNr?: string) {
    const { activateDTP } = await import("./api/dtp")
    return activateDTP(this.h, dtpId, lockHandle || "", corrNr || "")
  }

  /**
   * Activate DTP with lock/unlock - 独立激活 DTP（锁→激活→解锁）
   *
   * 用于转换修改后 DTP 被取消激活、需要重新激活且不改变内容的场景。
   *
   * @param dtpId - DTP ID
   * @returns 激活结果 + lockHandle
   */
  public async activateDTPWithLock(dtpId: string) {
    return this.dtp.activate(dtpId)
  }

  /**
   * Check DTP - 检查 DTP 一致性（只读，不激活）
   *
   * @param dtpId - DTP ID
   * @returns 检查结果
   */
  public async checkDTP(dtpId: string) {
    const { checkDTP } = await import("./api/dtp")
    return checkDTP(this.h, dtpId)
  }

  /**
   * Execute DTP - 执行 DTP
   * 对应请求: POST /sap/bw/modeling/dtpa/{dtp_id}?action=execute
   *
   * @param dtpId - DTP ID
   * @returns 执行结果
   */
  public async executeDTP(dtpId: string) {
    const { executeDTP } = await import("./api/dtp")
    return executeDTP(this.h, dtpId)
  }

  /**
   * Update DTP - 更新 DTP 内容
   * 对应请求: PUT /sap/bw/modeling/dtpa/{dtp_id}/m?corrNr={tr}&lockHandle={handle}
   *
   * @param dtpId - DTP ID
   * @param xmlContent - DTP XML 内容
   * @param lockHandle - 锁定句柄
   * @param transport - 传输请求号 (作为 corrNr 传递)
   * @returns 更新结果
   */
  public async updateDTP(
    dtpId: string,
    xmlContent: string,
    lockHandle: string,
    transport?: string
  ) {
    const { BWObjectType, createBWObject } = await import("./api/bwObject")
    const obj = createBWObject(this.h, BWObjectType.DTP, dtpId)
    return obj.update(xmlContent, { lockHandle, transport })
  }

  // ========================================
  // Transport (CTS) Operations
  // ========================================

  /**
   * Transport Check - 检查对象保存/修改是否需要传输请求
   * 对应请求: POST /sap/bc/adt/cts/transportchecks
   *
   * 返回可用的传输请求列表 (TRANSPORTS) 和是否需要记录 (RECORDING)。
   *
   * @param objectUri - 对象 URI (如 "/sap/bw/modeling/dtpa/dtp_xxx/m")
   * @param devclass - 开发包 (可选)
   * @param operation - 操作类型 (默认 "I"=插入)
   * @returns 传输检查信息
   */
  public async transportCheck(
    objectUri: string,
    devclass: string = "",
    operation: string = "I"
  ) {
    const { transportCheck } = await import("./api/transport")
    return transportCheck(this.h, objectUri, devclass, operation)
  }

  /**
   * Create Transport - 新建传输请求
   * 对应请求: POST /sap/bc/adt/cts/transports
   *
   * @param refUri - 参考对象 URI
   * @param description - 传输请求描述
   * @param devclass - 开发包 (可选)
   * @returns 新建的传输请求号 (如 "BPDK903265")
   */
  public async createTransport(
    refUri: string,
    description: string,
    devclass: string = ""
  ) {
    const { createTransport } = await import("./api/transport")
    return createTransport(this.h, refUri, description, devclass)
  }

  /**
   * Save and Activate DTP - 完整的 DTP 修改保存激活流程
   *
   * 封装 Eclipse 的完整写操作序列 (会话模型见 BWObject.lock 注释):
   *   1. lock (stateful 会话, 持锁至 unlock)
   *   2. transportCheck (stateless, 检查是否需要 TR)
   *   3. createTransport (如需要,新建 TR)
   *   4. PUT update (stateless, lockHandle 由服务端查 enqueue 锁表验证)
   *   5. activation (stateless)
   *   6. unlock (回到持锁的 stateful 会话)
   *
   * @param dtpId - DTP ID
   * @param xmlContent - 修改后的 DTP XML 内容
   * @param options - 选项 (transport 已有TR号 / autoActivate 是否自动激活)
   * @returns 保存激活结果 (含使用的 transport 号)
   */
  /** @deprecated Prefer `client.dtp.saveAndActivate` */
  public async saveAndActivateDTP(
    dtpId: string,
    xmlContent: string,
    options?: {
      transport?: string         // 已有的 TR 号
      createTransport?: boolean // 需要记录且未指定 transport 时新建
      transportDescription?: string // 新建 TR 的描述 (默认 "API update")
      autoActivate?: boolean     // 是否自动激活 (默认 true)
    }
  ) {
    const { saveAndActivateDTP } = await import("./api/dtp")
    return saveAndActivateDTP(this.h, dtpId, xmlContent, options)
  }

  // ========================================
  // DataSource (RSDS) Operations
  // ========================================

  /**
   * Get DataSource (raw) - 获取 DataSource 原始元数据 (fullParse 后对象)
   * 对应请求: GET /sap/bw/modeling/rsds/{datasource}/{sourceSystem}/m
   *
   * @param datasource - DataSource 技术名 (如 "ZBW_ZFIVTASK_STAGE_H")
   * @param sourceSystem - 源系统逻辑名 (如 "S4DCLNT300")
   * @param forceCacheUpdate - 是否强制更新缓存
   */
  public async getDataSource(
    datasource: string,
    sourceSystem: string,
    forceCacheUpdate?: boolean
  ) {
    const { getDataSource } = await import("./api/datasource")
    return getDataSource(this.h, datasource, sourceSystem, forceCacheUpdate)
  }

  /**
   * Get DataSource XML (raw string) - 获取 DataSource 原始 XML 字符串
   * 用于 PUT 写操作前读取当前内容。
   *
   * @param datasource - DataSource 技术名
   * @param sourceSystem - 源系统逻辑名
   * @param forceCacheUpdate - 是否强制更新缓存
   */
  public async getDataSourceXml(
    datasource: string,
    sourceSystem: string,
    forceCacheUpdate?: boolean
  ) {
    const { getDataSourceXml } = await import("./api/datasource")
    return getDataSourceXml(this.h, datasource, sourceSystem, forceCacheUpdate)
  }

  /**
   * Get DataSource Details (parsed) - 获取解析后的 DataSource 详情
   *
   * @param datasource - DataSource 技术名
   * @param sourceSystem - 源系统逻辑名
   * @param forceCacheUpdate - 是否强制更新缓存
   */
  public async getDataSourceDetails(
    datasource: string,
    sourceSystem: string,
    forceCacheUpdate?: boolean
  ) {
    const { getDataSourceDetails } = await import("./api/datasource")
    return getDataSourceDetails(this.h, datasource, sourceSystem, forceCacheUpdate)
  }

  /**
   * Get DataSource Versions - 获取 DataSource 版本历史
   * 对应请求: GET /sap/bw/modeling/rsds/{datasource}/{sourceSystem}/versions
   *
   * @param datasource - DataSource 技术名
   * @param sourceSystem - 源系统逻辑名
   */
  public async getDataSourceVersions(
    datasource: string,
    sourceSystem: string
  ) {
    const { getDataSourceVersions } = await import("./api/datasource")
    return getDataSourceVersions(this.h, datasource, sourceSystem)
  }

  /**
   * Get DataSource Fields - 解析 DataSource 的字段列表
   *
   * @param datasource - DataSource 技术名
   * @param sourceSystem - 源系统逻辑名
   * @param forceCacheUpdate - 是否强制更新缓存
   */
  public async getDataSourceFields(
    datasource: string,
    sourceSystem: string,
    forceCacheUpdate?: boolean
  ) {
    const { getDataSourceFields } = await import("./api/datasource")
    return getDataSourceFields(this.h, datasource, sourceSystem, forceCacheUpdate)
  }

  /**
   * Lock DataSource - 锁定 DataSource
   * 对应请求: POST /sap/bw/modeling/rsds/{datasource}/{sourceSystem}?action=lock
   * 会话: stateful
   *
   * @param datasource - DataSource 技术名
   * @param sourceSystem - 源系统逻辑名
   */
  public async lockDataSource(datasource: string, sourceSystem: string) {
    const { lockDataSource } = await import("./api/datasource")
    return lockDataSource(this.h, datasource, sourceSystem)
  }

  /**
   * Unlock DataSource - 解锁 DataSource
   * 对应请求: POST /sap/bw/modeling/rsds/{datasource}/{sourceSystem}?action=unlock
   * 会话: stateful
   *
   * @param datasource - DataSource 技术名
   * @param sourceSystem - 源系统逻辑名
   */
  public async unlockDataSource(datasource: string, sourceSystem: string) {
    const { unlockDataSource } = await import("./api/datasource")
    return unlockDataSource(this.h, datasource, sourceSystem)
  }

  /**
   * Update DataSource (PUT) - 保存修改后的 DataSource XML
   * 对应请求: PUT /sap/bw/modeling/rsds/{datasource}/{sourceSystem}/m?lockHandle={h}
   * 会话: stateless (实测不带 corrNr, TR 走 Transport-Lock-Holder header)
   *
   * @param datasource - DataSource 技术名
   * @param sourceSystem - 源系统逻辑名
   * @param xmlContent - 修改后的 DataSource XML 内容
   * @param options - lockHandle (必填) / transport / timestamp
   */
  public async updateDataSource(
    datasource: string,
    sourceSystem: string,
    xmlContent: string,
    options: { lockHandle: string; transport?: string; timestamp?: string; headers?: Record<string, string> }
  ) {
    const { updateDataSource } = await import("./api/datasource")
    return updateDataSource(this.h, datasource, sourceSystem, xmlContent, options)
  }

  /**
   * Activate DataSource - 激活 DataSource
   * 对应请求: POST /sap/bw/modeling/activation
   * 会话: stateless
   *
   * @param datasource - DataSource 技术名
   * @param sourceSystem - 源系统逻辑名
   * @param lockHandle - 锁定句柄
   * @param corrNr - 传输请求号 (可选)
   */
  public async activateDataSource(
    datasource: string,
    sourceSystem: string,
    lockHandle: string = "",
    corrNr: string = ""
  ) {
    const { activateDataSource } = await import("./api/datasource")
    return activateDataSource(this.h, datasource, sourceSystem, lockHandle, corrNr)
  }

  /**
   * Merge DataSource Proposal - 合并 ODP 提案 (改 ODP 适配器后的字段同步)
   * 对应请求: POST /sap/bw/modeling/rsdsint/proposal/{ds}/{src}?action=merge
   * 会话: stateless
   *
   * 把当前 DataSource XML 发给服务端, 服务端合并外部 ODP 字段结构后返回新的 XML。
   * 返回的 XML 可直接用作 PUT body。
   *
   * @param datasource - DataSource 技术名
   * @param sourceSystem - 源系统逻辑名
   * @param dataSourceXml - 当前 DataSource XML (通常来自 getDataSourceXml)
   */
  public async mergeDataSourceProposal(
    datasource: string,
    sourceSystem: string,
    dataSourceXml: string
  ) {
    const { mergeDataSourceProposal } = await import("./api/datasource")
    return mergeDataSourceProposal(this.h, datasource, sourceSystem, dataSourceXml)
  }

  /**
   * Save and Activate DataSource - 一站式保存激活 DataSource
   *
   * 封装完整写操作流程 (会话模型与 DTP/ADSO 一致):
   *   1. lock (stateful, 建立 sap-contextid 持锁会话)
   *   2. 确定 TR 号 (lock 返回 corrNr 优先; 否则 transportCheck → createTransport)
   *   3. PUT update (stateless, 仅 lockHandle; timestamp 自动从 xml 提取)
   *   4. activation (stateless)
   *   5. unlock (回到持锁的 stateful 会话)
   *
   * @param datasource - DataSource 技术名
   * @param sourceSystem - 源系统逻辑名
   * @param xmlContent - 修改后的 DataSource XML 内容
   * @param options - transport 已有TR号 / transportDescription / autoActivate
   */
  /** @deprecated Prefer `client.dataSource.saveAndActivate` */
  public async saveAndActivateDataSource(
    datasource: string,
    sourceSystem: string,
    xmlContent: string,
    options?: {
      transport?: string
      createTransport?: boolean
      transportDescription?: string
      autoActivate?: boolean
    }
  ) {
    const { saveAndActivateDataSource } = await import("./api/datasource")
    return saveAndActivateDataSource(
      this.h,
      datasource,
      sourceSystem,
      xmlContent,
      options
    )
  }

  // ========================================
  // DataSource Replication Operations
  // ========================================

  /**
   * Get Replication Info - 查询数据源复制信息 (复制预检)
   * 对应请求: GET /sap/bw/modeling/lsysint/replication/{sourceSystem}?datasource={ds}
   *
   * datasource 自动补齐到 30 字符定长。
   *
   * @param sourceSystem - 源系统逻辑名 (如 "S4DCLNT300")
   * @param datasource - DataSource 技术名
   */
  public async getReplicationInfo(sourceSystem: string, datasource: string) {
    const { getReplicationInfo } = await import("./api/replication")
    return getReplicationInfo(this.h, sourceSystem, datasource)
  }

  /**
   * Replicate DataSource - 触发数据源复制
   * 对应请求: POST /sap/bw/modeling/lsysint/replication/{sourceSystem}?datasource=...&activate=&background=
   *
   * 请求体必须回传预检 (getReplicationInfo) 返回的 replicationTask。
   *
   * @param sourceSystem - 源系统逻辑名
   * @param datasource - DataSource 技术名
   * @param tasks - 从 getReplicationInfo 获取的任务
   * @param options - activate 策略 / 是否后台执行
   */
  public async replicateDataSource(
    sourceSystem: string,
    datasource: string,
    tasks: import("./api/types").ReplicationTask[],
    options?: { activate?: string; background?: boolean }
  ) {
    const { replicateDataSource } = await import("./api/replication")
    return replicateDataSource(this.h, sourceSystem, datasource, tasks, options)
  }

  /**
   * Replicate DataSource (full) - 一站式: 预检 → 触发复制
   *
   * @param sourceSystem - 源系统逻辑名
   * @param datasource - DataSource 技术名
   * @param options - activate 策略 / 是否后台执行
   */
  public async replicateDataSourceFull(
    sourceSystem: string,
    datasource: string,
    options?: { activate?: string; background?: boolean }
  ) {
    const { replicateDataSourceFull } = await import("./api/replication")
    return replicateDataSourceFull(this.h, sourceSystem, datasource, options)
  }

  // ========================================
  // DDIC Table Operations
  // ========================================

  /**
   * Get ADSO DDIC Links - 从 ADSO 响应头获取 DDIC 表链接
   * 对应请求: GET /sap/bw/modeling/adso/{adso_id}/m
   *
   * @param adsoId - ADSO ID
   * @returns DDIC 表链接信息
   */
  public async getADSODDICLinks(adsoId: string) {
    const { getADSODDICLinks } = await import("./api/ddic")
    return getADSODDICLinks(this.h, adsoId)
  }

  /**
   * Get ADSO DDIC Table Name - 获取 ADSO 对应的 DDIC 表名
   *
   * @param adsoId - ADSO ID
   * @returns DDIC 表名或 undefined
   */
  public async getADSODDICTableName(adsoId: string) {
    const { getADSODDICTableName } = await import("./api/ddic")
    return getADSODDICTableName(this.h, adsoId)
  }

  /**
   * Get DDIC Table Metadata - 获取 DDIC 表元数据（blueSource 格式）
   * 对应请求: GET /sap/bc/adt/ddic/tables/{table_name}
   *
   * @param tableName - 表名
   * @returns DDIC 表元数据
   */
  public async getDDICTableMetadata(tableName: string) {
    const { getDDICTableMetadata } = await import("./api/ddic")
    return getDDICTableMetadata(this.h, tableName)
  }

  /**
   * Get ADSO Tables - 获取 ADSO 关联的表名
   * 对应请求: GET /sap/bw/modeling/adso/{adso_id}/{version}
   *
   * @param adsoId - ADSO ID
   * @param version - 版本段：m=active（默认）, a=modified, d=revised
   * @returns ADSO 表信息
   */
  public async getADSOTables(adsoId: string, version?: "m" | "a" | "d") {
    const { getADSOTables } = await import("./api/adso")
    return getADSOTables(this.h, adsoId, version)
  }

  /**
   * Get DDIC Table Info - 获取 DDIC 表信息
   * 对应请求: GET /sap/bc/adt/ddic/tables/{table_name}/source/main
   *
   * @param tableName - 表名
   * @returns DDIC 表信息
   */
  public async getDDICTableInfo(tableName: string) {
    const { getDDICTableInfo } = await import("./api/ddic")
    return getDDICTableInfo(this.h, tableName)
  }

  /**
   * Get DDIC Table Fields - 获取 DDIC 表字段列表
   *
   * @param tableName - 表名
   * @returns DDIC 表字段列表
   */
  public async getDDICTableFields(tableName: string) {
    const { getDDICTableFields } = await import("./api/ddic")
    return getDDICTableFields(this.h, tableName)
  }

  /**
   * Get DDIC Table Data Metadata - 获取 DDIC 表数据预览元数据
   * 对应请求: GET /sap/bc/adt/datapreview/ddic/{table_name}/metadata
   *
   * @param tableName - 表名
   * @returns 元数据
   */
  public async getDDICTableDataMetadata(tableName: string) {
    const { getDDICTableDataMetadata } = await import("./api/ddic")
    return getDDICTableDataMetadata(this.h, tableName)
  }

  /**
   * Get DDIC Table Data - 获取 DDIC 表数据
   * 对应请求: POST /sap/bc/adt/datapreview/ddic?rowNumber={maxRows}&ddicEntityName={table_name}
   *
   * @param tableName - 表名
   * @param options - 查询选项
   * @returns DDIC 表数据
   */
  public async getDDICTableData(
    tableName: string,
    options?: {
      maxRows?: number
      columns?: string[]
      whereClause?: string
      orderBy?: string
      /** Emit literal `SELECT *` — see api/ddic.getDDICTableData. */
      selectStar?: boolean
    }
  ) {
    const { getDDICTableData } = await import("./api/ddic")
    return getDDICTableData(this.h, tableName, options)
  }

  /**
   * Get Table Data via Freestyle OpenSQL - 通过 Data Preview Freestyle 执行任意 OpenSQL
   * 对应请求: POST /sap/bc/adt/datapreview/freestyle?rowNumber={maxRows}
   *
   * @param tableName - 结果集标签（不进 URL）
   * @param sqlStatement - OpenSQL 语句
   * @param options - maxRows 等
   * @returns 查询结果
   */
  public async getTableDataViaSQL(
    tableName: string,
    sqlStatement: string,
    options?: { maxRows?: number }
  ) {
    const { getTableDataViaSQL } = await import("./api/ddic")
    return getTableDataViaSQL(this.h, tableName, sqlStatement, options)
  }

  // ========================================
  // BICS Reporting / Provider Preview
  // ========================================

  /**
   * Get Reporting Initial View - 获取 BICS 初始视图（元数据 + 默认结果）
   * 对应请求: GET /sap/bw/modeling/comp/reporting?compid=!{name}
   * 适用于 ADSO / 特征 / Composite Provider
   */
  public async getReportingInitialView(
    compId: string,
    options?: {
      fromRow?: number
      toRow?: number
      inclMetadata?: boolean
      inclExceptDef?: boolean
      inclObjectValues?: boolean
      compactMode?: boolean
      hryLvlAbsRs?: boolean
    }
  ) {
    const { getReportingInitialView } = await import("./api/reporting")
    return getReportingInitialView(this.h, compId, options)
  }

  /**
   * Update Reporting View - 更新轴布局并刷新 BICS 结果
   * 对应请求: POST /sap/bw/modeling/comp/reporting?compid=!{name}
   */
  public async updateReportingView(
    compId: string,
    state: Array<{ name: string; id: string; axis: string; pos?: number }>,
    options?: {
      fromRow?: number
      toRow?: number
      inclMetadata?: boolean
      inclExceptDef?: boolean
      inclObjectValues?: boolean
      hryLvlAbsRs?: boolean
    }
  ) {
    const { updateReportingView } = await import("./api/reporting")
    return updateReportingView(this.h, compId, state, options)
  }

  /**
   * Query Provider Preview - 按特征名指定行轴后预览数据
   * 内部：GET 元数据 → 重排 ROWS/COLUMNS/FREE → POST 刷新
   */
  public async queryProviderPreview(
    providerName: string,
    options: {
      rows: string[]
      columns?: string[]
      fromRow?: number
      toRow?: number
    }
  ) {
    const { queryProviderPreview } = await import("./api/reporting")
    return queryProviderPreview(this.h, providerName, options)
  }

  // ========================================
  // Process Chain Operations (流程链)
  // ========================================

  /**
   * Get Process Chain - 获取流程链元数据
   * 对应请求: GET /sap/bw/modeling/pc/{chain_id}/m
   *
   * @param chainId - Process Chain ID
   * @returns 流程链元数据
   */
  public async getProcessChain(chainId: string) {
    const { getProcessChain } = await import("./api/processchain")
    return getProcessChain(this.h, chainId)
  }

  /**
   * Get Process Chain Details - 获取流程链详细信息
   * 对应请求: GET /sap/bw/modeling/pc/{chain_id}/m
   *
   * @param chainId - Process Chain ID
   * @returns 流程链详细信息
   */
  public async getProcessChainDetails(chainId: string) {
    const { getProcessChainDetails } = await import("./api/processchain")
    return getProcessChainDetails(this.h, chainId)
  }

  /**
   * Get Process Chain Versions - 获取流程链版本历史
   * 对应请求: GET /sap/bw/modeling/pc/{chain_id}/versions
   *
   * @param chainId - Process Chain ID
   * @returns 版本历史列表
   */
  public async getProcessChainVersions(chainId: string) {
    const { getProcessChainVersions } = await import("./api/processchain")
    return getProcessChainVersions(this.h, chainId)
  }

  /**
   * Lock Process Chain - 锁定流程链
   * 对应请求: POST /sap/bw/modeling/pc/{chain_id}?action=lock
   *
   * @param chainId - Process Chain ID
   * @returns 锁定结果（包含 lockHandle）
   */
  public async lockProcessChain(chainId: string) {
    const { lockProcessChain } = await import("./api/processchain")
    return lockProcessChain(this.h, chainId)
  }

  /**
   * Unlock Process Chain - 解锁流程链
   * 对应请求: POST /sap/bw/modeling/pc/{chain_id}?action=unlock
   *
   * @param chainId - Process Chain ID
   */
  public async unlockProcessChain(chainId: string) {
    const { unlockProcessChain } = await import("./api/processchain")
    return unlockProcessChain(this.h, chainId)
  }

  /**
   * Activate Process Chain - 激活流程链
   * 对应请求: POST /sap/bw/modeling/activation
   *
   * @param chainId - Process Chain ID
   * @param lockHandle - 锁定句柄
   * @param corrNr - 传输请求号（可选）
   * @returns 激活结果
   */
  public async activateProcessChain(chainId: string, lockHandle?: string, corrNr?: string) {
    const { activateProcessChain } = await import("./api/processchain")
    return activateProcessChain(this.h, chainId, lockHandle || "", corrNr || "")
  }

  /**
   * Check Process Chain - 检查流程链一致性
   *
   * @param chainId - Process Chain ID
   * @returns 检查结果
   */
  public async checkProcessChain(chainId: string) {
    const { checkProcessChain } = await import("./api/processchain")
    return checkProcessChain(this.h, chainId)
  }

  /**
   * Execute Process Chain - 执行流程链
   * 对应请求: POST /sap/bw/modeling/pc/{chain_id}?action=execute
   *
   * @param chainId - Process Chain ID
   * @returns 执行结果
   */
  public async executeProcessChain(chainId: string) {
    const { executeProcessChain } = await import("./api/processchain")
    return executeProcessChain(this.h, chainId)
  }

  /**
   * Stop Process Chain - 停止正在运行的流程链
   * 对应请求: POST /sap/bw/modeling/pc/{chain_id}?action=stop
   *
   * @param chainId - Process Chain ID
   * @returns 停止结果
   */
  public async stopProcessChain(chainId: string) {
    const { stopProcessChain } = await import("./api/processchain")
    return stopProcessChain(this.h, chainId)
  }

  /**
   * Get Process Chain Logs - 获取流程链执行日志
   * 对应请求: GET /sap/bw/modeling/pc/{chain_id}/logs
   *
   * @param chainId - Process Chain ID
   * @returns 执行日志列表
   */
  public async getProcessChainLogs(chainId: string) {
    const { getProcessChainLogs } = await import("./api/processchain")
    return getProcessChainLogs(this.h, chainId)
  }

  /**
   * Get Process Chain Status - 获取流程链运行状态
   * 对应请求: GET /sap/bw/modeling/pc/{chain_id}/status
   *
   * @param chainId - Process Chain ID
   * @returns 运行状态信息
   */
  public async getProcessChainStatus(chainId: string) {
    const { getProcessChainStatus } = await import("./api/processchain")
    return getProcessChainStatus(this.h, chainId)
  }

  // ========================================
  // Generic BW Object Operations
  // ========================================

  /**
   * Get BW Object - 获取泛型 BW 对象实例
   *
   * 提供统一的接口来操作任何 BW 对象类型：
   * - lock/unlock
   * - activate/check
   * - getVersions
   * - validate
   *
   * @param objectType - 对象类型 (ADSO, TRFN, DTPA, PC, IOBJ, DSO, ISRC, AREA)
   * @param objectName - 对象名称
   * @returns BWObject 实例
   *
   * @example
   * ```typescript
   * const adso = client.bwObject(BWObjectType.ADSO, "ZSD001")
   * await adso.lock()
   * await adso.check()
   * await adso.activate(lockHandle)
   * await adso.unlock()
   *
   * // Validation
   * const exists = await adso.exists()
   * const isNew = await adso.isNewNameAvailable()
   *
   * // Versions
   * const versions = await adso.getVersions()
   * ```
   */
  public async bwObject<T extends string>(
    objectType: T,
    objectName: string
  ) {
    const { BWObject, BWObjectType } = await import("./api/bwObject")
    // Map string to enum if needed
    const enumType: typeof BWObjectType[keyof typeof BWObjectType] =
      BWObjectType[objectType as keyof typeof BWObjectType] || objectType as any
    return new BWObject(this.h, enumType, objectName)
  }

  /**
   * Validate Object Exists - 验证对象是否存在
   *
   * 通用验证方法，适用于所有 BW 对象类型
   *
   * @param objectType - 对象类型 (ADSO, TRFN, DTPA, PC, IOBJ, DSO, ISRC, AREA)
   * @param objectName - 对象名称
   * @returns 验证结果
   */
  public async validateObjectExists(
    objectType: string,
    objectName: string
  ) {
    const { validateObject, ValidationAction } = require("./api/common")
    return validateObject(this.h, objectType, objectName, ValidationAction.EXISTS)
  }

  /**
   * Validate New Object Name - 验证新名称是否可用
   *
   * @param objectType - 对象类型
   * @param objectName - 对象名称
   * @returns 验证结果
   */
  public async validateNewObjectName(
    objectType: string,
    objectName: string
  ) {
    const { validateObject, ValidationAction } = require("./api/common")
    return validateObject(this.h, objectType, objectName, ValidationAction.NEW)
  }

  // ========================================
  // ADSO Validation (using generic base class)
  // ========================================

  /**
   * Validate ADSO Exists - 验证 ADSO 是否存在
   */
  public async validateADSOExists(adsoId: string) {
    const { validateADSOExists } = await import("./api/adso")
    return validateADSOExists(this.h, adsoId)
  }

  /**
   * Validate New ADSO Name - 验证新 ADSO 名称是否可用
   */
  public async validateADSONewName(adsoId: string) {
    const { validateADSONewName } = await import("./api/adso")
    return validateADSONewName(this.h, adsoId)
  }

  // ========================================
  // Transformation Validation (using generic base class)
  // ========================================

  /**
   * Validate Transformation Exists - 验证转换是否存在
   */
  public async validateTransformationExists(trfnId: string) {
    const { validateTransformationExists } = await import("./api/transformation")
    return validateTransformationExists(this.h, trfnId)
  }

  /**
   * Validate New Transformation Name - 验证新转换名称是否可用
   */
  public async validateTransformationNewName(trfnId: string) {
    const { validateTransformationNewName } = await import("./api/transformation")
    return validateTransformationNewName(this.h, trfnId)
  }

  // ========================================
  // DTP Validation (using generic base class)
  // ========================================

  /**
   * Validate DTP Exists - 验证 DTP 是否存在
   */
  public async validateDTPExists(dtpId: string) {
    const { validateDTPExists } = await import("./api/dtp")
    return validateDTPExists(this.h, dtpId)
  }

  /**
   * Validate New DTP Name - 验证新 DTP 名称是否可用
   */
  public async validateDTPNewName(dtpId: string) {
    const { validateDTPNewName } = await import("./api/dtp")
    return validateDTPNewName(this.h, dtpId)
  }

  // ========================================
  // ProcessChain Validation (using generic base class)
  // ========================================

  /**
   * Validate Process Chain Exists - 验证流程链是否存在
   */
  public async validateProcessChainExists(chainId: string) {
    const { validateProcessChainExists } = await import("./api/processchain")
    return validateProcessChainExists(this.h, chainId)
  }

  /**
   * Validate New Process Chain Name - 验证新流程链名称是否可用
   */
  public async validateProcessChainNewName(chainId: string) {
    const { validateProcessChainNewName } = await import("./api/processchain")
    return validateProcessChainNewName(this.h, chainId)
  }

  // ========================================
  // InfoObject Validation (using generic base class)
  // ========================================

  /**
   * Validate InfoObject Exists - 验证 InfoObject 是否存在
   */
  public async validateInfoObjectExists(iobjName: string) {
    const { validateInfoObjectExists } = await import("./api/infoobject")
    return validateInfoObjectExists(this.h, iobjName)
  }

  /**
   * Validate New InfoObject Name - 验证新 InfoObject 名称是否可用
   */
  public async validateInfoObjectNewName(iobjName: string) {
    const { validateInfoObjectNewName } = await import("./api/infoobject")
    return validateInfoObjectNewName(this.h, iobjName)
  }
}
