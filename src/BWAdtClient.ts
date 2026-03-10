import { adtException } from "./AdtException"
import {
  AdtHTTP,
  ClientOptions,
  session_types,
  BearerFetcher,
  HttpClient
} from "./AdtHTTP"
import { followUrl, isString } from "./utilities"
import { InfoProviderType } from "./api/infoprovider"
import https from "https"

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

  public get httpClient() {
    return this.h
  }

  get id() {
    return this.h.id
  }

  private h: AdtHTTP
  private pClone?: BWAdtClient
  private options: HttpOptions

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

  /**
   * Query InfoProvider Structure - 查询 InfoProvider/InfoArea 结构树
   * 对应请求: GET /sap/bw/modeling/repo/infoproviderstructure
   *
   * @param options - 查询选项
   * @returns InfoProvider 结构列表（通常是 InfoArea 列表）
   */
  public async infoProviderStructure(options?: {
    infoProvider?: string
    infoArea?: string
    type?: InfoProviderType
    depth?: number
  }) {
    const { infoProviderStructure } = await import("./api/infoprovider")
    return infoProviderStructure(this.h, options || {})
  }

  /**
   * Query InfoProviders - 查询 InfoProvider 列表
   *
   * @param options - 查询选项
   * @returns InfoProvider 列表
   */
  public async infoProviders(options?: {
    infoProvider?: string
    infoArea?: string
    type?: InfoProviderType
    depth?: number
  }) {
    const { infoProviders } = await import("./api/infoprovider")
    return infoProviders(this.h, options || {})
  }

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

  // ========================================
  // InfoProvider Navigation
  // ========================================

  /**
   * Query InfoArea ADSOs - 查询 InfoArea 下的 ADSO 列表
   * 对应请求: GET /sap/bw/modeling/repo/infoproviderstructure/area/{area}/adso
   *
   * @param areaName - InfoArea 名称
   * @returns ADSO 列表
   */
  public async infoAreaADSOs(areaName: string) {
    const { infoAreaADSOs } = await import("./api/infoprovider")
    return infoAreaADSOs(this.h, areaName)
  }

  /**
   * Query ADSO Transformations - 查询 ADSO 关联的 Transformations
   * 对应请求: GET /sap/bw/modeling/repo/infoproviderstructure/adso/{adso}/trfn
   *
   * @param adsoName - ADSO 名称
   * @returns Transformation 列表
   */
  public async adsoTransformations(adsoName: string) {
    const { adsoTransformations } = await import("./api/infoprovider")
    return adsoTransformations(this.h, adsoName)
  }

  /**
   * Query ADSO DTPs - 查询 ADSO 关联的 Data Transfer Processes
   * 对应请求: GET /sap/bw/modeling/repo/infoproviderstructure/adso/{adso}/dtpa
   *
   * @param adsoName - ADSO 名称
   * @returns DTP 列表
   */
  public async adsoDTPs(adsoName: string) {
    const { adsoDTPs } = await import("./api/infoprovider")
    return adsoDTPs(this.h, adsoName)
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

  // ========================================
  // Transformation Operations
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
   * @returns Transformation 元数据
   */
  public async getTransformation(trfnId: string, version?: "m" | "a" | "d") {
    const { getTransformation } = await import("./api/transformation")
    return getTransformation(this.h, trfnId, version)
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
  public async activateTransformation(trfnId: string) {
    const { activateTransformation } = await import("./api/transformation")
    return activateTransformation(this.h, trfnId)
  }

  /**
   * Get Transformation Details - 获取转换详细信息（解析后）
   *
   * @param trfnId - Transformation ID
   * @param version - 版本 (m=active, a=modified, d=revised)
   * @returns 转换详细信息
   */
  public async getTransformationDetails(
    trfnId: string,
    version?: "m" | "a" | "d"
  ) {
    const { getTransformationDetails } = await import("./api/transformation")
    return getTransformationDetails(this.h, trfnId, version)
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
    content: string,
    lockHandle: string,
    version?: "m" | "a" | "d"
  ) {
    const { updateTransformation } = await import("./api/transformation")
    return updateTransformation(this.h, trfnId, content, lockHandle, version)
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
   * Check DTP - 检查 DTP 一致性
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
   * Get ADSO Tables - 获取 ADSO 关联的表名
   * 对应请求: GET /sap/bw/modeling/adso/{adso_id}/sql
   *
   * @param adsoId - ADSO ID
   * @returns ADSO 表信息
   */
  public async getADSOTables(adsoId: string) {
    const { getADSOTables } = await import("./api/adso")
    return getADSOTables(this.h, adsoId)
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
    }
  ) {
    const { getDDICTableData } = await import("./api/ddic")
    return getDDICTableData(this.h, tableName, options)
  }

  /**
   * Get ADSO Data Preview - 获取 ADSO 数据预览
   * 对应请求: GET /sap/bw/modeling/adso/{adso_name}/data
   *
   * @param adsoName - ADSO 名称
   * @param maxRows - 最大行数
   * @returns ADSO 表数据
   */
  public async getADSODataPreview(adsoName: string, maxRows?: number) {
    const { getADSODataPreview } = await import("./api/ddic")
    return getADSODataPreview(this.h, adsoName, maxRows)
  }

  /**
   * Get Table Data via SQL - 通过 SQL 查询表数据
   * 对应请求: POST /sap/bc/adt/ddic/tables/{table_name}/sqlview
   *
   * @param tableName - 表名
   * @param sqlStatement - SQL 语句
   * @returns 查询结果
   */
  public async getTableDataViaSQL(tableName: string, sqlStatement: string) {
    const { getTableDataViaSQL } = await import("./api/ddic")
    return getTableDataViaSQL(this.h, tableName, sqlStatement)
  }
}
