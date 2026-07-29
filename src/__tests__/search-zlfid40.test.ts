import { BWAdtClient } from "../BWAdtClient"

const testConfig = {
  baseUrl: process.env.BW_BASE_URL!,
  username: process.env.BW_USERNAME!,
  password: process.env.BW_PASSWORD!,
  client: process.env.BW_CLIENT!,
  language: process.env.BW_LANGUAGE!
}

test("search ZL_FID40 - compare with communication log", async () => {
  const client = new BWAdtClient(
    testConfig.baseUrl,
    testConfig.username,
    testConfig.password,
    testConfig.client,
    testConfig.language
  )
  await client.login()

  const results = await client.searchBWObjects({
    searchTerm: "ZL_FID40",
    searchInName: true,
    searchInDescription: true,
    objectType: "",
    createdOnFrom: "1970-01-01T00:00:00Z",
    createdOnTo: "2026-07-15T23:59:59Z",
    changedOnFrom: "1970-01-01T00:00:00Z",
    changedOnTo: "2026-07-15T23:59:59Z"
  })

  console.log(`\nFound ${results.length} result(s):`)
  results.forEach((r, i) => {
    console.log(`  [${i + 1}] ${r.objectType}  ${r.technicalObjectName}  (${r.objectStatus}/${r.objectVersion})  "${r.title}"`)
    console.log(`      URI: ${r.uri}`)
  })

  // Communication log 期望: 7 条结果
  // [1] ADSO ZL_FID40
  // [2-4] DTPA x3
  // [5-7] TRFN x3
  expect(results.length).toBe(7)

  const adso = results.find(r => r.objectType === "ADSO")
  expect(adso).toBeDefined()
  expect(adso!.technicalObjectName).toBe("ZL_FID40")
  expect(adso!.objectStatus).toBe("active")
  expect(adso!.objectVersion).toBe("M")
  expect(adso!.title).toBe("发票产品分摊结果")

  const dtps = results.filter(r => r.objectType === "DTPA")
  expect(dtps.length).toBe(3)

  const trfns = results.filter(r => r.objectType === "TRFN")
  expect(trfns.length).toBe(3)

  await client.logout()
}, 30000)
