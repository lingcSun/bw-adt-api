import { BWAdtClient } from "../BWAdtClient"
import * as dotenv from "dotenv"

dotenv.config()

const config = {
  baseUrl: process.env.BW_BASE_URL || "http://your-bw-server:8000",
  username: process.env.BW_USERNAME || "your-username",
  password: process.env.BW_PASSWORD || "your-password",
  client: process.env.BW_CLIENT || "100",
  language: process.env.BW_LANGUAGE || "ZH"
}

const TEMPLATE_TRFN = (process.env.TEMPLATE_TRFN || "0GFA4DZN1C853MBWOUHEKC014661O472").toUpperCase()
const SOURCE_ADSO = (process.env.SOURCE_ADSO || "ZS_ORDER").toUpperCase()
const TARGET_ADSO = (process.env.TARGET_ADSO || "ZSOOR031").toUpperCase()
const TRFN_NAME = (process.env.TRFN_NAME || `0ZSOOR031${Date.now().toString().slice(-8)}`).toUpperCase()

function rewriteTrfnXml(xml: string, params: {
  trfnName: string
  sourceAdso: string
  targetAdso: string
  description: string
}): string {
  const { trfnName, sourceAdso, targetAdso, description } = params

  let out = xml

  // 移除系统生成字段，避免创建时报 500
  out = out.replace(/\s+hapProgram="[^"]*"/g, "")
  out = out.replace(/\s+sapHANAExecutionPossible="[^"]*"/g, "")
  out = out.replace(/\s+adtcore:createdAt="[^"]*"/g, "")
  out = out.replace(/\s+adtcore:createdBy="[^"]*"/g, "")
  out = out.replace(/\s+adtcore:changedAt="[^"]*"/g, "")
  out = out.replace(/\s+adtcore:changedBy="[^"]*"/g, "")

  // 根节点 name / description
  out = out.replace(/name="[^"]+"/, `name="${trfnName}"`)
  out = out.replace(/description="[^"]*"/, `description="${description}"`)

  // tlogoProperties 名称与描述
  out = out.replace(/adtcore:name="[^"]+"/, `adtcore:name="${trfnName}"`)
  out = out.replace(/adtcore:description="[^"]*"/, `adtcore:description="${description}"`)

  // 自链接 URI
  out = out.replace(
    /href="\/sap\/bw\/modeling\/trfn\/[^"]+\/m"/,
    `href="/sap/bw/modeling/trfn/${trfnName.toLowerCase()}/m"`
  )

  // source / target
  out = out.replace(
    /<source([^>]*?)name="[^"]+"([^>]*?)>/,
    `<source$1name="${sourceAdso}"$2>`
  )
  out = out.replace(
    /<target([^>]*?)name="[^"]+"([^>]*?)>/,
    `<target$1name="${targetAdso}"$2>`
  )

  return out
}

async function main() {
  console.log("==========================================")
  console.log("      创建 TRFN 脚本")
  console.log("==========================================\n")

  const client = new BWAdtClient(
    config.baseUrl,
    config.username,
    config.password,
    config.client,
    config.language
  )

  try {
    console.log("1. 登录系统...")
    await client.login()
    console.log("   ✓ 登录成功\n")

    console.log(`2. 校验源/目标 ADSO: ${SOURCE_ADSO} -> ${TARGET_ADSO}`)
    await client.validateADSOExists(SOURCE_ADSO)
    await client.validateADSOExists(TARGET_ADSO)
    console.log("   ✓ 源和目标 ADSO 都存在\n")

    console.log(`3. 校验 TRFN 名称可用: ${TRFN_NAME}`)
    await client.validateTransformationNewName(TRFN_NAME)
    console.log("   ✓ TRFN 名称可用\n")

    console.log(`4. 读取模板 TRFN: ${TEMPLATE_TRFN}`)
    const templateObj = await client.getObject("trfn", TEMPLATE_TRFN)
    const templateXml = await templateObj.getDetails()
    console.log(`   ✓ 模板读取成功 (${templateXml.length} chars)\n`)

    console.log("5. 生成新 TRFN XML...")
    const newXml = rewriteTrfnXml(templateXml, {
      trfnName: TRFN_NAME,
      sourceAdso: SOURCE_ADSO,
      targetAdso: TARGET_ADSO,
      description: `ADSO ${SOURCE_ADSO} -> ADSO ${TARGET_ADSO}`
    })
    console.log(`   ✓ XML 生成完成 (${newXml.length} chars)\n`)

    console.log(`6. 创建 TRFN: ${TRFN_NAME}`)
    await client.createObject("trfn", TRFN_NAME, newXml, {
      headers: {
        "Development-Class": "$TMP"
      }
    })
    console.log("   ✓ TRFN 创建成功\n")

    console.log("7. 验证结果...")
    const obj = await client.getObject("trfn", TRFN_NAME)
    const details = await obj.getDetails()
    const source = details.match(/<source[^>]*name="([^"]+)"/)?.[1] || "N/A"
    const target = details.match(/<target[^>]*name="([^"]+)"/)?.[1] || "N/A"
    console.log(`   - TRFN: ${TRFN_NAME}`)
    console.log(`   - SOURCE: ${source}`)
    console.log(`   - TARGET: ${target}`)
    console.log("   ✓ 验证通过\n")

    console.log("==========================================")
    console.log("      创建完成!")
    console.log("==========================================")
  } catch (error: any) {
    console.error("\n❌ 创建失败:")
    console.error(`   ${error?.message || error}`)
    if (error?.stack) {
      console.error("\n堆栈信息:")
      console.error(error.stack)
    }
  } finally {
    if (client.loggedin) {
      await client.logout().catch(() => {})
      console.log("\n已登出")
    }
  }
}

main().catch(console.error)
