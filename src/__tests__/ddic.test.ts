import { BWAdtClient } from "../BWAdtClient"
import {
  parseLinkHeader,
  extractTableNameFromUrl,
  getADSODDICLinks,
  getADSODDICTableName,
  getDDICTableInfo,
  getDDICTableFields,
  getDDICTableDataMetadata,
  getDDICTableData,
  getADSODataPreview
} from "../api/ddic"
import * as dotenv from "dotenv"

dotenv.config()

const testConfig = {
  baseUrl: process.env.BW_BASE_URL || "",
  username: process.env.BW_USERNAME || "",
  password: process.env.BW_PASSWORD || "",
  client: process.env.BW_CLIENT || "100",
  language: process.env.BW_LANGUAGE || "ZH"
}

const TEST_ADSO = process.env.BW_TEST_ADSO || "ZDSO_MK1"

describe("DDIC Utility Functions", () => {
  describe("parseLinkHeader", () => {
    test("should parse valid link header", () => {
      const linkHeader = `<https://example.com/table1>; rel="ddicTableLink", <https://example.com/data>; rel="ddicDataDisplay"`
      const links = parseLinkHeader(linkHeader)

      expect(links.get("ddicTableLink")).toBe("https://example.com/table1")
      expect(links.get("ddicDataDisplay")).toBe("https://example.com/data")
    })

    test("should return empty map for empty header", () => {
      const links = parseLinkHeader("")
      expect(links.size).toBe(0)
    })

    test("should handle complex link header", () => {
      const linkHeader = `</sap/bc/adt/ddic/tables//BIC/AZDSO_MK12/source/main>; rel="ddicTableLink", ` +
        `</sap/bc/adt/datapreview/ddic//BIC/AZDSO_MK12>; rel="ddicDataDisplay"; title="Data Preview"`
      const links = parseLinkHeader(linkHeader)

      expect(links.get("ddicTableLink")).toBe("/sap/bc/adt/ddic/tables//BIC/AZDSO_MK12/source/main")
      expect(links.get("ddicDataDisplay")).toBe("/sap/bc/adt/datapreview/ddic//BIC/AZDSO_MK12")
    })
  })

  describe("extractTableNameFromUrl", () => {
    test("should extract table name from DDIC URL", () => {
      const url = "/sap/bc/adt/ddic/tables//BIC/AZDSO_MK12/source/main"
      const tableName = extractTableNameFromUrl(url)
      expect(tableName).toBe("/BIC/AZDSO_MK12")
    })

    test("should extract simple table name", () => {
      const url = "/sap/bc/adt/ddic/tables/MARA/source/main"
      const tableName = extractTableNameFromUrl(url)
      expect(tableName).toBe("MARA")
    })

    test("should return undefined for invalid URL", () => {
      const tableName = extractTableNameFromUrl("/invalid/url")
      expect(tableName).toBeUndefined()
    })

    test("should return undefined for empty URL", () => {
      const tableName = extractTableNameFromUrl("")
      expect(tableName).toBeUndefined()
    })
  })
})

describe("DDIC API Tests", () => {
  let client: BWAdtClient
  let testTableName: string

  beforeAll(async () => {
    client = new BWAdtClient(
      testConfig.baseUrl,
      testConfig.username,
      testConfig.password,
      testConfig.client,
      testConfig.language
    )
    await client.login()
    console.log(`\n========== DDIC Tests Starting ==========\n`)

    testTableName = await getADSODDICTableName(client.httpClient, TEST_ADSO) || ""
    console.log(`Using test table: ${testTableName}`)
  }, 30000)

  afterAll(async () => {
    console.log(`\n========== DDIC Tests Completed ==========\n`)
    if (client.loggedin) {
      await client.logout()
      console.log("Logged out successfully")
    }
  })

  describe("ADSO DDIC Links", () => {
    test("should get ADSO DDIC links", async () => {
      const links = await getADSODDICLinks(client.httpClient, TEST_ADSO)

      expect(links).toBeDefined()
      console.log(`\n========== ADSO DDIC Links: ${TEST_ADSO} ==========`)
      console.log(`DDIC Table Link: ${links.ddicTableLink || "N/A"}`)
      console.log(`DDIC Data Display: ${links.ddicTableDataDisplay || "N/A"}`)
      console.log(`Default Data Preview: ${links.defaultDataPreview || "N/A"}`)
      console.log(`=================================================\n`)
    }, 30000)

    test("should get ADSO DDIC table name", async () => {
      const tableName = await getADSODDICTableName(client.httpClient, TEST_ADSO)

      console.log(`\n========== ADSO DDIC Table Name: ${TEST_ADSO} ==========`)
      console.log(`Table Name: ${tableName || "N/A"}`)
      console.log(`======================================================\n`)
    }, 30000)
  })

  describe("DDIC Table Info", () => {
    test("should get DDIC table info", async () => {
      if (!testTableName) {
        console.log("Skipping: No test table available")
        return
      }

      const info = await getDDICTableInfo(client.httpClient, testTableName)

      expect(info).toBeDefined()
      expect(info.name).toBe(testTableName.toUpperCase())

      console.log(`\n========== DDIC Table Info: ${testTableName} ==========`)
      console.log(`Name: ${info.name}`)
      console.log(`Description: ${info.description || "N/A"}`)
      console.log(`Delivery Class: ${info.deliveryClass || "N/A"}`)
      console.log(`Fields: ${info.fields?.length || 0}`)
      console.log(`====================================================\n`)
    }, 30000)

    test("should get DDIC table fields", async () => {
      if (!testTableName) {
        console.log("Skipping: No test table available")
        return
      }

      const fields = await getDDICTableFields(client.httpClient, testTableName)

      expect(fields).toBeDefined()
      expect(Array.isArray(fields)).toBe(true)

      console.log(`\n========== DDIC Table Fields: ${testTableName} ==========`)
      console.log(`Total Fields: ${fields.length}`)
      fields.slice(0, 5).forEach((field, idx) => {
        console.log(`  [${idx + 1}] ${field.name}`)
        console.log(`      Type: ${field.dataType || "N/A"}`)
        console.log(`      Length: ${field.length || "N/A"}`)
        console.log(`      Key: ${field.keyFlag ? "Yes" : "No"}`)
        console.log(`      Description: ${field.shortText || "N/A"}`)
      })
      if (fields.length > 5) {
        console.log(`  ... and ${fields.length - 5} more fields`)
      }
      console.log(`=========================================================\n`)
    }, 30000)
  })

  describe("DDIC Table Data", () => {
    test("should get DDIC table data metadata", async () => {
      if (!testTableName) {
        console.log("Skipping: No test table available")
        return
      }

      const metadata = await getDDICTableDataMetadata(client.httpClient, testTableName)

      expect(metadata).toBeDefined()
      console.log(`\n========== DDIC Table Data Metadata: ${testTableName} ==========`)
      console.log(`Metadata keys: ${Object.keys(metadata).join(", ")}`)
      console.log(`=============================================================\n`)
    }, 30000)

    test("should get DDIC table data", async () => {
      if (!testTableName) {
        console.log("Skipping: No test table available")
        return
      }

      const data = await getDDICTableData(client.httpClient, testTableName, { maxRows: 10 })

      expect(data).toBeDefined()
      expect(data.tableName).toBe(testTableName.toUpperCase())

      console.log(`\n========== DDIC Table Data: ${testTableName} ==========`)
      console.log(`Table: ${data.tableName}`)
      console.log(`Total Rows: ${data.totalRows || "N/A"}`)
      console.log(`Columns: ${data.columns?.join(", ") || "N/A"}`)

      if (data.rows && data.rows.length > 0) {
        console.log(`\nFirst ${Math.min(3, data.rows.length)} rows:`)
        data.rows.slice(0, 3).forEach((row, idx) => {
          console.log(`  Row ${idx + 1}: ${JSON.stringify(row)}`)
        })
      } else {
        console.log("No data rows returned")
      }
      console.log(`=====================================================\n`)
    }, 30000)

    test("should get DDIC table data with column filter", async () => {
      if (!testTableName) {
        console.log("Skipping: No test table available")
        return
      }

      const fields = await getDDICTableFields(client.httpClient, testTableName)
      const columnNames = fields.slice(0, 3).map(f => f.name)

      if (columnNames.length === 0) {
        console.log("Skipping: No columns available")
        return
      }

      const data = await getDDICTableData(client.httpClient, testTableName, {
        maxRows: 5,
        columns: columnNames
      })

      expect(data).toBeDefined()
      console.log(`\n========== DDIC Table Data (filtered columns): ${testTableName} ==========`)
      console.log(`Requested Columns: ${columnNames.join(", ")}`)
      console.log(`Returned Columns: ${data.columns?.join(", ") || "N/A"}`)
      console.log(`=====================================================================\n`)
    }, 30000)
  })

  describe("ADSO Data Preview", () => {
    test("should get ADSO data preview", async () => {
      try {
        const data = await getADSODataPreview(client.httpClient, TEST_ADSO, 10)

        expect(data).toBeDefined()
        expect(data.tableName).toBe(TEST_ADSO)

        console.log(`\n========== ADSO Data Preview: ${TEST_ADSO} ==========`)
        console.log(`ADSO: ${data.tableName}`)
        console.log(`Total Rows: ${data.totalRows || "N/A"}`)
        console.log(`Columns: ${data.columns?.join(", ") || "N/A"}`)

        if (data.rows && data.rows.length > 0) {
          console.log(`\nFirst ${Math.min(3, data.rows.length)} rows:`)
          data.rows.slice(0, 3).forEach((row, idx) => {
            console.log(`  Row ${idx + 1}: ${JSON.stringify(row)}`)
          })
        } else {
          console.log("No data rows returned")
        }
        console.log(`=================================================\n`)
      } catch (error: any) {
        console.log(`\nNote: ADSO data preview not available: ${error.message}`)
        console.log(`This may be due to ADSO version or configuration issues.\n`)
      }
    }, 30000)
  })
})
