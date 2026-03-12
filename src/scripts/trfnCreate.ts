import { BWAdtClient } from "../BWAdtClient"
import { AdtHTTP, session_types } from "../AdtHTTP"
import { fullParse, xmlNode, xmlNodeAttr, orUndefined } from "../utilities"
import * as dotenv from "dotenv"

dotenv.config()

const config = {
  baseUrl: process.env.BW_BASE_URL || "http://your-bw-server:8000",
  username: process.env.BW_USERNAME || "your-username",
  password: process.env.BW_PASSWORD || "your-password",
  client: process.env.BW_CLIENT || "100",
  language: process.env.BW_LANGUAGE || "ZH"
}

// 测试参数
const SOURCE_ADSO = process.env.SOURCE_ADSO || "ZL_ORDER"
const TARGET_ADSO = process.env.TARGET_ADSO || "ZSOOR031"
const CLEAN_AFTER = ["1", "true", "yes", "y"].includes(
  (process.env.CLEAN_AFTER || "false").toLowerCase()
)

/**
 * 步骤 1: 验证 ADSO 是否存在
 */
async function validateAdsoExists(client: AdtHTTP, adsoName: string): Promise<void> {
  const response = await client.request("/sap/bw/modeling/validation", {
    method: "POST",
    qs: {
      objectType: "ADSO",
      objectName: adsoName.toLowerCase(),
      action: "exists"
    }
  })

  if (response.status !== 200) {
    throw new Error(`ADSO ${adsoName} 不存在`)
  }
}

/**
 * 步骤 2: 获取临时 TRFN ID (8TRANSIENT 端点)
 * 返回临时 TRFN XML
 */
async function getTransientTrfnId(
  client: AdtHTTP,
  sourceObjType: string,
  targetObjType: string,
  sourceObjName: string,
  targetObjName: string
): Promise<{ trfnId: string; xml: string }> {
  console.log("   获取临时 TRFN ID...")
  const response = await client.request("/sap/bw/modeling/trfn/8TRANSIENT", {
    method: "GET",
    qs: {
      GetIdOnly: "true",
      sourceobjecttype: sourceObjType,
      targetobjecttype: targetObjType,
      sourceobjectname: sourceObjName,
      targetobjectname: targetObjName
    },
    headers: {
      "Accept": "application/vnd.sap.bw.modeling.trfn-v1_0_0+xml"
    }
  })

  const xml = response.body

  // 解析 TRFN ID
  const parsed = fullParse(xml)
  const trfnElem = parsed?.["trfn:transformation"]
  const trfnId = xmlNodeAttr(trfnElem)?.name ||
                 trfnElem?.["@_name"]

  if (!trfnId) {
    throw new Error("无法获取临时 TRFN ID")
  }

  console.log(`   ✓ 获得 TRFN ID: ${trfnId}`)
  return { trfnId, xml }
}

/**
 * 步骤 3: 锁定 TRFN
 */
async function lockTrfn(client: AdtHTTP, trfnId: string): Promise<{ lockHandle: string; timestamp?: string }> {
  console.log("   锁定 TRFN...")
  const trfnIdLower = trfnId.toLowerCase()
  const response = await client.request(`/sap/bw/modeling/trfn/${trfnIdLower}`, {
    method: "POST",
    qs: { action: "lock" },
    sessionType: session_types.stateful,
    headers: {
      "Accept": "application/vnd.sap.bw.modeling.trfn-v1_0_0+xml",
      "activity_context": "CREA"
    }
  })

  const parsed = fullParse(response.body)
  const data = xmlNode(parsed, "asx:abap", "asx:values", "DATA")
  const lockHandle = data?.["LOCK_HANDLE"]

  const timestamp = response.headers["timestamp"] as string

  console.log(`   ✓ 锁定成功, lockHandle: ${lockHandle}`)
  if (timestamp) {
    console.log(`   ✓ Timestamp: ${timestamp}`)
  }

  return { lockHandle: lockHandle || "", timestamp }
}

/**
 * 构建 TRFN 创建 XML - 完全按照日志格式
 *
 * 按照日志中 POST 请求的 XML 格式，不要添加额外属性
 */
function buildCompleteTrfnXml(
  transientXml: string,
  packageName: string,
  responsible: string,
  masterLanguage: string,
  masterSystem: string,
  description: string
): string {
  const parsed = fullParse(transientXml)
  const trfn = parsed?.["trfn:transformation"]

  if (!trfn) {
    throw new Error("无效的 TRFN XML")
  }

  const trfnId = trfn["@_name"] || xmlNodeAttr(trfn)?.name
  const trfnIdLower = trfnId.toLowerCase()

  const source = xmlNode(trfn, "source")
  const target = xmlNode(trfn, "target")

  const sourceName = xmlNodeAttr(source)?.name || source?.["@_name"]
  const targetName = xmlNodeAttr(target)?.name || target?.["@_name"]

  // 完全按照日志中的格式 - 不要有 createdAt、createdBy、packageRef 的 type 和 uri
  return `<?xml version="1.0" encoding="UTF-8"?>
<trfn:transformation xmlns:adtcore="http://www.sap.com/adt/core" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:trfn="http://www.sap.com/bw/modeling/Trfn.ecore" description="" endRoutine="" expertRoutine="" name="${trfnId}" startRoutine="">
  <tlogoProperties adtcore:language="${masterLanguage}" adtcore:name="${trfnId}" adtcore:type="TRFN" adtcore:version="inactive" adtcore:masterLanguage="${masterLanguage}" adtcore:masterSystem="${masterSystem}" adtcore:responsible="${responsible}">
    <atom:link href="/sap/bw/modeling/trfn/${trfnIdLower}/m" rel="self" type="application/vnd.sap-bw-modeling.trfn+xml"/>
    <adtcore:packageRef adtcore:name="$TMP"/>
    <objectVersion>M</objectVersion>
    <objectStatus>inactive</objectStatus>
    <contentState>NEW</contentState>
  </tlogoProperties>
  <source description="" id="0" name="${sourceName}" type="ADSO"/>
  <target description="" id="0" name="${targetName}" type="ADSO"/>
</trfn:transformation>`
}

/**
 * 步骤 4: 更新 TRFN 内容
 */
async function updateTrfn(
  client: AdtHTTP,
  trfnId: string,
  lockHandle: string,
  xml: string,
  timestamp?: string
): Promise<void> {
  console.log("   更新 TRFN 内容...")

  const trfnIdLower = trfnId.toLowerCase()
  const headers: Record<string, string> = {
    "Content-Type": "application/vnd.sap.bw.modeling.trfn-v1_0_0+xml",
    "Accept": "application/vnd.sap.bw.modeling.trfn-v1_0_0+xml",
    "Development-Class": "$TMP"
  }

  if (timestamp) {
    headers["timestamp"] = timestamp
  }

  const response = await client.request(`/sap/bw/modeling/trfn/${trfnIdLower}`, {
    method: "POST",
    qs: { lockHandle },
    sessionType: session_types.stateful,
    headers,
    body: xml
  })

  console.log(`   ✓ 更新成功, status: ${response.status}`)
  if (response.body) {
    console.log(`   响应内容: ${response.body.substring(0, 200)}...`)
  }
}

/**
 * 步骤 5: 解锁 TRFN
 */
async function unlockTrfn(client: AdtHTTP, trfnId: string): Promise<void> {
  console.log("   解锁 TRFN...")
  const trfnIdLower = trfnId.toLowerCase()
  await client.request(`/sap/bw/modeling/trfn/${trfnIdLower}`, {
    method: "POST",
    qs: { action: "unlock" },
    sessionType: session_types.stateful,
    headers: {
      "Accept": "application/vnd.sap.bw.modeling.trfn-v1_0_0+xml"
    }
  })
  console.log("   ✓ 解锁成功")
}

/**
 * 步骤 6: 激活 TRFN
 */
async function activateTrfn(client: AdtHTTP, trfnId: string): Promise<void> {
  console.log("   激活 TRFN...")

  const activateXml = `<?xml version="1.0" encoding="UTF-8"?>
<atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:bwModel="http://www.sap.com/bw/modeling">
  <atom:entry>
    <atom:content type="application/vnd.sap.bw.modeling.trfn-v1_0_0+xml">
      <bwModel:checkProperties version="inactive" modelContent="" lockHandle=""></bwModel:checkProperties>
    </atom:content>
    <atom:link href="/sap/bw/modeling/trfn/${trfnId}" rel="self" type="application/*"></atom:link>
  </atom:entry>
</atom:feed>`

  const response = await client.request("/sap/bw/modeling/activation", {
    method: "POST",
    headers: {
      "Content-Type": "application/atom+xml;type=entry"
    },
    body: activateXml
  })

  console.log(`   ✓ 激活请求完成, status: ${response.status}`)
}

/**
 * 步骤 7: 获取 TRFN 详情验证
 */
async function getTrfnDetails(client: AdtHTTP, trfnId: string): Promise<any> {
  console.log("   获取 TRFN 详情验证...")
  const response = await client.request(`/sap/bw/modeling/trfn/${trfnId}/m`, {
    method: "GET",
    headers: {
      "Accept": "application/vnd.sap.bw.modeling.trfn-v1_0_0+xml"
    }
  })

  const parsed = fullParse(response.body)
  const trfn = parsed?.["trfn:transformation"]
  const attrs = xmlNodeAttr(trfn)

  console.log(`   ✓ TRFN 名称: ${attrs?.name || trfn?.["@_name"]}`)

  const source = xmlNode(trfn, "source")
  const target = xmlNode(trfn, "target")
  console.log(`   ✓ 源对象: ${xmlNodeAttr(source)?.name || source?.["@_name"]}`)
  console.log(`   ✓ 目标对象: ${xmlNodeAttr(target)?.name || target?.["@_name"]}`)

  return parsed
}

/**
 * 步骤 8: 获取 TRFN 版本历史
 */
async function getTrfnVersions(client: AdtHTTP, trfnId: string): Promise<void> {
  console.log("   获取 TRFN 版本历史...")
  const response = await client.request(`/sap/bw/modeling/trfn/${trfnId}/versions`, {
    method: "GET"
  })

  const parsed = fullParse(response.body)
  const entries = parsed?.["atom:feed"]?.["atom:entry"] || []
  console.log(`   ✓ 找到 ${entries.length} 个版本`)
}

/**
 * 删除 TRFN
 */
async function deleteTrfn(client: BWAdtClient, trfnId: string): Promise<void> {
  console.log("   删除 TRFN...")
  const obj = await client.getObject("trfn", trfnId)
  const lockResult = await obj.lock()
  await obj.delete(lockResult.lockHandle)
  console.log("   ✓ 删除成功")
}

async function main() {
  console.log("==========================================")
  console.log("    TRFN 创建验证脚本")
  console.log("==========================================\n")

  const bwClient = new BWAdtClient(
    config.baseUrl,
    config.username,
    config.password,
    config.client,
    config.language
  )

  let trfnId = ""

  try {
    console.log("1. 登录系统...")
    await bwClient.login()
    console.log("   ✓ 登录成功\n")

    const httpClient = bwClient.httpClient as any

    console.log("2. 验证源 ADSO 存在...")
    await validateAdsoExists(httpClient, SOURCE_ADSO)
    console.log(`   ✓ ${SOURCE_ADSO} 存在\n`)

    console.log("3. 验证目标 ADSO 存在...")
    await validateAdsoExists(httpClient, TARGET_ADSO)
    console.log(`   ✓ ${TARGET_ADSO} 存在\n`)

    console.log("4. 获取临时 TRFN ID 和 XML...")

    // 前置步骤：获取标准传输配置
    console.log("   获取标准传输配置...")
    try {
      await httpClient.request("/sap/bw/modeling/validation", {
        method: "POST",
        qs: { objectType: "", objectName: "", action: "standard_transport" }
      })
      console.log("   ✓ 标准传输配置完成")
    } catch (e) {
      console.log("   (标准传输配置可选，跳过)")
    }

    // 前置步骤：获取 TRFN 配置
    console.log("   获取 TRFN 配置...")
    try {
      await httpClient.request("/sap/bw/modeling/trfn/configuration", {
        method: "GET"
      })
      console.log("   ✓ TRFN 配置获取完成")
    } catch (e) {
      console.log("   (TRFN 配置获取可选，跳过)")
    }

    const { trfnId: tempId, xml: transientXml } = await getTransientTrfnId(
      httpClient,
      "ADSO",
      "ADSO",
      SOURCE_ADSO,
      TARGET_ADSO
    )
    trfnId = tempId
    console.log("")

    console.log("5. 锁定 TRFN...")
    const lockResult = await lockTrfn(httpClient, trfnId)

    // 直接在同一会话中更新，不插入其他请求
    console.log("")

    console.log("6. 构建完整的 TRFN XML...")
    const description = `TRFN ${SOURCE_ADSO} -> ${TARGET_ADSO} - ${new Date().toISOString()}`
    const completeXml = buildCompleteTrfnXml(
      transientXml,
      "$TMP",           // 临时包
      config.username,  // responsible
      config.language,  // masterLanguage
      "BPD",            // masterSystem
      description
    )
    console.log("   ✓ XML 构建完成\n")

    console.log("7. 更新 TRFN 内容...")
    await updateTrfn(httpClient, trfnId, lockResult.lockHandle, completeXml, lockResult.timestamp)
    console.log("")

    console.log("8. 解锁 TRFN...")
    await unlockTrfn(httpClient, trfnId)
    console.log("")

    console.log("9. 激活 TRFN...")
    await activateTrfn(httpClient, trfnId)
    console.log("")

    console.log("10. 获取 TRFN 详情验证...")
    await getTrfnDetails(httpClient, trfnId)
    console.log("")

    console.log("11. 获取 TRFN 版本历史...")
    await getTrfnVersions(httpClient, trfnId)
    console.log("")

    console.log("==========================================")
    console.log("    TRFN 创建成功!")
    console.log(`    TRFN ID: ${trfnId}`)
    console.log("==========================================")

    if (CLEAN_AFTER) {
      console.log("\n12. 清理: 删除测试 TRFN...")
      await deleteTrfn(bwClient, trfnId)
      console.log("    ✓ 清理完成")
    }

  } catch (error: any) {
    console.error("\n❌ TRFN 创建失败:")
    console.error(`   ${error?.message || error}`)

    // 尝试输出详细错误信息
    console.error("\n=== 详细错误信息 ===")

    // 检查 response 属性（可能在错误链的任何位置）
    let current = error
    let depth = 0
    while (current && depth < 5) {
      if (current.response) {
        console.error(`[Level ${depth}] response.status: ${current.response.status}`)
        console.error(`[Level ${depth}] response.statusText: ${current.response.statusText}`)
        console.error(`[Level ${depth}] response.body:`)
        console.error(current.response.body?.substring(0, 3000) || "N/A")
        break
      }
      current = current.parent
      depth++
    }

    console.error("=== 错误信息结束 ===")

    if (error?.stack) {
      console.error("\n堆栈信息:")
      console.error(error.stack)
    }

    // 尝试清理
    if (trfnId && CLEAN_AFTER) {
      console.log("\n尝试清理失败的 TRFN...")
      try {
        await deleteTrfn(bwClient, trfnId)
        console.log("    ✓ 清理完成")
      } catch (cleanupError: any) {
        console.error("    清理失败:", cleanupError?.message || cleanupError)
      }
    }
  } finally {
    if (bwClient.loggedin) {
      try {
        await bwClient.logout()
      } catch {
        // 忽略登出异常
      }
      console.log("\n已登出")
    }
  }
}

main().catch(console.error)
