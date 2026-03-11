import * as t from "io-ts"
import { fullParse, xmlNodeAttr, xmlArray, xmlNode, orUndefined } from "../utilities"
import { AdtHTTP } from "../AdtHTTP"

// ============================================================================
// Types and Codecs for DDIC Tables (Data Dictionary)
// Based on: /sap/bc/adt/ddic/tables
// ============================================================================

/**
 * DDIC Table Field - DDIC 表字段
 */
export const DDICTableField = t.type({
  name: t.string,
  position: orUndefined(t.number),
  keyFlag: orUndefined(t.boolean),
  dataType: orUndefined(t.string),
  length: orUndefined(t.number),
  decimals: orUndefined(t.number),
  shortText: orUndefined(t.string),
  heading: orUndefined(t.string),
  checkTable: orUndefined(t.string),
  foreignKey: orUndefined(t.string),
  nullable: orUndefined(t.boolean)
})

export type DDICTableField = t.OutputOf<typeof DDICTableField>

/**
 * DDIC Table Index - DDIC 表索引
 */
export const DDICTableIndex = t.type({
  name: t.string,
  unique: orUndefined(t.boolean),
  fields: orUndefined(t.array(t.string))
})

export type DDICTableIndex = t.OutputOf<typeof DDICTableIndex>

/**
 * DDIC Table Info - DDIC 表信息
 */
export const DDICTableInfo = t.type({
  name: t.string,
  description: orUndefined(t.string),
  deliveryClass: orUndefined(t.string),
  dataClass: orUndefined(t.string),
  sizeCategory: orUndefined(t.string),
  buffering: orUndefined(t.string),
  fields: orUndefined(t.array(DDICTableField)),
  indexes: orUndefined(t.array(DDICTableIndex))
})

export type DDICTableInfo = t.OutputOf<typeof DDICTableInfo>

/**
 * DDIC Table Data Row - DDIC 表数据行
 */
export const DDICTableDataRow = t.record(t.string, t.union([t.string, t.number, t.null, t.undefined]))

export type DDICTableDataRow = t.OutputOf<typeof DDICTableDataRow>

/**
 * DDIC Table Data Result - DDIC 表数据结果
 */
export const DDICTableDataResult = t.type({
  tableName: t.string,
  totalRows: orUndefined(t.number),
  rows: orUndefined(t.array(DDICTableDataRow)),
  columns: orUndefined(t.array(t.string))
})

export type DDICTableDataResult = t.OutputOf<typeof DDICTableDataResult>

/**
 * DDIC Table Metadata - DDIC 表元数据（blueSource 格式）
 * 对应端点: GET /sap/bc/adt/ddic/tables/{table_name}
 */
export const DDICTableMetadata = t.type({
  name: t.string,
  description: orUndefined(t.string),
  responsible: orUndefined(t.string),
  masterLanguage: orUndefined(t.string),
  masterSystem: orUndefined(t.string),
  package: orUndefined(t.string),
  version: orUndefined(t.string),
  changedAt: orUndefined(t.string),
  changedBy: orUndefined(t.string),
  createdAt: orUndefined(t.string),
  createdBy: orUndefined(t.string),
  links: orUndefined(t.array(t.type({
    rel: t.string,
    href: t.string,
    type: orUndefined(t.string),
    title: orUndefined(t.string)
  })))
})

export type DDICTableMetadata = t.OutputOf<typeof DDICTableMetadata>

/**
 * ADSO DDIC Links - ADSO 的 DDIC 表链接信息
 */
export const ADSODDICLinks = t.type({
  ddicTableLink: orUndefined(t.string),
  ddicTableDataDisplay: orUndefined(t.string),
  defaultDataPreview: orUndefined(t.string)
})

export type ADSODDICLinks = t.OutputOf<typeof ADSODDICLinks>

// ============================================================================
// API Functions
// ============================================================================

/**
 * Parse Link Header - 解析 HTTP Link 响应头
 * 
 * @param linkHeader - Link 响应头字符串
 * @returns 解析后的链接映射
 */
export function parseLinkHeader(linkHeader: string): Map<string, string> {
  const links = new Map<string, string>()
  
  if (!linkHeader) return links
  
  const linkPattern = /<([^>]+)>;\s*rel="([^"]+)"/g
  let match
  
  while ((match = linkPattern.exec(linkHeader)) !== null) {
    const url = match[1]
    const rel = match[2]
    links.set(rel, url)
  }
  
  return links
}

/**
 * Extract Table Name from DDIC URL - 从 DDIC URL 中提取表名
 * 
 * @param ddicUrl - DDIC 表 URL (如 /sap/bc/adt/ddic/tables/TABLE_NAME/source/main)
 * @returns 表名或 undefined
 */
export function extractTableNameFromUrl(ddicUrl: string): string | undefined {
  const match = ddicUrl.match(/\/ddic\/tables\/(.+?)(?:\/source|\/$|$)/i)
  if (match && match[1]) {
    return match[1].toUpperCase()
  }
  return undefined
}

/**
 * Get ADSO DDIC Links - 从 ADSO 响应头获取 DDIC 表链接
 * 
 * 对应请求: GET /sap/bw/modeling/adso/{adso_id}/m
 * 从响应头的 Link 字段解析 DDIC 表链接
 *
 * @param client - ADT HTTP 客户端
 * @param adsoId - ADSO ID
 * @returns DDIC 表链接信息
 */
export async function getADSODDICLinks(
  client: AdtHTTP,
  adsoId: string
): Promise<ADSODDICLinks & { rawHeaders?: Record<string, any> }> {
  const response = await client.request(
    `/sap/bw/modeling/adso/${adsoId.toLowerCase()}/m`,
    {
      method: "GET",
      headers: {
        "Accept": "application/vnd.sap.bw.modeling.adso-v1_5_0+xml"
      }
    }
  )

  const linkHeader = response.headers["link"] as string || 
                     response.headers["Link"] as string || ""
  const links = parseLinkHeader(linkHeader)

  return {
    ddicTableLink: links.get("ddicTableLink"),
    ddicTableDataDisplay: links.get("ddicTableDataDisplay"),
    defaultDataPreview: links.get("http://www.sap.com/bw/modeling/relations:defaultDataPreview"),
    rawHeaders: response.headers
  }
}

/**
 * Get ADSO DDIC Table Name - 获取 ADSO 对应的 DDIC 表名
 *
 * @param client - ADT HTTP 客户端
 * @param adsoId - ADSO ID
 * @returns DDIC 表名或 undefined
 */
export async function getADSODDICTableName(
  client: AdtHTTP,
  adsoId: string
): Promise<string | undefined> {
  const links = await getADSODDICLinks(client, adsoId)

  if (links.ddicTableLink) {
    return extractTableNameFromUrl(links.ddicTableLink)
  }

  return undefined
}

/**
 * Get DDIC Table Metadata - 获取 DDIC 表元数据（blueSource 格式）
 *
 * 对应请求: GET /sap/bc/adt/ddic/tables/{table_name}
 * 返回 blueSource XML 格式的表元数据，包含各种链接
 *
 * @param client - ADT HTTP 客户端
 * @param tableName - 表名
 * @returns DDIC 表元数据
 */
export async function getDDICTableMetadata(
  client: AdtHTTP,
  tableName: string
): Promise<DDICTableMetadata> {
  const encodedName = encodeURIComponent(tableName.toUpperCase())
  const response = await client.request(`/sap/bc/adt/ddic/tables/${encodedName}`, {
    method: "GET",
    headers: {
      Accept: "application/vnd.sap.adt.tables.v2+xml,application/vnd.sap.adt.blues.v1+xml"
    }
  })

  return parseDDICTableMetadata(response.body, tableName)
}

/**
 * Parse DDIC Table Metadata - 解析 DDIC 表元数据（blueSource 格式）
 */
function parseDDICTableMetadata(raw: any, tableName: string): DDICTableMetadata {
  const root = raw["blue:blueSource"] || raw

  const links = xmlArray(root, "atom:link").map((link: any) => ({
    rel: link["@_rel"] || link["rel"] || "",
    href: link["@_href"] || link["href"] || "",
    type: link["@_type"] || link["type"],
    title: link["@_title"] || link["title"]
  }))

  return {
    name: root["@_name"] || root["adtcore:name"] || tableName.toUpperCase(),
    description: root["@_description"] || root["adtcore:description"],
    responsible: root["adtcore:responsible"],
    masterLanguage: root["adtcore:masterLanguage"],
    masterSystem: root["adtcore:masterSystem"],
    package: root["adtcore:packageRef"]?.["@_name"],
    version: root["adtcore:version"],
    changedAt: root["adtcore:changedAt"],
    changedBy: root["adtcore:changedBy"],
    createdAt: root["adtcore:createdAt"],
    createdBy: root["adtcore:createdBy"],
    links: links.length > 0 ? links : undefined
  }
}

/**
 * Get DDIC Table Info - 获取 DDIC 表信息
 *
 * 对应请求: GET /sap/bc/adt/ddic/tables/{table_name}/source/main
 *
 * @param client - ADT HTTP 客户端
 * @param tableName - 表名
 * @returns DDIC 表信息
 */
export async function getDDICTableInfo(
  client: AdtHTTP,
  tableName: string
): Promise<DDICTableInfo> {
  const encodedName = encodeURIComponent(tableName.toUpperCase())
  const response = await client.request(
    `/sap/bc/adt/ddic/tables/${encodedName}/source/main`,
    {
      method: "GET",
      headers: {
        "Accept": "*/*"
      }
    }
  )

  return parseDDICTableSource(response.body, tableName)
}

/**
 * Parse DDIC Table Source - 解析 DDIC 表源码（ABAP CDS DDL 格式）
 *
 * 支持的字段格式：
 * - key fieldname : abap.type(length) not null;
 * - key fieldname : abap.type(length, decimals) not null;
 * - fieldname : abap.type(length);
 * - @EndUserText.label : 'label'
 *   fieldname : abap.type(length) not null;
 */
function parseDDICTableSource(source: string, tableName: string): DDICTableInfo {
  const fields: DDICTableField[] = []

  // 解析表级别的注解
  const labelMatch = source.match(/@EndUserText\.label\s*:\s*'([^']+)'/)
  const description = labelMatch ? labelMatch[1] : undefined

  const deliveryClassMatch = source.match(/@AbapCatalog\.deliveryClass\s*:\s*#(\w+)/)
  const deliveryClass = deliveryClassMatch ? deliveryClassMatch[1] : undefined

  // 解析字段 - 支持单参数和双参数类型
  // 格式: [@EndUserText.label:'xxx'] [key] fieldname : abap.type(length[, decimals]) [not null];
  const fieldPattern =
    /(?:@EndUserText\.label\s*:\s*'([^']+)'\s*)?(key\s+)?(\w+)\s*:\s*(\w+)\.(\w+)\((\d+)(?:,\s*(\d+))?\)/g
  let fieldMatch

  while ((fieldMatch = fieldPattern.exec(source)) !== null) {
    const fieldLabel = fieldMatch[1]
    const isKey = !!fieldMatch[2]
    const fieldName = fieldMatch[3]
    const dataType = fieldMatch[4] // abap
    const dataTypeName = fieldMatch[5] // numc, dec, char, int4 等
    const length = fieldMatch[6] ? parseInt(fieldMatch[6], 10) : undefined
    const decimals = fieldMatch[7] ? parseInt(fieldMatch[7], 10) : undefined

    fields.push({
      name: fieldName.toUpperCase(),
      position: fields.length + 1,
      keyFlag: isKey,
      dataType: `${dataType}.${dataTypeName}`,
      length,
      decimals,
      shortText: fieldLabel,
      heading: undefined,
      checkTable: undefined,
      foreignKey: undefined,
      nullable: undefined
    })
  }

  return {
    name: tableName.toUpperCase(),
    description,
    deliveryClass,
    dataClass: undefined,
    sizeCategory: undefined,
    buffering: undefined,
    fields,
    indexes: undefined
  }
}

/**
 * Get DDIC Table Fields - 获取 DDIC 表字段列表
 *
 * 对应请求: GET /sap/bc/adt/ddic/tables/{table_name}/source/main
 *
 * @param client - ADT HTTP 客户端
 * @param tableName - 表名
 * @returns DDIC 表字段列表
 */
export async function getDDICTableFields(
  client: AdtHTTP,
  tableName: string
): Promise<DDICTableField[]> {
  const info = await getDDICTableInfo(client, tableName)
  return info.fields || []
}

/**
 * Get DDIC Table Data Metadata - 获取 DDIC 表数据预览元数据
 *
 * 对应请求: GET /sap/bc/adt/datapreview/ddic/{table_name}/metadata
 *
 * @param client - ADT HTTP 客户端
 * @param tableName - 表名
 * @returns 元数据
 */
export async function getDDICTableDataMetadata(
  client: AdtHTTP,
  tableName: string
): Promise<Record<string, unknown>> {
  const encodedName = encodeURIComponent(tableName.toUpperCase())
  const response = await client.request(
    `/sap/bc/adt/datapreview/ddic/${encodedName}/metadata`,
    {
      method: "GET",
      headers: {
        Accept: "application/vnd.sap.adt.datapreview.table.v1+xml"
      }
    }
  )

  return fullParse(response.body)
}

/**
 * Get DDIC Table Data - 获取 DDIC 表数据
 *
 * 对应请求: POST /sap/bc/adt/datapreview/ddic?rowNumber={maxRows}&ddicEntityName={table_name}
 * 请求体为纯文本 SELECT 语句
 *
 * @param client - ADT HTTP 客户端
 * @param tableName - 表名
 * @param options - 查询选项
 * @returns DDIC 表数据
 */
export async function getDDICTableData(
  client: AdtHTTP,
  tableName: string,
  options?: {
    maxRows?: number
    columns?: string[]
    whereClause?: string
    orderBy?: string
  }
): Promise<DDICTableDataResult> {
  const maxRows = options?.maxRows || 100

  // 如果未指定 columns，先从元数据获取所有列名（模拟 SAP ADT 行为）
  let columnNames = options?.columns
  if (!columnNames || columnNames.length === 0) {
    const metadata = await getDDICTableDataMetadata(client, tableName)
    const root = metadata["dataPreview:tableData"] || metadata
    const columnsRaw = xmlArray(root, "dataPreview:columns")
    columnNames = columnsRaw
      .map((colNode: any) => {
        const colMeta = colNode["dataPreview:metadata"] || colNode
        return colMeta["@_dataPreview:name"] ||
               colMeta["dataPreview:name"] ||
               colMeta["@_name"]
      })
      .filter((name: string | undefined) => name)
  }

  const columns = columnNames
    .map((col: string) => `${tableName.toUpperCase()}~${col}`)
    .join(", ")

  let selectStatement = `SELECT ${columns} FROM ${tableName.toUpperCase()}`

  if (options?.whereClause) {
    selectStatement += ` WHERE ${options.whereClause}`
  }

  if (options?.orderBy) {
    selectStatement += ` ORDER BY ${options.orderBy}`
  }

  const response = await client.request(
    `/sap/bc/adt/datapreview/ddic`,
    {
      method: "POST",
      qs: {
        rowNumber: maxRows,
        ddicEntityName: tableName.toUpperCase()
      },
      headers: {
        Accept: "application/vnd.sap.adt.datapreview.table.v1+xml",
        "Content-Type": "text/plain"
      },
      body: selectStatement
    }
  )

  const raw = fullParse(response.body)
  return parseDDICDataPreview(raw, tableName)
}

/**
 * Parse DDIC Data Preview Response - 解析 DDIC 数据预览响应
 */
function parseDDICDataPreview(raw: any, tableName: string): DDICTableDataResult {
  const root = raw["dataPreview:tableData"] || raw["dataPreview"] || raw
  
  const columns: string[] = []
  const rows: DDICTableDataRow[] = []
  
  const columnsRaw = xmlArray(root, "dataPreview:columns")
  
  columnsRaw.forEach((colNode: any) => {
    const metadata = colNode["dataPreview:metadata"] || colNode
    const colName = metadata["@_dataPreview:name"] || metadata["dataPreview:name"] || metadata["@_name"]
    if (colName) {
      columns.push(colName)
    }
  })
  
  if (columnsRaw.length > 0 && (columnsRaw[0] as any)["dataPreview:dataSet"]) {
    const dataSets = columnsRaw.map((col: any) => {
      const dataSet = col["dataPreview:dataSet"]
      const dataNodes = xmlArray(dataSet, "dataPreview:data")
      return dataNodes.map((d: any) => d["#text"] || d["_"] || d || "")
    })
    
    const maxRows = Math.max(...dataSets.map(ds => ds.length), 0)
    
    for (let i = 0; i < maxRows; i++) {
      const rowData: DDICTableDataRow = {}
      columns.forEach((col, idx) => {
        rowData[col] = dataSets[idx]?.[i] || ""
      })
      rows.push(rowData)
    }
  }
  
  const totalRows = parseInt(
    root["dataPreview:totalRows"] || 
    root["@_dataPreview:totalRows"] || 
    rows.length.toString(), 
    10
  )

  return {
    tableName,
    totalRows,
    rows,
    columns
  }
}

/**
 * Get ADSO Table Data Preview - 获取 ADSO 表数据预览
 *
 * 对应请求: GET /sap/bw/modeling/adso/{adso_name}/data
 * 或通过 Link header 中的 defaultDataPreview 链接
 *
 * @param client - ADT HTTP 客户端
 * @param adsoName - ADSO 名称
 * @param maxRows - 最大行数
 * @returns ADSO 表数据
 */
export async function getADSODataPreview(
  client: AdtHTTP,
  adsoName: string,
  maxRows: number = 100
): Promise<DDICTableDataResult> {
  const response = await client.request(
    `/sap/bw/modeling/adso/${adsoName.toLowerCase()}/data`,
    {
      method: "GET",
      qs: { maxRows },
      headers: {
        "Accept": "application/vnd.sap.bw.modeling.adso-v1_5_0+xml"
      }
    }
  )

  const raw = fullParse(response.body)
  return parseADSODataPreview(raw, adsoName)
}

/**
 * Get Table Data via SQL View - 通过 SQL 视图获取表数据
 *
 * 对应请求: GET /sap/bc/adt/ddic/tables/{table_name}/sqlview
 *
 * @param client - ADT HTTP 客户端
 * @param tableName - 表名
 * @param sqlStatement - SQL 语句
 * @returns 查询结果
 */
export async function getTableDataViaSQL(
  client: AdtHTTP,
  tableName: string,
  sqlStatement: string
): Promise<DDICTableDataResult> {
  const response = await client.request(
    `/sap/bc/adt/ddic/tables/${tableName.toLowerCase()}/sqlview`,
    {
      method: "POST",
      headers: {
        "Accept": "application/vnd.sap.adt.ddic.table.data.v1+xml",
        "Content-Type": "application/xml"
      },
      body: `<?xml version="1.0" encoding="UTF-8"?>
<sql:statement xmlns:sql="http://www.sap.com/adt/ddic/sql">
  <sql:text>${sqlStatement}</sql:text>
</sql:statement>`
    }
  )

  const raw = fullParse(response.body)
  return parseDDICTableData(raw, tableName)
}

// ============================================================================
// Parse Functions
// ============================================================================

/**
 * Parse DDIC Table Data Response - 解析 DDIC 表数据响应
 */
function parseDDICTableData(raw: any, tableName: string): DDICTableDataResult {
  const root = raw["table:data"] || raw["data"] || raw
  const rows = xmlArray(root, "table:rows", "table:row")
    .map((row: any) => parseDDICTableDataRow(row))

  const columns = rows.length > 0 ? Object.keys(rows[0]) : []

  return {
    tableName,
    totalRows: parseInt(root["table:totalRows"] || rows.length.toString(), 10),
    rows,
    columns
  }
}

/**
 * Parse DDIC Table Data Row - 解析 DDIC 表数据行
 */
function parseDDICTableDataRow(row: any): DDICTableDataRow {
  const result: DDICTableDataRow = {}
  const attrs = xmlNodeAttr(row) || {}

  Object.keys(attrs).forEach(key => {
    result[key] = attrs[key]
  })

  const cells = xmlArray(row, "table:cells", "table:cell") ||
                xmlArray(row, "cell")

  cells.forEach((cell: any) => {
    const cellAttrs = xmlNodeAttr(cell) || {}
    const name = cellAttrs.name || cellAttrs.column || ""
    const value = cell["#text"] || cell["_"] || cellAttrs.value || null
    if (name) {
      result[name] = value
    }
  })

  return result
}

/**
 * Parse ADSO Data Preview Response - 解析 ADSO 数据预览响应
 */
function parseADSODataPreview(raw: any, adsoName: string): DDICTableDataResult {
  const root = raw["adso:data"] || raw["data"] || raw
  const rows = xmlArray(root, "adso:rows", "adso:row")
    .map((row: any) => parseADSODataRow(row))

  const columns = rows.length > 0 ? Object.keys(rows[0]) : []

  return {
    tableName: adsoName,
    totalRows: parseInt(root["adso:totalRows"] || rows.length.toString(), 10),
    rows,
    columns
  }
}

/**
 * Parse ADSO Data Row - 解析 ADSO 数据行
 */
function parseADSODataRow(row: any): DDICTableDataRow {
  const result: DDICTableDataRow = {}
  const attrs = xmlNodeAttr(row) || {}

  Object.keys(attrs).forEach(key => {
    result[key] = attrs[key]
  })

  const cells = xmlArray(row, "adso:cells", "adso:cell") ||
                xmlArray(row, "cell")

  cells.forEach((cell: any) => {
    const cellAttrs = xmlNodeAttr(cell) || {}
    const name = cellAttrs.name || cellAttrs.column || ""
    const value = cell["#text"] || cell["_"] || cellAttrs.value || null
    if (name) {
      result[name] = value
    }
  })

  return result
}
