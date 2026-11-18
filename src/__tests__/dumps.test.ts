/**
 * ST22 dumps feed: defensive parse + live maxNumber query.
 */
import { parseDumps } from "../api/dumps"
import { BWAdtClient } from "../BWAdtClient"
import { describeLive, testLive } from "./helpers/liveSystem"

const MINIMAL_FEED_NO_AUTHOR = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>ABAP Short Dump Analysis</title>
  <updated>2026-11-16T01:00:00Z</updated>
  <link href="/sap/bc/adt/runtime/dumps" rel="self"/>
  <entry>
    <id>/sap/bc/adt/vit/runtime/dumps/sample</id>
    <title>Sample dump title</title>
    <updated>2026-11-13T05:11:45Z</updated>
    <category term="ITAB_ILLEGAL_SORT_ORDER" label="ABAP runtime error"/>
    <category term="ZPROG" label="Terminated ABAP program"/>
    <link href="/sap/bc/adt/runtime/dump/sample" rel="self" type="text/plain"/>
  </entry>
</feed>`

const MINIMAL_FEED_WITH_SUMMARY = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Dumps</title>
  <updated>2026-11-16T01:00:00Z</updated>
  <link href="/sap/bc/adt/runtime/dumps" rel="self"/>
  <entry>
    <id>/sap/bc/adt/vit/runtime/dumps/sample2</id>
    <title>With summary</title>
    <updated>2026-11-13T05:11:45Z</updated>
    <summary type="html">&lt;h4 id="HEADERX"&gt;Header&lt;/h4&gt;&lt;p&gt;body&lt;/p&gt;</summary>
  </entry>
</feed>`

describe("parseDumps", () => {
  test("entry missing author/summary does not throw", () => {
    const feed = parseDumps(MINIMAL_FEED_NO_AUTHOR)
    expect(feed.dumps).toHaveLength(1)
    expect(feed.dumps[0].title).toBe("Sample dump title")
    expect(feed.dumps[0].author).toBeUndefined()
    expect(feed.dumps[0].text).toBe("")
    expect(feed.href).toBe("/sap/bc/adt/runtime/dumps")
  })

  test("summary text is extracted", () => {
    const feed = parseDumps(MINIMAL_FEED_WITH_SUMMARY)
    expect(feed.dumps).toHaveLength(1)
    expect(feed.dumps[0].text).toContain("HEADERX")
    expect(feed.dumps[0].type).toBe("html")
  })
})

describeLive("dumps live", () => {
  const testConfig = {
    baseUrl: process.env.BW_BASE_URL || "",
    username: process.env.BW_USERNAME || "",
    password: process.env.BW_PASSWORD || "",
    client: process.env.BW_CLIENT || "100",
    language: process.env.BW_LANGUAGE || "EN",
  }

  testLive(
    "dumps maxNumber=5 returns feed",
    async () => {
      const client = new BWAdtClient(
        testConfig.baseUrl,
        testConfig.username,
        testConfig.password,
        testConfig.client,
        testConfig.language
      )
      await client.login()
      const feed = await client.dumps("maxNumber=5")
      expect(feed.dumps).toBeDefined()
      if (feed.dumps.length) {
        expect(feed.dumps[0].title).toBeTruthy()
        expect(typeof feed.dumps[0].text).toBe("string")
      }
    },
    60000
  )
})
