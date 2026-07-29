import * as t from "io-ts"
import { fullParse, xmlArray, xmlNodeAttr, orUndefined } from "../utilities"
import { AdtHTTP } from "../AdtHTTP"

// ============================================================================
// Constants
// ============================================================================

const BICS_RESPONSE =
  "application/vnd.sap.bw.modeling.bicsresponse-v1_1_0+xml"
const BICS_REQUEST =
  "application/vnd.sap.bw.modeling.bicsrequest-v1_1_0+xml"

export type ReportingAxis = "ROWS" | "COLUMNS" | "FREE"

// ============================================================================
// Types
// ============================================================================

export interface ReportingQueryOptions {
  fromRow?: number
  toRow?: number
  inclMetadata?: boolean
  inclExceptDef?: boolean
  inclObjectValues?: boolean
  compactMode?: boolean
  hryLvlAbsRs?: boolean
}

export const ReportingCharacteristic = t.type({
  name: t.string,
  txt: orUndefined(t.string),
  id: t.string,
  basName: orUndefined(t.string),
  axis: orUndefined(t.string),
  pos: orUndefined(t.number),
  isStructure: orUndefined(t.boolean),
  iobjType: orUndefined(t.string),
  dataType: orUndefined(t.string)
})
export type ReportingCharacteristic = t.OutputOf<typeof ReportingCharacteristic>

export const ReportingKeyFigure = t.type({
  name: t.string,
  txt: orUndefined(t.string),
  id: orUndefined(t.string),
  aggrMode: orUndefined(t.string),
  iobjType: orUndefined(t.string),
  dataType: orUndefined(t.string)
})
export type ReportingKeyFigure = t.OutputOf<typeof ReportingKeyFigure>

export const ReportingMetaData = t.type({
  infoProvider: orUndefined(t.string),
  infoProviderText: orUndefined(t.string),
  hasVariables: orUndefined(t.boolean),
  keyFigures: orUndefined(t.array(ReportingKeyFigure)),
  characteristics: orUndefined(t.array(ReportingCharacteristic))
})
export type ReportingMetaData = t.OutputOf<typeof ReportingMetaData>

export interface ReportingInfoObjectState {
  name: string
  id: string
  axis: string
  pos?: number
}

export const ReportingKeyFigureMember = t.type({
  name: t.string,
  altName: orUndefined(t.string),
  txt: orUndefined(t.string),
  id: orUndefined(t.string),
  basedOn: orUndefined(t.string)
})
export type ReportingKeyFigureMember = t.OutputOf<typeof ReportingKeyFigureMember>

export const ReportingKyfStructure = t.type({
  name: t.string,
  id: t.string,
  size: orUndefined(t.number),
  keyFigures: orUndefined(t.array(ReportingKeyFigureMember))
})
export type ReportingKyfStructure = t.OutputOf<typeof ReportingKyfStructure>

export const ReportingTupleValue = t.type({
  id: orUndefined(t.string),
  sid: orUndefined(t.string),
  extKey: orUndefined(t.string),
  intKey: orUndefined(t.string),
  txt: orUndefined(t.string),
  selType: orUndefined(t.string)
})
export type ReportingTupleValue = t.OutputOf<typeof ReportingTupleValue>

export const ReportingTuple = t.type({
  tid: orUndefined(t.string),
  values: t.array(ReportingTupleValue)
})
export type ReportingTuple = t.OutputOf<typeof ReportingTuple>

export const ReportingAxisHeader = t.type({
  name: t.string,
  txt: orUndefined(t.string),
  id: orUndefined(t.string),
  pos: orUndefined(t.number),
  isStructure: orUndefined(t.boolean),
  hasKeyfigures: orUndefined(t.boolean)
})
export type ReportingAxisHeader = t.OutputOf<typeof ReportingAxisHeader>

export const ReportingAxisPart = t.type({
  headers: t.array(ReportingAxisHeader),
  tuples: t.array(ReportingTuple)
})
export type ReportingAxisPart = t.OutputOf<typeof ReportingAxisPart>

export const ReportingCell = t.type({
  row: t.number,
  col: t.number,
  crv: orUndefined(t.union([t.string, t.number])),
  txt: orUndefined(t.string),
  sid: orUndefined(t.string),
  mcu: orUndefined(t.boolean)
})
export type ReportingCell = t.OutputOf<typeof ReportingCell>

export const ReportingResultSet = t.type({
  fromRow: orUndefined(t.number),
  toRow: orUndefined(t.number),
  columns: ReportingAxisPart,
  rows: ReportingAxisPart,
  cells: t.array(ReportingCell)
})
export type ReportingResultSet = t.OutputOf<typeof ReportingResultSet>

export const ReportingMessage = t.type({
  type: orUndefined(t.string),
  txt: orUndefined(t.string)
})
export type ReportingMessage = t.OutputOf<typeof ReportingMessage>

export interface QueryView {
  name: string
  txt?: string
  version?: string
  dataRollup?: string
  isTransient?: boolean
  metaData?: ReportingMetaData
  kyfStructure?: ReportingKyfStructure
  state?: ReportingInfoObjectState[]
  resultSet?: ReportingResultSet
  messages?: ReportingMessage[]
  flatRows?: Array<Record<string, string | number | null>>
}

export interface QueryProviderPreviewOptions {
  rows: string[]
  columns?: string[]
  fromRow?: number
  toRow?: number
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Normalize provider name to BICS compid (`!NAME`).
 */
export function toReportingCompId(providerName: string): string {
  const trimmed = providerName.trim()
  if (!trimmed) return trimmed
  return trimmed.startsWith("!") ? trimmed : `!${trimmed}`
}

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function boolHeader(value: boolean | undefined, defaultValue: boolean): string {
  return String(value ?? defaultValue)
}

function buildReportingHeaders(
  options: ReportingQueryOptions | undefined,
  defaults: {
    inclMetadata: boolean
    contentType?: string
  }
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: BICS_RESPONSE,
    InclMetadata: boolHeader(options?.inclMetadata, defaults.inclMetadata),
    InclExceptDef: boolHeader(options?.inclExceptDef, true),
    InclObjectValues: boolHeader(options?.inclObjectValues, true),
    HryLvlAbsRs: boolHeader(options?.hryLvlAbsRs, false),
    FromRow: String(options?.fromRow ?? 0),
    ToRow: String(options?.toRow ?? 1000)
  }

  if (defaults.contentType) {
    headers["Content-Type"] = defaults.contentType
  } else {
    headers.CompactMode = boolHeader(options?.compactMode, false)
  }

  return headers
}

function attrBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined
  return String(value) === "true"
}

function attrNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function attrString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  return String(value)
}

// ============================================================================
// XML builders
// ============================================================================

/**
 * Build POST body for inquireUpdatedView.
 */
export function buildQuerySelectorXml(
  compId: string,
  state: ReportingInfoObjectState[]
): string {
  const name = escapeXmlAttr(toReportingCompId(compId))
  const infoObjects = state
    .map(io => {
      const pos = io.pos ?? 0
      return (
        `<infoObject name="${escapeXmlAttr(io.name)}" id="${escapeXmlAttr(io.id)}" ` +
        `axis="${escapeXmlAttr(io.axis)}" pos="${pos}"></infoObject>`
      )
    })
    .join("")

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<querySelector name="${name}">` +
    `<selection><state>${infoObjects}</state></selection>` +
    `</querySelector>`
  )
}

/**
 * Remap axes from an initial selection state using characteristic names.
 * ADT POST bodies use pos="0"; row/column order follows appearance order in state.
 */
export function remapReportingState(
  state: ReportingInfoObjectState[],
  options: { rows: string[]; columns?: string[] }
): ReportingInfoObjectState[] {
  const byName = new Map(state.map(io => [io.name.toUpperCase(), io]))
  const used = new Set<string>()
  const result: ReportingInfoObjectState[] = []

  const push = (io: ReportingInfoObjectState, axis: ReportingAxis) => {
    const key = io.name.toUpperCase()
    if (used.has(key)) return
    used.add(key)
    result.push({ ...io, axis, pos: 0 })
  }

  // Measures structure first on COLUMNS (matches ADT request shape)
  for (const io of state) {
    if (io.name.toUpperCase().startsWith("0MEASURES")) {
      push(io, "COLUMNS")
    }
  }

  // Extra column characteristics (if any)
  for (const name of options.columns || []) {
    const io = byName.get(name.toUpperCase())
    if (io) push(io, "COLUMNS")
  }

  // Remaining non-row chars stay FREE (before ROWS, like ADT)
  const rowSet = new Set(options.rows.map(n => n.toUpperCase()))
  for (const io of state) {
    const upper = io.name.toUpperCase()
    if (!upper.startsWith("0MEASURES") && !rowSet.has(upper)) {
      const inCols = (options.columns || []).some(
        c => c.toUpperCase() === upper
      )
      if (!inCols) push(io, "FREE")
    }
  }

  // Rows last, in caller-specified order
  for (const name of options.rows) {
    const io = byName.get(name.toUpperCase())
    if (io) push(io, "ROWS")
  }

  return result
}

// ============================================================================
// Parsers
// ============================================================================

function parseCharacteristic(node: any): ReportingCharacteristic {
  const a = xmlNodeAttr(node) || {}
  return {
    name: String(a.name || ""),
    txt: attrString(a.txt),
    id: String(a.id ?? ""),
    basName: attrString(a.basName),
    axis: attrString(a.axis),
    pos: attrNumber(a.pos),
    isStructure: attrBool(a.isStructure),
    iobjType: attrString(a.iobjType),
    dataType: attrString(a.dataType)
  }
}

function parseKeyFigure(node: any): ReportingKeyFigure {
  const a = xmlNodeAttr(node) || {}
  return {
    name: String(a.name || ""),
    txt: attrString(a.txt),
    id: attrString(a.id),
    aggrMode: attrString(a.aggrMode),
    iobjType: attrString(a.iobjType),
    dataType: attrString(a.dataType)
  }
}

function parseMetaData(node: any): ReportingMetaData | undefined {
  if (!node) return undefined
  const a = xmlNodeAttr(node) || {}
  return {
    infoProvider: attrString(a.infoProvider),
    infoProviderText: attrString(a.infoProviderText),
    hasVariables: attrBool(a.hasVariables),
    keyFigures: xmlArray(node, "keyFigures", "entry").map(parseKeyFigure),
    characteristics: xmlArray(node, "characteristics", "entry").map(
      parseCharacteristic
    )
  }
}

function parseInfoObjectState(node: any): ReportingInfoObjectState {
  const a = xmlNodeAttr(node) || {}
  return {
    name: String(a.name || ""),
    id: String(a.id ?? ""),
    axis: String(a.axis || "FREE"),
    pos: attrNumber(a.pos)
  }
}

function parseKyfStructure(node: any): ReportingKyfStructure | undefined {
  if (!node) return undefined
  const a = xmlNodeAttr(node) || {}
  return {
    name: String(a.name || ""),
    id: String(a.id ?? ""),
    size: attrNumber(a.size),
    keyFigures: xmlArray(node, "keyFigure").map((kf: any) => {
      const ka = xmlNodeAttr(kf) || {}
      return {
        name: String(ka.name || ""),
        altName: attrString(ka.altName),
        txt: attrString(ka.txt),
        id: attrString(ka.id),
        basedOn: attrString(ka.basedOn)
      }
    })
  }
}

function parseTupleValue(node: any): ReportingTupleValue {
  const a = xmlNodeAttr(node) || {}
  return {
    id: attrString(a.id),
    sid: attrString(a.sid),
    extKey: attrString(a.extKey),
    intKey: attrString(a.intKey),
    txt: attrString(a.txt),
    selType: attrString(a.selType)
  }
}

function parseTuple(node: any): ReportingTuple {
  const a = xmlNodeAttr(node) || {}
  return {
    tid: attrString(a.tid),
    values: xmlArray(node, "value").map(parseTupleValue)
  }
}

function parseAxisHeader(node: any): ReportingAxisHeader {
  const a = xmlNodeAttr(node) || {}
  return {
    name: String(a.name || ""),
    txt: attrString(a.txt),
    id: attrString(a.id),
    pos: attrNumber(a.pos),
    isStructure: attrBool(a.isStructure),
    hasKeyfigures: attrBool(a.hasKeyfigures)
  }
}

function parseAxisPart(node: any): ReportingAxisPart {
  if (!node) {
    return { headers: [], tuples: [] }
  }
  return {
    headers: xmlArray(node, "headers", "entry").map(parseAxisHeader),
    tuples: xmlArray(node, "tuples", "tuple").map(parseTuple)
  }
}

function parseCell(node: any): ReportingCell {
  const a = xmlNodeAttr(node) || {}
  return {
    row: attrNumber(a.row) ?? 0,
    col: attrNumber(a.col) ?? 0,
    crv: a.crv !== undefined && a.crv !== null && a.crv !== ""
      ? (Number.isFinite(Number(a.crv)) ? Number(a.crv) : String(a.crv))
      : undefined,
    txt: attrString(a.txt),
    sid: attrString(a.sid),
    mcu: attrBool(a.mcu)
  }
}

function parseResultSet(node: any): ReportingResultSet | undefined {
  if (!node) return undefined
  const a = xmlNodeAttr(node) || {}
  return {
    fromRow: attrNumber(a.fromRow),
    toRow: attrNumber(a.toRow),
    columns: parseAxisPart(node.columns),
    rows: parseAxisPart(node.rows),
    cells: xmlArray(node, "data", "cell").map(parseCell)
  }
}

/**
 * Flatten BICS resultSet into row objects: dimension keys + measure values.
 */
export function flattenReportingResultSet(
  resultSet: ReportingResultSet | undefined
): Array<Record<string, string | number | null>> {
  if (!resultSet) return []

  const rowHeaders = resultSet.rows.headers
  const colTuples = resultSet.columns.tuples
  const cellsByPos = new Map<string, ReportingCell>()
  for (const cell of resultSet.cells) {
    cellsByPos.set(`${cell.row}:${cell.col}`, cell)
  }

  return resultSet.rows.tuples.map((tuple, idx) => {
    const row: Record<string, string | number | null> = {}
    const rowNumber = idx + 1

    tuple.values.forEach((value, valueIdx) => {
      const header = rowHeaders[valueIdx]
      const key = header?.name || `DIM_${valueIdx}`
      row[key] = value.extKey ?? value.txt ?? null
      if (value.txt && value.txt !== value.extKey) {
        row[`${key}_TXT`] = value.txt
      }
      if (value.selType) {
        row[`${key}_SELTYPE`] = value.selType
      }
    })

    colTuples.forEach((colTuple, colIdx) => {
      const measure = colTuple.values[0]
      const measureKey =
        measure?.extKey || measure?.intKey || `COL_${colIdx + 1}`
      const cell = cellsByPos.get(`${rowNumber}:${colIdx + 1}`)
      row[measureKey] = cell?.crv ?? null
      if (cell?.txt !== undefined) {
        row[`${measureKey}_TXT`] = cell.txt
      }
    })

    return row
  })
}

/**
 * Parse BICS queryView response XML (already fullParse'd or raw string).
 */
export function parseQueryView(raw: any): QueryView {
  const parsed = typeof raw === "string" ? fullParse(raw) : raw
  const root = parsed.queryView || parsed

  const attrs = xmlNodeAttr(root) || {}
  const selection = root.selection || {}
  const resultSet = parseResultSet(root.resultSet)
  const messagesNode = root.messages
  const messages = messagesNode
    ? xmlArray(messagesNode, "entry").map((m: any) => {
        const ma = xmlNodeAttr(m) || {}
        return { type: attrString(ma.type), txt: attrString(ma.txt) }
      })
    : undefined

  return {
    name: String(attrs.name || ""),
    txt: attrString(attrs.txt),
    version: attrString(attrs.version),
    dataRollup: attrString(attrs.dataRollup),
    isTransient: attrBool(attrs.isTransient),
    metaData: parseMetaData(root.metaData),
    kyfStructure: parseKyfStructure(selection.kyfStructure),
    state: xmlArray(selection, "state", "infoObject").map(parseInfoObjectState),
    resultSet,
    messages,
    flatRows: flattenReportingResultSet(resultSet)
  }
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get initial reporting view (metadata + default result).
 *
 * GET /sap/bw/modeling/comp/reporting?compid=!{name}
 * inquireInitialView — InclMetadata: true
 */
export async function getReportingInitialView(
  client: AdtHTTP,
  compId: string,
  options?: ReportingQueryOptions
): Promise<QueryView> {
  const id = toReportingCompId(compId)
  const response = await client.request("/sap/bw/modeling/comp/reporting", {
    method: "GET",
    qs: { compid: id },
    headers: buildReportingHeaders(options, { inclMetadata: true })
  })

  return parseQueryView(fullParse(response.body))
}

/**
 * Update reporting view axes / selection and refresh result set.
 *
 * POST /sap/bw/modeling/comp/reporting?compid=!{name}
 * inquireUpdatedView
 */
export async function updateReportingView(
  client: AdtHTTP,
  compId: string,
  state: ReportingInfoObjectState[],
  options?: ReportingQueryOptions
): Promise<QueryView> {
  const id = toReportingCompId(compId)
  const body = buildQuerySelectorXml(id, state)

  const response = await client.request("/sap/bw/modeling/comp/reporting", {
    method: "POST",
    qs: { compid: id },
    headers: buildReportingHeaders(
      { ...options, inclMetadata: options?.inclMetadata ?? false },
      { inclMetadata: false, contentType: BICS_REQUEST }
    ),
    body
  })

  return parseQueryView(fullParse(response.body))
}

/**
 * Convenience preview: GET metadata, remap axes by characteristic name, POST refresh.
 *
 * Works for ADSO / InfoObject / Composite Provider (compid `!NAME`).
 */
export async function queryProviderPreview(
  client: AdtHTTP,
  providerName: string,
  options: QueryProviderPreviewOptions
): Promise<QueryView> {
  if (!options.rows || options.rows.length === 0) {
    throw new Error("queryProviderPreview requires at least one row characteristic")
  }

  const queryOptions: ReportingQueryOptions = {
    fromRow: options.fromRow,
    toRow: options.toRow
  }

  const initial = await getReportingInitialView(client, providerName, {
    ...queryOptions,
    inclMetadata: true
  })

  if (!initial.state || initial.state.length === 0) {
    throw new Error(
      `No reporting selection state returned for ${toReportingCompId(providerName)}`
    )
  }

  const missing = options.rows.filter(
    name =>
      !initial.state!.some(s => s.name.toUpperCase() === name.toUpperCase())
  )
  if (missing.length > 0) {
    throw new Error(
      `Unknown row characteristic(s) for ${toReportingCompId(providerName)}: ${missing.join(", ")}`
    )
  }

  if (options.columns) {
    const missingCols = options.columns.filter(
      name =>
        !initial.state!.some(s => s.name.toUpperCase() === name.toUpperCase())
    )
    if (missingCols.length > 0) {
      throw new Error(
        `Unknown column characteristic(s) for ${toReportingCompId(providerName)}: ${missingCols.join(", ")}`
      )
    }
  }

  const remapped = remapReportingState(initial.state, {
    rows: options.rows,
    columns: options.columns
  })

  return updateReportingView(client, providerName, remapped, {
    ...queryOptions,
    inclMetadata: false
  })
}
