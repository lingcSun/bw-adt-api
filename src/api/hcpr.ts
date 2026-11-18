/**
 * HCPR (CompositeProvider) ADT API.
 *
 * 契约来源：2026-11-17 Eclipse BWMT Communication Log（ZR_FIC81）
 *   GET  /sap/bw/modeling/hcpr/{name}/m?forceCacheUpdate=true
 *        Accept: application/vnd.sap.bw.modeling.hcpr-v1_15_0+xml
 *   POST ?action=lock / unlock          (stateful)
 *   PUT  /m?lockHandle=…               (stateless; timestamp + Transport-Lock-Holder)
 *   POST /sap/bw/modeling/checkruns | /activation
 *
 * 写编排走 withWriteSession（与 ADSO/DTP/TRFN 同构）。
 */
import { AdtHTTP } from "../AdtHTTP"
import { fullParse, xmlNode, xmlNodeAttr } from "../utilities"
import {
  ActivationResult,
  LockResult,
  ObjectVersion,
  ValidationResult,
  parseActivationResponse
} from "./common"
import { BWObject, BWObjectType } from "./bwObject"
import { withWriteSession } from "./writeSession"

/** HCPR vendor media type — schemaVersion 1.15（2026-11-17 实测）。 */
export const HCPR_CONTENT_TYPE =
  "application/vnd.sap.bw.modeling.hcpr-v1_15_0+xml"

export interface HCPRDetails {
  name: string
  description?: string
  schemaVersion?: string
  objectStatus?: string
  objectVersion?: string
  packageName?: string
  responsible?: string
  changedAt?: string
  changedBy?: string
}

export type HCPRVersion = ObjectVersion

export interface UpdateHCPROptions {
  lockHandle: string
  corrNr?: string
  timestamp?: string
}

export interface SaveAndActivateHCPROptions {
  transport?: string
  createTransport?: boolean
  transportDescription?: string
  autoActivate?: boolean
  timestamp?: string
}

export interface SaveAndActivateHCPRResult {
  lockHandle: string
  transport?: string
  updateResult: ActivationResult
  activated: boolean
  activateResult?: ActivationResult
}

function hcprUri(name: string, version: "m" | "a" | "d" = "m"): string {
  return `/sap/bw/modeling/hcpr/${encodeURIComponent(name.toLowerCase())}/${version}`
}

/**
 * Extract timestamp header value from HCPR XML (adtcore:changedAt).
 * "2026-11-17T06:48:03Z" → "20261117064803"
 */
export function extractHCPRTimestamp(hcprXml: string): string | undefined {
  const m = hcprXml.match(
    /adtcore:changedAt="(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/
  )
  if (!m) return undefined
  return `${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}${m[6]}`
}

export async function lockHCPR(
  client: AdtHTTP,
  hcprId: string
): Promise<LockResult> {
  const obj = new BWObject(client, BWObjectType.HCPR, hcprId)
  return obj.lock()
}

export async function unlockHCPR(
  client: AdtHTTP,
  hcprId: string
): Promise<void> {
  const obj = new BWObject(client, BWObjectType.HCPR, hcprId)
  return obj.unlock()
}

export async function activateHCPR(
  client: AdtHTTP,
  hcprId: string,
  lockHandle: string = "",
  corrNr: string = ""
): Promise<ActivationResult> {
  const obj = new BWObject(client, BWObjectType.HCPR, hcprId)
  return obj.activate(lockHandle, corrNr || undefined)
}

export async function checkHCPR(
  client: AdtHTTP,
  hcprId: string
): Promise<ActivationResult> {
  const obj = new BWObject(client, BWObjectType.HCPR, hcprId)
  return obj.check()
}

export async function getHCPRVersions(
  client: AdtHTTP,
  hcprId: string
): Promise<HCPRVersion[]> {
  const obj = new BWObject(client, BWObjectType.HCPR, hcprId)
  return obj.getVersions()
}

export async function validateHCPRExists(
  client: AdtHTTP,
  hcprId: string
): Promise<ValidationResult> {
  const obj = new BWObject(client, BWObjectType.HCPR, hcprId)
  return obj.exists()
}

/**
 * Get HCPR raw XML for PUT updates.
 * GET /sap/bw/modeling/hcpr/{id}/m[?forceCacheUpdate=true]
 */
export async function getHCPRXml(
  client: AdtHTTP,
  hcprId: string,
  forceCacheUpdate: boolean = false
): Promise<string> {
  const qs = forceCacheUpdate ? { forceCacheUpdate: "true" } : undefined
  const response = await client.request(hcprUri(hcprId, "m"), {
    method: "GET",
    qs,
    headers: { Accept: HCPR_CONTENT_TYPE }
  })
  return response.body
}

/**
 * Parse a lightweight details projection from HCPR XML.
 * Full structure (parts/mappings/properties) stays in the raw XML —
 * agents edit via getXml → file → saveAndActivate.
 */
export function parseHCPRDetails(xml: string): HCPRDetails {
  const raw = fullParse(xml)
  const root =
    raw["Composite:compositeView"] ||
    raw["composite:compositeView"] ||
    raw["Composite:CompositeProvider"] ||
    raw
  const attrs = xmlNodeAttr(root) || {}
  const tlogo = xmlNode(root, "tlogoProperties") || {}
  const tlogoAttrs = xmlNodeAttr(tlogo) || {}
  const endUser = xmlNode(root, "endUserTexts") || {}
  const endAttrs = xmlNodeAttr(endUser) || {}

  return {
    name: attrs.name || tlogoAttrs.name || "",
    description: endAttrs.label || undefined,
    schemaVersion: attrs.schemaVersion || undefined,
    objectStatus: tlogoAttrs.objectStatus || undefined,
    objectVersion: tlogoAttrs.objectVersion || undefined,
    packageName: tlogoAttrs.packageName || undefined,
    responsible: tlogoAttrs.responsible || undefined,
    changedAt: tlogoAttrs.changedAt || undefined,
    changedBy: tlogoAttrs.changedBy || undefined
  }
}

export async function getHCPRDetails(
  client: AdtHTTP,
  hcprId: string,
  forceCacheUpdate: boolean = false
): Promise<HCPRDetails> {
  const xml = await getHCPRXml(client, hcprId, forceCacheUpdate)
  return parseHCPRDetails(xml)
}

/**
 * Update HCPR metadata.
 * PUT /sap/bw/modeling/hcpr/{id}/m?lockHandle=…[&corrNr=…]
 * Headers: timestamp + Transport-Lock-Holder (Eclipse 实测形态).
 */
export async function updateHCPR(
  client: AdtHTTP,
  hcprId: string,
  xmlContent: string,
  options: UpdateHCPROptions
): Promise<ActivationResult> {
  const { lockHandle, corrNr, timestamp } = options

  const qs: Record<string, string> = { lockHandle }
  if (corrNr) qs["corrNr"] = corrNr

  const headers: Record<string, string> = {
    "Content-Type": `application/xml, ${HCPR_CONTENT_TYPE}`,
    Accept: HCPR_CONTENT_TYPE
  }
  if (timestamp) headers["timestamp"] = timestamp
  if (corrNr) headers["Transport-Lock-Holder"] = corrNr

  const response = await client.request(hcprUri(hcprId, "m"), {
    method: "PUT",
    qs,
    headers,
    body: xmlContent
  })

  return parseActivationResponse(response.body)
}

/**
 * Save and Activate HCPR — lock → transport → PUT → activate → unlock (finally).
 * Session model: lock/unlock stateful; PUT/activation/transport stateless.
 */
export async function saveAndActivateHCPR(
  client: AdtHTTP,
  hcprId: string,
  xmlContent: string,
  options?: SaveAndActivateHCPROptions
): Promise<SaveAndActivateHCPRResult> {
  return withWriteSession(
    client,
    {
      lock: c => lockHCPR(c, hcprId),
      update: (c, xml, io) =>
        updateHCPR(c, hcprId, xml, {
          lockHandle: io.lockHandle,
          corrNr: io.corrNr,
          timestamp: io.timestamp ?? extractHCPRTimestamp(xml)
        }),
      activate: (c, lockHandle, corrNr) =>
        activateHCPR(c, hcprId, lockHandle, corrNr || ""),
      unlock: c => unlockHCPR(c, hcprId)
    },
    {
      uri: hcprUri(hcprId, "m"),
      xml: xmlContent,
      autoActivate: options?.autoActivate,
      timestamp: options?.timestamp,
      transport: options?.transport,
      createTransport: options?.createTransport,
      transportDescription: options?.transportDescription || "API HCPR update"
    }
  )
}
