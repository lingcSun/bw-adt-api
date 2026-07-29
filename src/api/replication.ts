import { fullParse, xmlNodeAttr, xmlArray, xmlNode, parse } from "../utilities"
import { AdtHTTP } from "../AdtHTTP"
import { ReplicationTask, ReplicationResult } from "./types"

/**
 * 把任意值强转为 string。
 * fullParse 启用 parseAttributeValue, 会把 "true"→true / "09172600"→9172600。
 * 这里统一回字符串以匹配 BW 的定长字段语义。
 */
function asString(v: any): string | undefined {
  if (v === undefined || v === null) return undefined
  return String(v)
}

/**
 * 把任意值强转为 boolean。
 * fullParse 启用 parseAttributeValue 时 "true"→true (boolean), 否则为字符串 "true"。
 */
function asBool(v: any): boolean | undefined {
  if (v === undefined || v === null) return undefined
  if (typeof v === "boolean") return v
  return v === "true"
}

// ============================================================================
// Constants
// ============================================================================

const REPLICATION_ENDPOINT = "/sap/bw/modeling/lsysint/replication"

/**
 * SAP DataSource 名称的标准定长长度 (RSOSG-NAME, 30 字符)。
 *
 * 实测 (Eclipse Communication Log): replication 端点的 datasource query 参数
 * 会把名称用空格补齐到 30 字符。例如 "ZBW_FI_TASKSTAGE_I" (19 字符) 补 11 个空格。
 * 这是 BW 元数据的定长字段特征。此处统一处理, 避免调用方手动补齐。
 */
const DATASOURCE_NAME_LENGTH = 30

/**
 * 把 datasource 名称补齐到 BW 定长 (30 字符)。
 * 超过 30 字符则原样返回 (SAP 实际会截断, 但此处不主动截断以免误伤)。
 */
function padDatasourceName(datasource: string): string {
  const trimmed = datasource.trim()
  if (trimmed.length >= DATASOURCE_NAME_LENGTH) return trimmed
  return trimmed.padEnd(DATASOURCE_NAME_LENGTH)
}

// ============================================================================
// Read / Pre-check
// ============================================================================

/**
 * Get Replication Info - 查询数据源复制信息 (复制预检)
 *
 * 对应请求: GET /sap/bw/modeling/lsysint/replication/{sourceSystem}?datasource={ds}
 *
 * datasource 参数会自动补齐到 30 字符定长 (BW 元数据特征)。
 * 返回一个或多个 replicationTask, 描述将如何复制该数据源。
 *
 * 实测响应 (ATOM feed):
 *   <atom:feed>
 *     <atom:entry>
 *       <atom:content>
 *         <dsReplication:replicationTask datasource="..." tlogo="RSDS"
 *           operation="UEQ" execute="true" externalObject="..." .../>
 *       </atom:content>
 *       <atom:id>/sap/bw/modeling/rsds/{ds}/{src}/m</atom:id>
 *     </atom:entry>
 *   </atom:feed>
 *
 * @param client - ADT HTTP 客户端
 * @param sourceSystem - 源系统逻辑名 (如 "S4DCLNT300")
 * @param datasource - DataSource 技术名 (如 "ZBW_FI_TASKSTAGE_I")
 * @returns 复制任务列表
 */
export async function getReplicationInfo(
  client: AdtHTTP,
  sourceSystem: string,
  datasource: string
): Promise<ReplicationTask[]> {
  const response = await client.request(`${REPLICATION_ENDPOINT}/${sourceSystem}`, {
    method: "GET",
    qs: {
      datasource: padDatasourceName(datasource)
    },
    headers: {
      Accept: "application/atom+xml;type=feed"
    }
  })

  return parseReplicationTasks(response.body)
}

// ============================================================================
// Trigger Replication
// ============================================================================

/**
 * Replicate DataSource - 触发数据源复制
 *
 * 对应请求: POST /sap/bw/modeling/lsysint/replication/{sourceSystem}
 *                       ?datasource={ds}&activate={changed|all}&background={true|false}
 *
 * **请求体**: 必须把预检 (getReplicationInfo) 返回的 replicationTask 原样回传,
 * 包装为 ATOM feed (这是 Eclipse 实测的协议要求)。
 *
 * 实测响应 (后台执行时):
 *   <dataContainer>
 *     <simpleParams jobCount="09172600"/>
 *     <simpleParams jobName="RSDS_REPLICATION"/>
 *   </dataContainer>
 * → 返回 jobName / jobCount 用于追踪后台执行状态。
 *
 * @param client - ADT HTTP 客户端
 * @param sourceSystem - 源系统逻辑名
 * @param datasource - DataSource 技术名
 * @param tasks - 从 getReplicationInfo 获取的任务 (必须原样回传)
 * @param options - activate 策略 / 是否后台执行
 * @returns 复制结果 (job 句柄)
 */
export async function replicateDataSource(
  client: AdtHTTP,
  sourceSystem: string,
  datasource: string,
  tasks: ReplicationTask[],
  options: {
    /** 激活策略: "changed" (默认, 仅激活变更) / "all" / 空字符串 */
    activate?: string
    /** 是否后台执行 (默认 true, 避免阻塞 HTTP 请求) */
    background?: boolean
  } = {}
): Promise<ReplicationResult> {
  const { activate = "changed", background = true } = options

  const body = buildReplicationRequestBody(tasks)

  const response = await client.request(`${REPLICATION_ENDPOINT}/${sourceSystem}`, {
    method: "POST",
    qs: {
      datasource: padDatasourceName(datasource),
      activate,
      background: String(background)
    },
    headers: {
      "Content-Type": "application/atom+xml;type=entry",
      Accept: "application/xml"
    },
    body
  })

  return parseReplicationResult(response.body)
}

/**
 * Replicate DataSource (full) - 一站式: 预检 → 触发复制
 *
 * 自动调用 getReplicationInfo 获取任务, 再回传触发。适合简单场景。
 * 如需在预检后人工确认/修改任务, 请分别调用 getReplicationInfo + replicateDataSource。
 *
 * @param client - ADT HTTP 客户端
 * @param sourceSystem - 源系统逻辑名
 * @param datasource - DataSource 技术名
 * @param options - activate 策略 / 是否后台执行
 * @returns 复制结果 (含预检的任务和触发的 job 句柄)
 */
export async function replicateDataSourceFull(
  client: AdtHTTP,
  sourceSystem: string,
  datasource: string,
  options: {
    activate?: string
    background?: boolean
  } = {}
): Promise<{
  tasks: ReplicationTask[]
  result: ReplicationResult
}> {
  const tasks = await getReplicationInfo(client, sourceSystem, datasource)
  const result = await replicateDataSource(client, sourceSystem, datasource, tasks, options)
  return { tasks, result }
}

// ============================================================================
// Helpers (XML parsing / building, 无网络依赖)
// ============================================================================

/**
 * 构造 replication POST 请求体 (把预检返回的 replicationTask 回传)。
 *
 * 实测 Eclipse 请求体结构:
 *   <?xml version="1.0" encoding="UTF-8"?>
 *   <atom:feed xmlns:atom="..." xmlns:dsReplication="http://www.sap.com/bw/modeling/lsysint">
 *     <atom:entry>
 *       <atom:content type="application/xml">
 *         <dsReplication:replicationTask datasource="..." tlogo="RSDS" .../>
 *       </atom:content>
 *     </atom:entry>
 *   </atom:feed>
 */
export function buildReplicationRequestBody(tasks: ReplicationTask[]): string {
  const taskXml = tasks
    .map(t => {
      const attrs = [
        `datasource="${t.datasource}"`,
        t.tlogo ? `tlogo="${t.tlogo}"` : "",
        t.description !== undefined ? `description="${t.description}"` : "",
        t.externalObject ? `externalObject="${t.externalObject}"` : "",
        t.externalObjectDescription !== undefined
          ? `externalObjectDescription="${t.externalObjectDescription}"`
          : "",
        t.operation ? `operation="${t.operation}"` : "",
        `execute="${t.execute === false ? "false" : "true"}"`
      ]
        .filter(Boolean)
        .join(" ")
      return `      <dsReplication:replicationTask ${attrs}></dsReplication:replicationTask>`
    })
    .join("\n")

  return `<?xml version="1.0" encoding="UTF-8"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dsReplication="http://www.sap.com/bw/modeling/lsysint"><atom:entry><atom:content type="application/xml">
${taskXml}
    </atom:content></atom:entry></atom:feed>`
}

/**
 * Parse Replication Tasks - 解析复制预检响应 (ATOM feed → replicationTask[])
 */
export function parseReplicationTasks(body: string): ReplicationTask[] {
  const parsed = fullParse(body)
  const feed = xmlNode(parsed, "atom:feed")

  if (!feed) {
    return []
  }

  const entries = xmlArray(feed, "atom:entry")

  return entries.map((entry: any) => {
    const content = xmlNode(entry, "atom:content")
    const task = xmlNode(content, "dsReplication:replicationTask") ||
                 xmlNode(content, "replicationTask")
    const id = xmlNode(entry, "atom:id") || ""
    const attrs = task ? xmlNodeAttr(task) : {}

    return {
      datasource: asString(attrs.datasource ?? task?.["@_datasource"]) || "",
      tlogo: asString(attrs.tlogo ?? task?.["@_tlogo"]),
      externalObject: asString(attrs.externalObject ?? task?.["@_externalObject"]),
      externalObjectDescription: asString(
        attrs.externalObjectDescription ?? task?.["@_externalObjectDescription"]
      ),
      description: asString(attrs.description ?? task?.["@_description"]),
      operation: asString(attrs.operation ?? task?.["@_operation"]),
      execute: asBool(attrs.execute ?? task?.["@_execute"]),
      uri: id || undefined
    }
  })
}

/**
 * Parse Replication Result - 解析复制触发响应
 *
 * 实测响应结构:
 *   <dataContainer>
 *     <simpleParams jobCount="09172600"/>
 *     <simpleParams jobName="RSDS_REPLICATION"/>
 *   </dataContainer>
 */
export function parseReplicationResult(body: string): ReplicationResult {
  // 注意:不用 fullParse (其 parseAttributeValue 会把 jobCount="09172600" 解析成数字 9172600,
  // 丢失前导零)。用普通 parse 保留为字符串。
  const parsed = parse(body, { ignoreAttributes: false, trimValues: false })
  const container = parsed["dataContainer"] || parsed

  // simpleParams 可能是数组或单个
  const paramsList = xmlArray(container, "simpleParams")

  let jobName: string | undefined
  let jobCount: string | undefined

  for (const p of paramsList) {
    const attrs = xmlNodeAttr(p) || {}
    if (attrs.jobName !== undefined) jobName = asString(attrs.jobName)
    if (attrs.jobCount !== undefined) jobCount = asString(attrs.jobCount)
  }

  // 兜底: 直接读属性
  if (!jobName && container["simpleParams"]?.["@_jobName"]) {
    jobName = asString(container["simpleParams"]["@_jobName"])
  }
  if (!jobCount && container["simpleParams"]?.["@_jobCount"]) {
    jobCount = asString(container["simpleParams"]["@_jobCount"])
  }

  return {
    jobName,
    jobCount
  }
}
