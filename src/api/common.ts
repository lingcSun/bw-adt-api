import * as t from "io-ts"
import { orUndefined } from "../utilities"
import { AdtHTTP } from "../AdtHTTP"
import { fullParse, xmlNodeAttr, xmlArray, xmlNode } from "../utilities"

// ============================================================================
// Common Types for BW Objects (Activation, Lock, etc.)
// ============================================================================

/**
 * Activation Message - 激活消息
 */
export const ActivationMessage = t.type({
  messageType: orUndefined(t.string),
  title: orUndefined(t.string),
  errorPosition: orUndefined(t.string)
})

export type ActivationMessage = t.OutputOf<typeof ActivationMessage>

/**
 * Activation Result - 激活结果
 */
export const ActivationResult = t.type({
  success: t.boolean,
  messages: orUndefined(t.array(ActivationMessage))
})

export type ActivationResult = t.OutputOf<typeof ActivationResult>

/**
 * Lock Result - 锁定结果
 */
export const LockResult = t.type({
  lockHandle: t.string,
  corrNr: orUndefined(t.string),
  corrUser: orUndefined(t.string),
  corrText: orUndefined(t.string)
})

export type LockResult = t.OutputOf<typeof LockResult>

/**
 * Object Version - 对象版本信息
 */
export const ObjectVersion = t.type({
  version: t.string,           // m=active, a=modified, d=revised
  uri: t.string,
  created: orUndefined(t.string),
  user: orUndefined(t.string),
  description: orUndefined(t.string)
})

export type ObjectVersion = t.OutputOf<typeof ObjectVersion>

// ============================================================================
// Common API Functions
// ============================================================================

/**
 * Activate Object - 通用激活函数
 *
 * 对应请求: POST /sap/bw/modeling/activation
 *
 * @param client - ADT HTTP 客户端
 * @param objectUri - 对象 URI
 * @param lockHandle - 锁定句柄
 * @param version - 版本 (active/inactive)
 * @param contentType - 内容类型（默认使用 trfn）
 * @returns 激活结果
 */
export async function activateObject(
  client: AdtHTTP,
  objectUri: string,
  lockHandle: string,
  version: "active" | "inactive" = "inactive",
  contentType: string = "application/vnd.sap.bw.modeling.trfn-v1_0_0+xml"
): Promise<ActivationResult> {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:bwModel="http://www.sap.com/bw/modeling">
  <atom:entry>
    <atom:content type="${contentType}">
      <bwModel:checkProperties version="${version}" modelContent="" lockHandle="${lockHandle}"></bwModel:checkProperties>
    </atom:content>
    <atom:link href="${objectUri}" rel="self" type="application/*"></atom:link>
  </atom:entry>
</atom:feed>`

  const response = await client.request("/sap/bw/modeling/activation", {
    method: "POST",
    headers: {
      "Content-Type": "application/atom+xml;type=entry"
    },
    body
  })

  return parseActivationResponse(response.body)
}

/**
 * Parse Activation Response - 解析激活响应
 */
export function parseActivationResponse(body: string): ActivationResult {
  const parsed = fullParse(body)
  const feed = xmlNode(parsed, "atom:feed")

  if (!feed) {
    return { success: true, messages: [] }
  }

  const entries = xmlArray(feed, "atom:entry")
  const messages: t.OutputOf<typeof ActivationMessage>[] = []

  for (const entry of entries) {
    const content = xmlNode(entry, "atom:content")
    const checkResult = xmlNode(content, "bwModel:checkresult")
    const title = xmlNode(entry, "atom:title")

    if (checkResult) {
      const attrs = xmlNodeAttr(checkResult)
      messages.push({
        messageType: attrs?.messageType || checkResult?.["@_messageType"] || "Information",
        title: title || "",
        errorPosition: attrs?.errorPosition || checkResult?.["@_errorPosition"]
      })
    }
  }

  const hasErrors = messages.some(m => m.messageType === "Error")

  return {
    success: !hasErrors,
    messages
  }
}

/**
 * Parse Lock Response - 解析锁定响应
 */
export function parseLockResponse(body: string): LockResult {
  const parsed = fullParse(body)
  const data = xmlNode(parsed, "asx:abap", "asx:values", "DATA")

  if (!data) {
    throw new Error("Invalid lock response format")
  }

  return {
    lockHandle: data["LOCK_HANDLE"] || "",
    corrNr: data["CORRNR"],
    corrUser: data["CORRUSER"],
    corrText: data["CORRTEXT"]
  }
}

/**
 * Parse Object Versions Response - 解析对象版本历史响应
 */
export function parseObjectVersions(body: string): ObjectVersion[] {
  const parsed = fullParse(body)
  const feed = xmlNode(parsed, "atom:feed")

  if (!feed) {
    return []
  }

  const entries = xmlArray(feed, "atom:entry")

  return entries.map((entry: any) => {
    const id = xmlNode(entry, "atom:id") || ""
    const updated = xmlNode(entry, "atom:updated") || ""
    const author = xmlNode(entry, "atom:author")
    const userName = author ? xmlNode(author, "atom:name") : undefined
    const links = xmlArray(entry, "atom:link")

    const selfLink = links.find((link: any) => link["@_rel"] === "self")
    let uri = (selfLink as any)?.["@_href"] || id
    if (uri && typeof uri !== "string") {
      uri = String(uri)
    }

    const versionMatch = uri.match(/\/([mad])$/)
    const version = versionMatch ? versionMatch[1] : "m"

    const versionMap: Record<string, string> = {
      "m": "Active",
      "a": "Modified",
      "d": "Revised"
    }

    return {
      version,
      uri,
      description: versionMap[version] || version,
      created: updated,
      user: userName
    }
  })
}
