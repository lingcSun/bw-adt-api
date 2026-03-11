import * as t from "io-ts"
import { fullParse, xmlNodeAttr, xmlArray, xmlNode, orUndefined } from "../utilities"
import { AdtHTTP } from "../AdtHTTP"

// ============================================================================
// Types and Codecs for ABAP Classes
// Based on: /sap/bc/adt/oo/classes
// ============================================================================

/**
 * ABAP Class Include - ABAP 类的 include 部分
 * 对应 class:include 节点
 */
export const AbapClassInclude = t.type({
  includeType: orUndefined(t.string),  // definitions, implementations, macros, main
  sourceUri: orUndefined(t.string),
  name: orUndefined(t.string),
  type: orUndefined(t.string),
  changedAt: orUndefined(t.string),
  version: orUndefined(t.string),
  createdAt: orUndefined(t.string),
  changedBy: orUndefined(t.string),
  createdBy: orUndefined(t.string),
  etag: orUndefined(t.string)
})

export type AbapClassInclude = t.OutputOf<typeof AbapClassInclude>

/**
 * ABAP Class Metadata - ABAP 类元数据
 * 对应响应: GET /sap/bc/adt/oo/classes/{classname}
 */
export const AbapClassMetadata = t.type({
  name: t.string,
  description: orUndefined(t.string),
  responsible: orUndefined(t.string),
  masterLanguage: orUndefined(t.string),
  masterSystem: orUndefined(t.string),
  package: orUndefined(t.string),
  version: orUndefined(t.string),  // active, inactive
  changedAt: orUndefined(t.string),
  changedBy: orUndefined(t.string),
  createdAt: orUndefined(t.string),
  createdBy: orUndefined(t.string),
  final: orUndefined(t.boolean),
  abstract: orUndefined(t.boolean),
  visibility: orUndefined(t.string),
  category: orUndefined(t.string),
  sharedMemoryEnabled: orUndefined(t.boolean),
  includes: orUndefined(t.array(AbapClassInclude)),
  links: orUndefined(t.array(t.type({
    rel: t.string,
    href: t.string,
    type: orUndefined(t.string),
    title: orUndefined(t.string)
  })))
})

export type AbapClassMetadata = t.OutputOf<typeof AbapClassMetadata>

/**
 * ABAP Class Source Info - ABAP 类源码信息
 */
export const AbapClassSourceInfo = t.type({
  className: t.string,
  sourceCode: t.string,
  version: orUndefined(t.string),
  etag: orUndefined(t.string),
  lastModified: orUndefined(t.string)
})

export type AbapClassSourceInfo = t.OutputOf<typeof AbapClassSourceInfo>

/**
 * ABAP Class Lock Result - ABAP 类锁定结果
 */
export const AbapClassLockResult = t.type({
  lockHandle: t.string,
  corrNr: orUndefined(t.string),
  corrUser: orUndefined(t.string),
  corrText: orUndefined(t.string),
  isLocal: orUndefined(t.boolean),
  isLinkUp: orUndefined(t.boolean),
  modificationSupport: orUndefined(t.string)
})

export type AbapClassLockResult = t.OutputOf<typeof AbapClassLockResult>

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get ABAP Class Metadata - 获取 ABAP 类元数据
 *
 * 对应请求: GET /sap/bc/adt/oo/classes/{classname}
 *
 * @param client - ADT HTTP 客户端
 * @param className - 类名 (如 /BIC/3MBWOUHEKC014661O472_M)
 * @param version - 版本 (active, inactive)
 * @returns ABAP 类元数据
 */
export async function getAbapClassMetadata(
  client: AdtHTTP,
  className: string,
  version?: "active" | "inactive"
): Promise<AbapClassMetadata> {
  const encodedName = encodeURIComponent(className)
  const qs: Record<string, string> = {}
  if (version) {
    qs.version = version
  }

  const response = await client.request(
    `/sap/bc/adt/oo/classes/${encodedName}`,
    {
      method: "GET",
      qs,
      headers: {
        "Accept": "application/vnd.sap.adt.oo.classes.v4+xml,application/vnd.sap.adt.oo.classes.v3+xml,application/vnd.sap.adt.oo.classes.v2+xml,application/vnd.sap.adt.oo.classes+xml"
      }
    }
  )

  return parseAbapClassMetadata(response.body)
}

/**
 * Get ABAP Class Source Code - 获取 ABAP 类源代码
 *
 * 对应请求: GET /sap/bc/adt/oo/classes/{classname}/source/main
 *
 * @param client - ADT HTTP 客户端
 * @param className - 类名
 * @param version - 版本 (active, inactive)
 * @returns ABAP 类源代码信息
 */
export async function getAbapClassSource(
  client: AdtHTTP,
  className: string,
  version?: "active" | "inactive"
): Promise<AbapClassSourceInfo> {
  const encodedName = encodeURIComponent(className)
  const qs: Record<string, string> = {}
  if (version) {
    qs.version = version
  }

  const response = await client.request(
    `/sap/bc/adt/oo/classes/${encodedName}/source/main`,
    {
      method: "GET",
      qs,
      headers: {
        "Accept": "text/plain"
      }
    }
  )

  return {
    className,
    sourceCode: response.body as string,
    version: response.headers["etag"] ? parseVersionFromEtag(response.headers["etag"] as string) : version,
    etag: response.headers["etag"] as string,
    lastModified: response.headers["last-modified"] as string
  }
}

/**
 * Update ABAP Class Source Code - 更新 ABAP 类源代码
 *
 * 对应请求: PUT /sap/bc/adt/oo/classes/{classname}/source/main?lockHandle={lockHandle}
 *
 * @param client - ADT HTTP 客户端
 * @param className - 类名
 * @param sourceCode - ABAP 源代码
 * @param lockHandle - 锁定句柄
 * @returns 更新结果（包含 etag 和 lastModified）
 */
export async function updateAbapClassSource(
  client: AdtHTTP,
  className: string,
  sourceCode: string,
  lockHandle: string
): Promise<{ etag?: string; lastModified?: string }> {
  const encodedName = encodeURIComponent(className)

  const response = await client.request(
    `/sap/bc/adt/oo/classes/${encodedName}/source/main`,
    {
      method: "PUT",
      qs: { lockHandle },
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Accept": "text/plain"
      },
      body: sourceCode
    }
  )

  return {
    etag: response.headers["etag"] as string,
    lastModified: response.headers["last-modified"] as string
  }
}

/**
 * Lock ABAP Class - 锁定 ABAP 类
 *
 * 对应请求: POST /sap/bc/adt/oo/classes/{classname}?action=lock
 *
 * @param client - ADT HTTP 客户端
 * @param className - 类名
 * @returns 锁定结果
 */
export async function lockAbapClass(
  client: AdtHTTP,
  className: string
): Promise<AbapClassLockResult> {
  const encodedName = encodeURIComponent(className)

  const response = await client.request(
    `/sap/bc/adt/oo/classes/${encodedName}?action=lock`,
    {
      method: "POST",
      headers: {
        "Accept": "application/vnd.sap.as+xml; charset=utf-8; dataname=com.sap.adt.lock.Result"
      }
    }
  )

  return parseLockResult(response.body)
}

/**
 * Unlock ABAP Class - 解锁 ABAP 类
 *
 * 对应请求: POST /sap/bc/adt/oo/classes/{classname}?action=unlock
 *
 * @param client - ADT HTTP 客户端
 * @param className - 类名
 * @param lockHandle - 锁定句柄
 */
export async function unlockAbapClass(
  client: AdtHTTP,
  className: string,
  lockHandle: string
): Promise<void> {
  const encodedName = encodeURIComponent(className)

  await client.request(
    `/sap/bc/adt/oo/classes/${encodedName}?action=unlock`,
    {
      method: "POST",
      qs: { lockHandle },
      headers: {
        "Accept": "application/vnd.sap.as+xml; charset=utf-8; dataname=com.sap.adt.lock.Result"
      }
    }
  )
}

/**
 * Get ABAP Class Object Structure - 获取 ABAP 类对象结构
 *
 * 对应请求: GET /sap/bc/adt/oo/classes/{classname}/objectstructure
 *
 * @param client - ADT HTTP 客户端
 * @param className - 类名
 * @returns 对象结构
 */
export async function getAbapClassObjectStructure(
  client: AdtHTTP,
  className: string,
  options?: { version?: string; withShortDescriptions?: boolean }
): Promise<any> {
  const encodedName = encodeURIComponent(className)
  const qs: Record<string, string> = {}
  if (options?.version) {
    qs.version = options.version
  }
  if (options?.withShortDescriptions !== undefined) {
    qs.withShortDescriptions = options.withShortDescriptions.toString()
  }

  const response = await client.request(
    `/sap/bc/adt/oo/classes/${encodedName}/objectstructure`,
    {
      method: "GET",
      qs,
      headers: {
        "Accept": "application/vnd.sap.adt.objectstructure.v2+xml"
      }
    }
  )

  return fullParse(response.body)
}

// ============================================================================
// Parse Functions
// ============================================================================

/**
 * Parse ABAP Class Metadata - 解析 ABAP 类元数据
 */
function parseAbapClassMetadata(body: string): AbapClassMetadata {
  const parsed = fullParse(body)
  const root = parsed["class:abapClass"] || parsed

  const includes = xmlArray(root, "class:include").map((inc: any) => {
    return {
      includeType: inc["@_class:includeType"],
      sourceUri: inc["abapsource:sourceUri"],
      name: inc["adtcore:name"],
      type: inc["adtcore:type"],
      changedAt: inc["adtcore:changedAt"],
      version: inc["adtcore:version"],
      createdAt: inc["adtcore:createdAt"],
      changedBy: inc["adtcore:changedBy"],
      createdBy: inc["adtcore:createdBy"],
      etag: extractEtagFromInclude(inc)
    }
  })

  const links = xmlArray(root, "atom:link").map((link: any) => ({
    rel: link["@_rel"] || link["rel"] || "",
    href: link["@_href"] || link["href"] || "",
    type: link["@_type"] || link["type"],
    title: link["@_title"] || link["title"]
  }))

  return {
    name: root["adtcore:name"] || root["@_name"] || "",
    description: root["adtcore:description"] || root["@_description"],
    responsible: root["adtcore:responsible"],
    masterLanguage: root["adtcore:masterLanguage"],
    masterSystem: root["adtcore:masterSystem"],
    package: root["adtcore:packageRef"]?.["@_name"],
    version: root["adtcore:version"],
    changedAt: root["adtcore:changedAt"],
    changedBy: root["adtcore:changedBy"],
    createdAt: root["adtcore:createdAt"],
    createdBy: root["adtcore:createdBy"],
    final: root["@_class:final"] === "true" || root["@_class:final"] === true,
    abstract: root["@_class:abstract"] === "true" || root["@_class:abstract"] === true,
    visibility: root["@_class:visibility"],
    category: root["@_class:category"],
    sharedMemoryEnabled: root["@_class:sharedMemoryEnabled"] === "true" || root["@_class:sharedMemoryEnabled"] === true,
    includes: includes.length > 0 ? includes : undefined,
    links: links.length > 0 ? links : undefined
  }
}

/**
 * Parse Lock Result - 解析锁定结果
 */
function parseLockResult(body: string): AbapClassLockResult {
  const parsed = fullParse(body)
  const asx = parsed["asx:abap"]
  const values = asx?.["asx:values"]?.["DATA"]

  return {
    lockHandle: values?.["LOCK_HANDLE"] || "",
    corrNr: values?.["CORRNR"],
    corrUser: values?.["CORRUSER"],
    corrText: values?.["CORRTEXT"],
    isLocal: values?.["IS_LOCAL"] === "X",
    isLinkUp: values?.["IS_LINK_UP"] === "X",
    modificationSupport: values?.["MODIFICATION_SUPPORT"]
  }
}

/**
 * Extract ETag from Include Node - 从 include 节点提取 ETag
 */
function extractEtagFromInclude(inc: any): string | undefined {
  const links = xmlArray(inc, "atom:link")
  const sourceLink = links.find(
    (link: any) => link["@_rel"] === "http://www.sap.com/adt/relations/source"
  )
  return (sourceLink as any)?.["@_etag"]
}

/**
 * Parse Version from ETag - 从 ETag 解析版本信息
 */
function parseVersionFromEtag(etag: string): string | undefined {
  // ETag format: 20260311122353000000011
  // This is a timestamp-based etag, we can extract the version from it
  // For now, just return the etag itself
  return etag
}
