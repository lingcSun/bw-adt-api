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

const ADSO_NAME = process.env.ADSO_NAME || "ZADCRUD01"
const INFO_AREA = process.env.PARENT_AREA || "ZGLD_TEST"
const CLEAN_BEFORE = ["1", "true", "yes", "y"].includes(
  (process.env.CLEAN_BEFORE || "true").toLowerCase()
)

function normalizeAdsoName(name: string): string {
  return name.toUpperCase()
}

function updateDescriptionInXml(xml: string, description: string): string {
  // 优先替换 endUserTexts 的 label 属性（ADSO 常见描述字段）
  const byLabel = xml.replace(
    /(<endUserTexts\b[^>]*\blabel=")([^"]*)(")/,
    `$1${description}$3`
  )
  if (byLabel !== xml) return byLabel

  // 兜底：替换通用 description 节点
  const byNode = xml.replace(
    /(<(?:adso:)?description>)([\s\S]*?)(<\/(?:adso:)?description>)/,
    `$1${description}$3`
  )
  if (byNode !== xml) return byNode

  throw new Error("无法在 ADSO XML 中定位可更新的描述字段（endUserTexts/description）")
}

async function existsAdso(client: BWAdtClient, adsoName: string): Promise<boolean> {
  try {
    await client.validateADSOExists(adsoName)
    return true
  } catch (error: any) {
    const msg = String(error?.message || "")
    if (/does not exist|not exist|不存在/i.test(msg)) return false
    throw error
  }
}

async function deleteAdso(client: BWAdtClient, adsoName: string): Promise<void> {
  const obj = await client.getObject("adso", adsoName)
  const lockResult = await obj.lock()
  await obj.delete(lockResult.lockHandle)
}

async function main() {
  const adsoName = normalizeAdsoName(ADSO_NAME)

  console.log("==========================================")
  console.log("    ADSO CRUD 脚本")
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

    console.log(`2. 校验 InfoArea: ${INFO_AREA}`)
    await client.validateInfoArea(INFO_AREA)
    console.log("   ✓ InfoArea 存在\n")

    console.log(`3. 预检查 ADSO: ${adsoName}`)
    const alreadyExists = await existsAdso(client, adsoName)
    console.log(`   - 当前是否存在: ${alreadyExists ? "是" : "否"}`)
    if (alreadyExists && CLEAN_BEFORE) {
      console.log("   - CLEAN_BEFORE=true，先删除已有 ADSO...")
      await deleteAdso(client, adsoName)
      console.log("   ✓ 已删除旧 ADSO")
    } else if (alreadyExists) {
      throw new Error("目标 ADSO 已存在。可设置 CLEAN_BEFORE=true 自动清理后继续。")
    }
    console.log("")

    console.log("4. 创建 ADSO...")
    await client.createADSO({
      name: adsoName,
      description: `ADT API ADSO 创建 - ${new Date().toISOString()}`,
      infoArea: INFO_AREA,
      masterLanguage: config.language,
      responsible: config.username,
      masterSystem: "BPD",
      activateData: true,
      writeChangelog: true,
      readOnly: false,
      autoActivate: true
    })
    console.log("   ✓ 创建成功\n")

    console.log("5. 原地更新 ADSO 描述...")
    const adsoObj = await client.getObject("adso", adsoName)
    const currentXml = await adsoObj.getDetails()
    const updateDescription = `ADT API ADSO 修改 - ${new Date().toISOString()}`
    const updatedXml = updateDescriptionInXml(currentXml, updateDescription)

    const lockResult = await client.lockADSO(adsoName)
    try {
      await client.updateADSO(adsoName, updatedXml, lockResult.lockHandle)
    } finally {
      await client.unlockADSO(adsoName)
    }
    console.log("   ✓ 更新成功\n")

    console.log("6. 校验更新结果...")
    const updatedDetails = await client.getADSODetails(adsoName, true)
    const finalDescription = updatedDetails.description || ""
    console.log(`   - 当前描述: ${finalDescription || "N/A"}`)
    if (!finalDescription.includes("ADT API ADSO 修改")) {
      throw new Error("更新后描述校验失败，未读取到预期描述。")
    }
    console.log("   ✓ 更新校验通过\n")

    console.log("7. 删除 ADSO...")
    await deleteAdso(client, adsoName)
    console.log("   ✓ 删除成功\n")

    console.log("8. 校验删除结果...")
    const existsAfterDelete = await existsAdso(client, adsoName)
    if (existsAfterDelete) {
      throw new Error("删除后 ADSO 仍存在。")
    }
    console.log("   ✓ 删除校验通过\n")

    console.log("==========================================")
    console.log("    ADSO CRUD 执行完成!")
    console.log("==========================================")
  } catch (error: any) {
    console.error("\n❌ ADSO CRUD 执行失败:")
    console.error(`   ${error?.message || error}`)
    if (error?.stack) {
      console.error("\n堆栈信息:")
      console.error(error.stack)
    }
  } finally {
    if (client.loggedin) {
      try {
        await client.logout()
      } catch {
        // 忽略收尾登出异常
      }
      console.log("\n已登出")
    }
  }
}

main().catch(console.error)
