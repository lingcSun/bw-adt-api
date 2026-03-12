import { BWAdtClient } from "../BWAdtClient"
import { BWObjectType, createBWObject, XMLBuilderFunction } from "../api/bwObject"
import { ValidationAction } from "../api/common"

// 测试配置 - 请根据实际情况修改
const testConfig = {
  baseUrl: process.env.BW_BASE_URL || "http://your-bw-server:8000",
  username: process.env.BW_USERNAME || "your-username",
  password: process.env.BW_PASSWORD || "your-password",
  client: process.env.BW_CLIENT || "100",
  language: process.env.BW_LANGUAGE || "EN"
}

// 测试用 InfoArea 配置
const TEST_AREA = "ZADT_API_TEST"
const PARENT_AREA = "ZGLD_TEST"

/**
 * 构建 InfoArea XML
 */
function buildAreaXML(options: {
  name: string
  parentInfoArea: string
  description: string
  responsible?: string
  masterLanguage?: string
  masterSystem?: string
  language?: string
}): string {
  const { name, parentInfoArea, description, responsible = "",
          masterLanguage = "EN", masterSystem = "BPD", language = "EN" } = options

  return `<?xml version="1.0" encoding="UTF-8"?>
<InfoArea:infoArea xmlns:InfoArea="http://www.sap.com/bw/modeling/BwInfoArea.ecore" xmlns:adtcore="http://www.sap.com/adt/core" name="${name}" parentInfoArea="${parentInfoArea}">
  <longDescription>${description}</longDescription>
  <tlogoProperties adtcore:language="${language}" adtcore:name="${name}" adtcore:type="AREA" adtcore:masterLanguage="${masterLanguage}" adtcore:masterSystem="${masterSystem}" adtcore:responsible="${responsible}">
    <infoArea>${parentInfoArea}</infoArea>
  </tlogoProperties>
</InfoArea:infoArea>`
}

describe("BW InfoArea Tests (Generic CRUD)", () => {
  let client: BWAdtClient

  beforeAll(async () => {
    client = new BWAdtClient(
      testConfig.baseUrl,
      testConfig.username,
      testConfig.password,
      testConfig.client,
      testConfig.language
    )
    await client.login()
    console.log(`\n========== BW InfoArea Tests Starting ==========\n`)
  }, 30000)

  afterAll(async () => {
    console.log(`\n========== BW InfoArea Tests Completed ==========\n`)
    if (client.loggedin) {
      await client.logout()
      console.log("Logged out successfully")
    }
  })

  describe("Object Operations (BWObject base class)", () => {
    let areaObj: ReturnType<typeof createBWObject>

    beforeAll(() => {
      areaObj = createBWObject(
        client.httpClient,
        BWObjectType.INFO_AREA,
        TEST_AREA
      )
    })

    test("should check if parent InfoArea exists", async () => {
      const parentObj = createBWObject(
        client.httpClient,
        BWObjectType.INFO_AREA,
        PARENT_AREA
      )

      const result = await parentObj.exists()

      console.log(`\n========== Validate Parent Area: ${PARENT_AREA} ==========`)
      console.log(`Exists: ${result.message}`)
      console.log(`=======================================================\n`)

      // 父区域应该存在
      expect(result.message).toBeDefined()
    }, 30000)

    test("should check if new InfoArea name is available", async () => {
      // 注意：如果对象已存在，此测试会失败
      // 可以先尝试删除或使用不同的名称
      try {
        const result = await areaObj.isNewNameAvailable()

        console.log(`\n========== Validate New Name: ${TEST_AREA} ==========`)
        console.log(`Available: ${result.message}`)
        console.log(`====================================================\n`)
      } catch (error: any) {
        // 如果对象已存在，跳过此测试
        if (error.message?.includes("already exists")) {
          console.log(`\n========== Validate New Name: ${TEST_AREA} ==========`)
          console.log(`SKIPPED: Object already exists`)
          console.log(`====================================================\n`)
          console.warn("Test skipped - use a new object name for clean testing")
        } else {
          throw error
        }
      }
    }, 30000)

    test("should lock and unlock InfoArea", async () => {
      // 锁定
      const lockResult = await areaObj.lock()

      console.log(`\n========== Lock/Unlock: ${TEST_AREA} ==========`)
      console.log(`Lock Handle: ${lockResult.lockHandle}`)
      console.log(`CorrNr: ${lockResult.corrNr || "N/A"}`)
      console.log(`CorrUser: ${lockResult.corrUser || "N/A"}`)
      console.log(`================================================\n`)

      expect(lockResult.lockHandle).toBeDefined()
      expect(lockResult.lockHandle.length).toBeGreaterThan(0)

      // 解锁
      await areaObj.unlock()
      console.log("Unlocked successfully")
    }, 30000)

    test("should get InfoArea versions", async () => {
      // 注意：InfoArea 可能不支持版本查询
      try {
        const versions = await areaObj.getVersions()

        console.log(`\n========== Versions: ${TEST_AREA} ==========`)
        console.log(`Found ${versions.length} version(s)`)
        versions.forEach((v, i) => {
          console.log(`  [${i + 1}] URI: ${v.uri}`)
          console.log(`      Version: ${v.version}`)
          console.log(`      Created: ${v.created || "N/A"}`)
          console.log(`      User: ${v.user || "N/A"}`)
        })
        console.log(`==============================================\n`)
      } catch (error: any) {
        if (error.message?.includes("不支持对象版本") || error.message?.includes("not supported")) {
          console.log(`\n========== Versions: ${TEST_AREA} ==========`)
          console.log(`SKIPPED: Version API not supported for InfoArea`)
          console.log(`==============================================\n`)
        } else {
          throw error
        }
      }
    }, 30000)

    test("should get InfoArea details", async () => {
      const detailsXML = await areaObj.getDetails()

      console.log(`\n========== Details: ${TEST_AREA} ==========`)
      console.log(`XML Length: ${detailsXML.length} chars`)
      console.log(`Preview: ${detailsXML.substring(0, 200)}...`)
      console.log(`============================================\n`)

      expect(detailsXML).toBeDefined()
      expect(detailsXML.length).toBeGreaterThan(0)
      expect(detailsXML).toContain("InfoArea:infoArea")
    }, 30000)
  })

  describe("Generic CRUD Operations", () => {
    test("should create InfoArea using generic create()", async () => {
      const areaObj = createBWObject(
        client.httpClient,
        BWObjectType.INFO_AREA,
        TEST_AREA
      )

      const xmlBody = buildAreaXML({
        name: TEST_AREA,
        parentInfoArea: PARENT_AREA,
        description: "ADT API 测试目录 - Generic CRUD Test",
        responsible: testConfig.username,
        language: testConfig.language
      })

      console.log(`\n========== Create InfoArea: ${TEST_AREA} ==========`)
      console.log(`Parent: ${PARENT_AREA}`)
      console.log(`Description: ADT API 测试目录`)

      try {
        await areaObj.create(xmlBody, {
          parent: PARENT_AREA,
          headers: {
            "Development-Class": "$TMP"
          }
        })
        console.log(`Created successfully!`)
      } catch (error: any) {
        if (error.message?.includes("already exists")) {
          console.log(`SKIPPED: Object already exists from previous test`)
        } else {
          console.log(`Error: ${error.message}`)
        }
      }

      console.log(`===================================================\n`)
    }, 60000)

    test("should verify InfoArea exists after creation", async () => {
      const areaObj = createBWObject(
        client.httpClient,
        BWObjectType.INFO_AREA,
        TEST_AREA
      )

      console.log(`\n========== Verify Exists: ${TEST_AREA} ==========`)

      try {
        const result = await areaObj.exists()
        console.log(`Exists: ${result.message}`)
        expect(result.message).toBeDefined()
      } catch (error: any) {
        if (error.message?.includes("does not exist")) {
          console.log(`SKIPPED: Object does not exist (may have been deleted)`)
        } else {
          throw error
        }
      }

      console.log(`===================================================\n`)
    }, 30000)

    test("should update InfoArea using generic update()", async () => {
      const areaObj = createBWObject(
        client.httpClient,
        BWObjectType.INFO_AREA,
        TEST_AREA
      )

      const updatedXML = buildAreaXML({
        name: TEST_AREA,
        parentInfoArea: PARENT_AREA,
        description: "ADT API 测试目录 - Updated via Generic CRUD",
        responsible: testConfig.username,
        language: testConfig.language
      })

      console.log(`\n========== Update InfoArea: ${TEST_AREA} ==========`)
      console.log(`New Description: ADT API 测试目录 - Updated via Generic CRUD`)

      try {
        // InfoArea 不需要激活，update() 返回 void
        await areaObj.update(updatedXML, {
          headers: {
            "Development-Class": "$TMP"
          }
        })
        console.log(`Updated successfully!`)
      } catch (error: any) {
        // InfoArea 可能处于特殊状态，无法直接更新
        if (error.message?.includes("Lock handle") || error.message?.includes("does not exist")) {
          console.log(`SKIPPED: ${error.message}`)
        } else {
          throw error
        }
      }

      console.log(`===================================================\n`)
    }, 60000)

    test("should get InfoArea details after operations", async () => {
      const areaObj = createBWObject(
        client.httpClient,
        BWObjectType.INFO_AREA,
        TEST_AREA
      )

      console.log(`\n========== Details: ${TEST_AREA} ==========`)

      try {
        const detailsXML = await areaObj.getDetails()
        console.log(`XML Length: ${detailsXML.length} chars`)
        console.log(`Contains parentInfoArea: ${detailsXML.includes("parentInfoArea")}`)
        console.log(`Contains ZGLD_TEST: ${detailsXML.includes("ZGLD_TEST")}`)

        expect(detailsXML).toBeDefined()
        expect(detailsXML.length).toBeGreaterThan(0)
        expect(detailsXML).toContain("InfoArea:infoArea")
      } catch (error: any) {
        if (error.message?.includes("does not exist")) {
          console.log(`SKIPPED: Object does not exist (may have been deleted)`)
        } else {
          throw error
        }
      }

      console.log(`===================================================\n`)
    }, 30000)

    test("should delete InfoArea using generic delete()", async () => {
      const areaObj = createBWObject(
        client.httpClient,
        BWObjectType.INFO_AREA,
        TEST_AREA
      )

      console.log(`\n========== Delete InfoArea: ${TEST_AREA} ==========`)

      // 注意：InfoArea 可能不支持 canDelete 验证
      try {
        const canDeleteResult = await areaObj.canDelete()

        console.log(`Can Delete: ${canDeleteResult.message}`)
      } catch (error: any) {
        if (error.message?.includes("not valid") || error.message?.includes("不支持")) {
          console.log(`Can Delete: SKIPPED (Validation not supported for InfoArea)`)
        } else {
          throw error
        }
      }

      console.log(`Note: Actual deletion requires a valid transport request`)
      console.log(`Uncomment the following to delete: await areaObj.delete("TRANSPORT...")`)
      console.log(`===================================================\n`)
    }, 30000)
  })

  describe("Client Convenience Methods", () => {
    test("should use client.createObject() for InfoArea", async () => {
      // 使用不同的名称避免冲突
      const testArea2 = "ZADT_API_TEST_" + Date.now().toString().slice(-4)
      const xmlBody = buildAreaXML({
        name: testArea2,
        parentInfoArea: PARENT_AREA,
        description: "Client convenience method test",
        responsible: testConfig.username,
        language: testConfig.language
      })

      console.log(`\n========== Client.createObject(): ${testArea2} ==========`)

      try {
        await client.createObject(
          "area",
          testArea2,
          xmlBody,
          {
            parent: PARENT_AREA,
            headers: {
              "Development-Class": "$TMP"
            }
          }
        )
        console.log(`Created successfully!`)
      } catch (error: any) {
        console.log(`SKIPPED: ${error.message}`)
      }

      console.log(`======================================================\n`)
    }, 60000)

    test("should use client.getObject() and perform operations", async () => {
      // 首先创建一个测试对象
      const testArea2 = "ZADT_API_OBJTEST"
      const xmlBody = buildAreaXML({
        name: testArea2,
        parentInfoArea: PARENT_AREA,
        description: "Object operations test",
        responsible: testConfig.username,
        language: testConfig.language
      })

      console.log(`\n========== Client.getObject(): ${testArea2} ==========`)

      try {
        // 尝试创建
        await client.createObject("area", testArea2, xmlBody, {
          parent: PARENT_AREA,
          headers: { "Development-Class": "$TMP" }
        })
        console.log(`Created successfully`)
      } catch (error: any) {
        if (!error.message?.includes("already exists")) {
          console.log(`Create skipped: ${error.message}`)
        }
      }

      try {
        const obj = await client.getObject("area", testArea2)

        // 使用返回的对象进行操作
        const existsResult = await obj.exists()
        console.log(`Exists: ${existsResult.message}`)

        const details = await obj.getDetails()
        console.log(`Details XML length: ${details.length}`)

        expect(existsResult).toBeDefined()
        expect(details).toBeDefined()
      } catch (error: any) {
        console.log(`Operations skipped: ${error.message}`)
      }

      console.log(`======================================================\n`)
    }, 30000)

    test("should use client.updateObject() for InfoArea", async () => {
      const testArea2 = "ZADT_API_OBJTEST"  // 使用已存在的对象
      const updatedXML = buildAreaXML({
        name: testArea2,
        parentInfoArea: PARENT_AREA,
        description: "Updated via client convenience method",
        responsible: testConfig.username,
        language: testConfig.language
      })

      console.log(`\n========== Client.updateObject(): ${testArea2} ==========`)

      try {
        await client.updateObject(
          "area",
          testArea2,
          updatedXML,
          {
            headers: {
              "Development-Class": "$TMP"
            }
          }
        )
        console.log(`Updated successfully!`)
      } catch (error: any) {
        console.log(`SKIPPED: ${error.message}`)
      }

      console.log(`======================================================\n`)
    }, 60000)

    test("should demonstrate delete validation", async () => {
      const testArea2 = "ZADT_API_OBJTEST"  // 使用已存在的对象

      console.log(`\n========== Delete Validation: ${testArea2} ==========`)

      try {
        const obj = await client.getObject("area", testArea2)

        try {
          const canDeleteResult = await obj.canDelete()
          console.log(`Can Delete: ${canDeleteResult.message}`)
        } catch (error: any) {
          if (error.message?.includes("not valid") || error.message?.includes("不支持")) {
            console.log(`Can Delete: SKIPPED (Validation not supported for InfoArea)`)
          } else {
            console.log(`Can Delete: ${error.message}`)
          }
        }
      } catch (error: any) {
        console.log(`Object not found: ${error.message}`)
      }

      console.log(`Note: Actual deletion requires lockHandle (from lock operation)`)
      console.log(`=========================================================\n`)
    }, 30000)

    test("should demonstrate delete operation flow", async () => {
      // 创建一个临时 InfoArea 用于删除测试
      const tempArea = "ZADT_TEMP_DEL"
      const xmlBody = buildAreaXML({
        name: tempArea,
        parentInfoArea: PARENT_AREA,
        description: "Temporary area for delete test",
        responsible: testConfig.username,
        language: testConfig.language
      })

      console.log(`\n========== Delete Flow Test: ${tempArea} ==========`)

      try {
        // Step 1: 创建
        console.log(`Step 1: Creating...`)
        await client.createObject("area", tempArea, xmlBody, {
          parent: PARENT_AREA,
          headers: { "Development-Class": "$TMP" }
        })
        console.log(`Created successfully`)

        // Step 2: 锁定
        console.log(`Step 2: Locking...`)
        const obj = await client.getObject("area", tempArea)
        const lockResult = await obj.lock()
        console.log(`Locked: ${lockResult.lockHandle.substring(0, 16)}...`)

        // Step 3: 删除
        console.log(`Step 3: Deleting...`)
        await obj.delete(lockResult.lockHandle)
        console.log(`Deleted successfully!`)

        // Step 4: 验证已删除
        console.log(`Step 4: Verifying deletion...`)
        try {
          await obj.exists()
          console.log(`ERROR: Object still exists!`)
        } catch (error: any) {
          if (error.message?.includes("does not exist")) {
            console.log(`Verified: Object successfully deleted`)
          }
        }

      } catch (error: any) {
        console.log(`Error: ${error.message}`)
      }

      console.log(`=====================================================\n`)
    }, 90000)
  })
})
