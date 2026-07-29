import {
  parseDataSourceDetails,
  parseDataSourceFields,
  parseDataSourceVersions,
  extractDataSourceTimestamp,
  RSDS_PROPOSAL_REQUEST_CONTENT_TYPE,
  RSDS_PROPOSAL_RESPONSE_CONTENT_TYPE
} from "../api/datasource"
import { fullParse } from "../utilities"
import {
  parseReplicationTasks,
  parseReplicationResult,
  buildReplicationRequestBody
} from "../api/replication"

/**
 * 纯 XML 解析测试 — 对照 Eclipse Communication Log (2026-07-16)
 * 无网络依赖, 验证 DataSource / Replication 解析逻辑
 */

// 来自 GET /sap/bw/modeling/rsds/ZBW_ZFIVTASK_STAGE_H/S4DCLNT300/m 的响应 (精简, 保留结构)
const SAMPLE_DS_XML = `<?xml version="1.0" encoding="utf-8"?>
<rsds:dataSource hybridAccess="false" directAccess="1" type="D" sourceSystemName="S4DCLNT300" sourceSystem="S4DCLNT300.lsys#//" name="ZBW_ZFIVTASK_STAGE_H" applicationComponent="FI" xmlns:rsds="http://www.sap.com/bw/modeling/DataSource.ecore" xmlns:adtcore="http://www.sap.com/adt/core"><description textType="3" label="履约义务拆分分期抬头表"/><segment ID="0001"><field name="ZXMBH"><inlineType name="CHAR" length="10"/><description textType="3" label="ZXMBH"/><fieldProperties outputLength="000010" transfer="true" position="0001"/></field><field name="MATNR"><inlineType name="CHAR" length="40"/><description textType="3" label="物料"/><fieldProperties outputLength="000040" conversionExitSource="MATN1" transfer="true" position="0009"/></field></segment><adapter name="ODP" category="E" externalObject="ZBW_ZFIVTASK_STAGE_H" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="rsds:ExtractorODP"/><tlogoProperties adtcore:name="ZBW_ZFIVTASK_STAGE_H          S4DCLNT300" adtcore:type="RSDS" adtcore:changedAt="2026-07-16T01:14:08Z" adtcore:version="inactive" adtcore:changedBy="TESTUSER"><objectVersion>M</objectVersion><objectStatus>active</objectStatus><contentState>ACT</contentState></tlogoProperties></rsds:dataSource>`

const SAMPLE_VERSIONS_XML = `<?xml version="1.0" encoding="utf-8"?><atom:feed xml:lang="1" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:bwModel="http://www.sap.com/bw/modeling"><atom:title>Version list</atom:title><atom:updated>2026-07-16T01:21:20Z</atom:updated><atom:entry><atom:author><atom:name>TESTUSER</atom:name></atom:author><atom:content type="application/xml"><bwModel:object objectName="ZBW_ZFIVTASK_STAGE_H          S4DCLNT300" objectType="RSDS"/></atom:content><atom:id>A</atom:id><atom:link href="/sap/bw/modeling/rsds/ZBW_ZFIVTASK_STAGE_H/S4DCLNT300/m" rel="self" type="application/vnd.sap-bw-modeling.datasource+xml"/><atom:title>Active</atom:title><atom:updated>2026-07-16T01:14:12Z</atom:updated></atom:entry></atom:feed>`

const SAMPLE_REPLICATION_INFO_XML = `<?xml version="1.0" encoding="utf-8"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:lsysService="http://www.sap.com/bw/modeling/lsysint/"><atom:title>数据源复制</atom:title><atom:entry><atom:content type="application/xml"><dsReplication:replicationTask datasource="ZBW_FI_TASKSTAGE_I" description="" tlogo="RSDS" applicationComponent="" externalObject="ZBW_FI_TASKSTAGE_I" externalObjectDescription="" operation="UEQ" execute="true" xmlns:dsReplication="http://www.sap.com/bw/modeling/lsysint"/></atom:content><atom:id>/sap/bw/modeling/rsds/ZBW_FI_TASKSTAGE_I/S4DCLNT300/m</atom:id><atom:title>复制任务</atom:title></atom:entry></atom:feed>`

const SAMPLE_REPLICATION_RESULT_XML = `<?xml version="1.0" encoding="utf-8"?><dataContainer><simpleParams jobCount="09172600"/><simpleParams jobName="RSDS_REPLICATION"/></dataContainer>`

describe("DataSource (RSDS) XML parsing", () => {
  test("parseDataSourceDetails() - 解析根属性 + tlogoProperties", () => {
    const raw = fullParse(SAMPLE_DS_XML)
    const details = parseDataSourceDetails(raw)

    expect(details.name).toBe("ZBW_ZFIVTASK_STAGE_H")
    expect(details.technicalName).toBe("ZBW_ZFIVTASK_STAGE_H")
    expect(details.type).toBe("D")
    expect(details.sourceSystem).toBe("S4DCLNT300")
    expect(details.applicationComponent).toBe("FI")
    expect(details.adapterType).toBe("ODP")
    expect(details.description).toBe("履约义务拆分分期抬头表")
    expect(details.objectVersion).toBe("M")
    expect(details.objectStatus).toBe("active")
  })

  test("parseDataSourceFields() - 解析 segment 下的字段", () => {
    const raw = fullParse(SAMPLE_DS_XML)
    const fields = parseDataSourceFields(raw)

    expect(fields.length).toBe(2)
    expect(fields[0].name).toBe("ZXMBH")
    expect(fields[0].dataType).toBe("CHAR")
    expect(fields[0].length).toBe(10)
    expect(fields[0].position).toBe(1)
    expect(fields[0].transfer).toBe(true)

    expect(fields[1].name).toBe("MATNR")
    expect(fields[1].dataType).toBe("CHAR")
    expect(fields[1].length).toBe(40)
    expect(fields[1].label).toBe("物料")
    expect(fields[1].position).toBe(9)
  })

  test("parseDataSourceVersions() - 版本字符从 <atom:id> 提取 (非 uri 后缀)", () => {
    const versions = parseDataSourceVersions(SAMPLE_VERSIONS_XML)

    expect(versions.length).toBe(1)
    // 关键: 版本字符在 <atom:id>A</atom:id> (大写 A=Active), 不是 uri 的 /m 后缀
    expect(versions[0].version).toBe("A")
    expect(versions[0].uri).toBe("/sap/bw/modeling/rsds/ZBW_ZFIVTASK_STAGE_H/S4DCLNT300/m")
    expect(versions[0].description).toBe("Active")
    expect(versions[0].user).toBe("TESTUSER")
    expect(versions[0].created).toBe("2026-07-16T01:14:12Z")
  })

  test("extractDataSourceTimestamp() - 从 changedAt 生成 PUT timestamp 头", () => {
    expect(extractDataSourceTimestamp(SAMPLE_DS_XML)).toBe("20260716011408")
  })

  test("extractDataSourceTimestamp() - 无 changedAt 时返回 undefined", () => {
    expect(extractDataSourceTimestamp("<foo></foo>")).toBeUndefined()
  })

  test("proposal/merge Content-Type 常量 - 对照 Eclipse 实测请求/响应头", () => {
    // 请求 Content-Type (Eclipse POST /rsdsint/proposal?action=merge)
    expect(RSDS_PROPOSAL_REQUEST_CONTENT_TYPE).toBe("application/vnd.sap.bw.modeling.rsds+xml")
    // 响应 Content-Type
    expect(RSDS_PROPOSAL_RESPONSE_CONTENT_TYPE).toBe("application/vnd.sap.bw.modeling.rsdsint+xml")
  })

  test("proposal/merge 响应可被 parseDataSourceDetails 解析 (结构与 GET /m 一致)", () => {
    // merge 响应是合并后的完整 DataSource XML, 结构与 GET /rsds/{ds}/{src}/m 相同,
    // 因此可直接复用现有解析器。这证明 merge 返回值可直接用作 PUT body。
    const mergeResponseXml = `<?xml version="1.0" encoding="utf-8"?>
<rsds:dataSource hybridAccess="false" directAccess="1" type="D" sourceSystemName="S4DCLNT300" name="ZBW_ZFIVTASK_STAGE_H" applicationComponent="FI" xmlns:rsds="http://www.sap.com/bw/modeling/DataSource.ecore" xmlns:adtcore="http://www.sap.com/adt/core"><description textType="3" label="履约义务拆分分期抬头表"/><segment ID="0001"><field name="ZXMBH"><inlineType name="CHAR" length="10"/><description label="ZXMBH"/><fieldProperties position="0001" transfer="true"/></field></segment><adapter name="ODP" xsi:type="rsds:ExtractorODP" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/><tlogoProperties adtcore:name="ZBW_ZFIVTASK_STAGE_H          S4DCLNT300" adtcore:changedAt="2026-07-16T01:13:48Z" adtcore:version="inactive"><objectVersion>M</objectVersion><objectStatus>active</objectStatus><contentState>REV</contentState></tlogoProperties></rsds:dataSource>`

    const raw = fullParse(mergeResponseXml)

    // 复用现有 details 解析器
    const details = parseDataSourceDetails(raw)
    expect(details.name).toBe("ZBW_ZFIVTASK_STAGE_H")
    expect(details.sourceSystem).toBe("S4DCLNT300")
    expect(details.adapterType).toBe("ODP")
    expect(details.objectStatus).toBe("active")
    expect(details.description).toBe("履约义务拆分分期抬头表")

    // 复用现有 fields 解析器
    const fields = parseDataSourceFields(raw)
    expect(fields.length).toBe(1)
    expect(fields[0].name).toBe("ZXMBH")
    expect(fields[0].dataType).toBe("CHAR")

    // timestamp 也能从 merge 响应提取 (PUT 时用)
    expect(extractDataSourceTimestamp(mergeResponseXml)).toBe("20260716011348")
  })
})

describe("DataSource Replication XML parsing/building", () => {
  test("parseReplicationTasks() - 解析复制预检响应", () => {
    // datasource.ts 的导出 (再导出自 replication.ts)
    const tasks = parseReplicationTasks(SAMPLE_REPLICATION_INFO_XML)
    expect(tasks.length).toBe(1)
    expect(tasks[0].datasource).toBe("ZBW_FI_TASKSTAGE_I")
    expect(tasks[0].tlogo).toBe("RSDS")
    expect(tasks[0].operation).toBe("UEQ")
    expect(tasks[0].execute).toBe(true)
    expect(tasks[0].externalObject).toBe("ZBW_FI_TASKSTAGE_I")
    expect(tasks[0].uri).toBe("/sap/bw/modeling/rsds/ZBW_FI_TASKSTAGE_I/S4DCLNT300/m")
  })

  test("parseReplicationResult() - 解析 job 返回", () => {
    const result = parseReplicationResult(SAMPLE_REPLICATION_RESULT_XML)
    expect(result.jobName).toBe("RSDS_REPLICATION")
    expect(result.jobCount).toBe("09172600")
  })

  test("buildReplicationRequestBody() - 回传 replicationTask 为 ATOM feed", () => {
    const tasks = parseReplicationTasks(SAMPLE_REPLICATION_INFO_XML)
    const body = buildReplicationRequestBody(tasks)

    // 回传的 body 必须含 replicationTask 且属性原样
    expect(body).toContain("dsReplication:replicationTask")
    expect(body).toContain('datasource="ZBW_FI_TASKSTAGE_I"')
    expect(body).toContain('tlogo="RSDS"')
    expect(body).toContain('operation="UEQ"')
    expect(body).toContain('execute="true"')
    expect(body).toContain("<atom:feed")
    expect(body).toContain("<atom:entry>")
    expect(body).toContain("<atom:content")
  })

  test("parseReplicationTasks from replication.ts module 直接调用", () => {
    const tasks = parseReplicationTasks(SAMPLE_REPLICATION_INFO_XML)
    expect(tasks[0].datasource).toBe("ZBW_FI_TASKSTAGE_I")
  })

  test("parseReplicationResult from replication.ts module 直接调用", () => {
    const result = parseReplicationResult(SAMPLE_REPLICATION_RESULT_XML)
    expect(result.jobName).toBe("RSDS_REPLICATION")
    expect(result.jobCount).toBe("09172600")
  })

  test("buildReplicationRequestBody round-trip (回传 body 可被重新解析)", () => {
    const tasks = parseReplicationTasks(SAMPLE_REPLICATION_INFO_XML)
    const body = buildReplicationRequestBody(tasks)
    // 回传的 body 结构与 GET 响应一致 (都是 ATOM feed 包 replicationTask),
    // 用同一解析器应能再次解析
    const reparsed = parseReplicationTasks(body)
    expect(reparsed.length).toBe(1)
    expect(reparsed[0].datasource).toBe("ZBW_FI_TASKSTAGE_I")
    expect(reparsed[0].operation).toBe("UEQ")
  })
})
