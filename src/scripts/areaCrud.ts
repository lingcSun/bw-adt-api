import { BWAdtClient } from "../BWAdtClient"
import * as dotenv from "dotenv"

// 加载环境变量
dotenv.config()

const config = {
  baseUrl: process.env.BW_BASE_URL || "http://your-bw-server:8000",
  username: process.env.BW_USERNAME || "your-username",
  password: process.env.BW_PASSWORD || "your-password",
  client: process.env.BW_CLIENT || "100",
  language: process.env.BW_LANGUAGE || "ZH"
}

const AREA_NAME = process.env.AREA_NAME || "ZADT_API_CRUD01"
const PARENT_AREA = process.env.PARENT_AREA || "ZGLD_TEST"
const DEVELOPMENT_CLASS = process.env.DEVELOPMENT_CLASS || "$TMP"
const CLEAN_BEFORE = ["1", "true", "yes", "y"].includes(
  (process.env.CLEAN_BEFORE || "true").toLowerCase()
)

function buildAreaXML(options: {
  name: string
  parentInfoArea: string
  description: string
  responsible?: string
  masterLanguage?: string
  language?: string
}): string {
  const {
    name,
    parentInfoArea,
    description,
    responsible = "",
    masterLanguage = "ZH",
    language = "ZH"
  } = options

  return `<?xml version="1.0" encoding="UTF-8"?>
<InfoArea:infoArea xmlns:InfoArea="http://www.sap.com/bw/modeling/BwInfoArea.ecore" xmlns:adtcore="http://www.sap.com/adt/core" name="${name}" parentInfoArea="${parentInfoArea}">
  <longDescription>${description}</longDescription>
  <tlogoProperties adtcore:language="${language}" adtcore:name="${name}" adtcore:type="AREA" adtcore:masterLanguage="${masterLanguage}" adtcore:masterSystem="BPD" adtcore:responsible="${responsible}">
    <infoArea>${parentInfoArea}</infoArea>
  </tlogoProperties>
</InfoArea:infoArea>`
}

function extractDescription(xml: string): string {
  return xml.match(/<longDescription>(.*?)<\/longDescription>/)?.[1] || "N/A"
}

async function existsArea(areaObj: Awaited<ReturnType<BWAdtClient["getObject"]>>): Promise<boolean> {
  try {
    await areaObj.exists()
    return true
  } catch (error: any) {
    const msg = String(error?.message || "")
    if (/does not exist|not exist|不存在/i.test(msg)) return false
    throw error
  }
}

async function main() {
  console.log("==========================================")
  console.log("    InfoArea CRUD 脚本")
  console.log("==========================================\n")

  const client = new BWAdtClient(
    config.baseUrl,
    config.username,
    config.password,
    config.client,
    config.language
  )

  try {
    console.log("1. 连接到 SAP BW 系统...")
    await client.login()
    console.log("   ✓ 登录成功\n")

    console.log(`2. 校验父区域: ${PARENT_AREA}`)
    const parentObj = await client.getObject("area", PARENT_AREA)
    await parentObj.exists()
    console.log("   ✓ 父区域存在\n")

    const areaObj = await client.getObject("area", AREA_NAME)

    console.log(`3. 预检查目标区域: ${AREA_NAME}`)
    const existsBefore = await existsArea(areaObj)
    console.log(`   - 当前是否存在: ${existsBefore ? "是" : "否"}`)
    if (existsBefore && CLEAN_BEFORE) {
      console.log("   - CLEAN_BEFORE=true，先删除已有对象...")
      const lockResult = await areaObj.lock()
      await areaObj.delete(lockResult.lockHandle)
      console.log("   ✓ 已清理旧对象")
    } else if (existsBefore) {
      throw new Error("目标区域已存在。可设置 CLEAN_BEFORE=true 自动清理后继续。")
    }
    console.log("")

    const createDescription = `ADT API CRUD 创建 - ${new Date().toISOString()}`
    console.log("4. 创建 InfoArea...")
    const createXml = buildAreaXML({
      name: AREA_NAME,
      parentInfoArea: PARENT_AREA,
      description: createDescription,
      responsible: config.username,
      language: config.language
    })
    await client.createObject("area", AREA_NAME, createXml, {
      parent: PARENT_AREA,
      headers: { "Development-Class": DEVELOPMENT_CLASS }
    })
    console.log("   ✓ 创建成功\n")

    console.log("5. 修改 InfoArea 描述（原地 update）...")
    const updateDescription = `ADT API CRUD 修改 - ${new Date().toISOString()}`
    const updateXml = buildAreaXML({
      name: AREA_NAME,
      parentInfoArea: PARENT_AREA,
      description: updateDescription,
      responsible: config.username,
      language: config.language
    })
    const updateLock = await areaObj.lock()
    try {
      await client.updateObject("area", AREA_NAME, updateXml, {
        lockHandle: updateLock.lockHandle,
        headers: { "Development-Class": DEVELOPMENT_CLASS }
      })
      console.log("   ✓ 修改成功\n")
    } catch (error: any) {
      const msg = String(error?.message || "")
      if (/already exists/i.test(msg)) {
        throw new Error(
          "当前系统不支持 InfoArea 原地 update（返回 already exists），且已按你的要求禁用删除重建。"
        )
      }
      throw error
    } finally {
      try {
        await areaObj.unlock()
      } catch {
        // update 失败后可能已无锁或对象状态变化，忽略 unlock 异常
      }
    }

    console.log("6. 校验修改结果...")
    const detailsAfterUpdate = await areaObj.getDetails()
    const currentDescription = extractDescription(detailsAfterUpdate)
    console.log(`   - 当前描述: ${currentDescription}`)
    if (currentDescription !== updateDescription) {
      throw new Error("修改后描述不匹配，更新可能未生效。")
    }
    console.log("   ✓ 修改校验通过\n")

    console.log("7. 删除 InfoArea...")
    const deleteLockResult = await areaObj.lock()
    await areaObj.delete(deleteLockResult.lockHandle)
    console.log("   ✓ 删除成功\n")

    console.log("8. 校验删除结果...")
    const existsAfterDelete = await existsArea(areaObj)
    if (existsAfterDelete) {
      throw new Error("删除后对象仍存在。")
    }
    console.log("   ✓ 删除校验通过\n")

    console.log("==========================================")
    console.log("    CRUD 执行完成!")
    console.log("==========================================")
  } catch (error: any) {
    console.error("\n❌ CRUD 执行失败:")
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
        // 脚本收尾阶段忽略登出异常，避免覆盖主流程结果
      }
      console.log("\n已登出")
    }
  }
}

main().catch(console.error)
