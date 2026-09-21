import { createADSO } from "../api/adso"
import { describeLive, testLive } from "./helpers/liveSystem"
import type { AdtHTTP } from "../AdtHTTP"

/**
 * Offline tests for createADSO's package / transport handling.
 *
 * Real defect this locks in: the create request hardcoded
 * `Development-Class: $TMP` and never appended `corrNr`, so a caller passing
 * packageName+transport still got a $TMP object that never entered E071.
 */

interface Captured {
  uri: string
  headers: Record<string, string>
  body: string
}

function fakeClient(captured: Captured[]): AdtHTTP {
  return {
    request: async (uri: string, config: any) => {
      captured.push({ uri, headers: config?.headers ?? {}, body: config?.body ?? "" })
      return { status: 200, body: "" }
    },
  } as unknown as AdtHTTP
}

const BASE = {
  name: "ZS_TR01",
  description: "unit test",
  infoArea: "ZGLD_TEST",
  masterLanguage: "ZH",
  responsible: "TESTUSER",
}

describeLive("createADSO package/transport handling", () => {
  test("defaults to $TMP and sends no corrNr", async () => {
    const cap: Captured[] = []
    await createADSO(fakeClient(cap), { ...BASE }, "LOCK1")
    expect(cap).toHaveLength(1)
    expect(cap[0].headers["Development-Class"]).toBe("$TMP")
    expect(cap[0].uri).not.toContain("corrNr")
  })

  test("a real packageName without transport is rejected, not silently downgraded", async () => {
    const cap: Captured[] = []
    await expect(
      createADSO(fakeClient(cap), { ...BASE, packageName: "ZBW" }, "LOCK1"),
    ).rejects.toThrow(/requires a transport request number/)
    // Nothing may be sent when the caller's intent cannot be honored.
    expect(cap).toHaveLength(0)
  })

  test("explicit $TMP stays allowed without transport", async () => {
    const cap: Captured[] = []
    await createADSO(fakeClient(cap), { ...BASE, packageName: "$TMP" }, "LOCK1")
    expect(cap[0].headers["Development-Class"]).toBe("$TMP")
  })

  test("packageName + transport sets the package AND appends corrNr", async () => {
    const cap: Captured[] = []
    await createADSO(
      fakeClient(cap),
      { ...BASE, packageName: "ZBW", transport: "BPDK903312" },
      "LOCK1",
    )
    expect(cap[0].headers["Development-Class"]).toBe("ZBW")
    expect(cap[0].uri).toContain("corrNr=BPDK903312")
    expect(cap[0].uri).toContain("lockHandle=LOCK1")
  })

  test("encodes the object name in the URL path", async () => {
    const cap: Captured[] = []
    await createADSO(
      fakeClient(cap),
      { ...BASE, packageName: "ZBW", transport: "BPDK903312" },
      "LOCK1",
    )
    expect(cap[0].uri).toContain("/sap/bw/modeling/adso/zs_tr01")
  })

  test("carries the ADSO form flags into the request body", async () => {
    const cap: Captured[] = []
    await createADSO(
      fakeClient(cap),
      { ...BASE, activateData: false, writeChangelog: false },
      "LOCK1",
    )
    expect(cap[0].body).toContain('activateData="false"')
    expect(cap[0].body).toContain('writeChangelog="false"')
    expect(cap[0].body).toContain("<infoArea>ZGLD_TEST</infoArea>")
  })
})
