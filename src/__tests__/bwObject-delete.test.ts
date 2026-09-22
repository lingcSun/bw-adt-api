import { BWObject, BWObjectType, createBWObject } from "../api/bwObject"
import { describeLive, testLive } from "./helpers/liveSystem"
import type { AdtHTTP } from "../AdtHTTP"

/**
 * Offline tests for BWObject config resolution and delete() query building.
 *
 * Real defect: an unregistered object type made `config` undefined, so the next
 * `.endpoint` read threw "Cannot read properties of undefined (reading
 * 'endpoint')" — impossible to act on. It now names the offending type.
 */

interface Cap { uri: string; method: string; qs?: Record<string, string> }

function fakeClient(cap: Cap[]): AdtHTTP {
  return {
    request: async (uri: string, config: any) => {
      cap.push({ uri, method: config?.method, qs: config?.qs })
      return { status: 200, body: "" }
    },
    dropSession: async () => undefined,
  } as unknown as AdtHTTP
}

describeLive("BWObject config guard", () => {
  test("names the unknown type instead of crashing on .endpoint", async () => {
    const obj = createBWObject(fakeClient([]), "nope" as BWObjectType, "ZS_TR01")
    // Any operation that resolves the config must report the bad type clearly.
    await expect(obj.getDetails()).rejects.toThrow(/Unknown BW object type "nope"/)
    await expect(obj.getDetails()).rejects.toThrow(/Valid types:/)
  })

  test("registered types still resolve", async () => {
    const cap: Cap[] = []
    const obj = createBWObject(fakeClient(cap), BWObjectType.ADSO, "ZS_TR01")
    await obj.getDetails()
    expect(cap[0].uri).toBe("/sap/bw/modeling/adso/zs_tr01/m")
  })
})

describeLive("BWObject.delete query building", () => {
  test("ADSO deletes by lockHandle (not transport)", async () => {
    const cap: Cap[] = []
    const obj = createBWObject(fakeClient(cap), BWObjectType.ADSO, "ZS_TR01")
    await obj.delete({ lockHandle: "LOCKHANDLE1" })
    expect(cap[0].method).toBe("DELETE")
    expect(cap[0].uri).toBe("/sap/bw/modeling/adso/zs_tr01/m")
    expect(cap[0].qs).toEqual({ lockHandle: "LOCKHANDLE1" })
  })

  test("ADSO delete adds corrNr when transport is supplied", async () => {
    const cap: Cap[] = []
    const obj = createBWObject(fakeClient(cap), BWObjectType.ADSO, "ZS_TR01")
    await obj.delete({ lockHandle: "LOCKHANDLE1", transport: "BPDK903312" })
    expect(cap[0].qs).toEqual({ lockHandle: "LOCKHANDLE1", corrNr: "BPDK903312" })
  })

  test("InfoArea deletes on the /a version", async () => {
    const cap: Cap[] = []
    const obj = createBWObject(fakeClient(cap), BWObjectType.INFO_AREA, "ZAREA")
    await obj.delete({ lockHandle: "LOCKHANDLE1" })
    expect(cap[0].uri).toBe("/sap/bw/modeling/area/zarea/a")
    expect(cap[0].qs).toEqual({ lockHandle: "LOCKHANDLE1" })
  })

  // 现契约（src/api/bwObject.ts delete()）：ADSO/INFO_AREA/TRFN/DTP 走 lockHandle
  // 模式（DELETE /{name}/{m|a}?lockHandle，transport 可选作 corrNr）；其余类型必须
  // transport。TRFN 曾按旧 transport 模式断言，此处对齐实测过的 lockHandle 路径
  // （VERIFIED_APIS §6/§8）。
  test("TRFN deletes by lockHandle on the /m version (same contract as ADSO)", async () => {
    const cap: Cap[] = []
    const obj = createBWObject(fakeClient(cap), BWObjectType.TRANSFORMATION, "0ABC")
    await obj.delete({ lockHandle: "LOCKHANDLE1" })
    expect(cap[0].method).toBe("DELETE")
    expect(cap[0].uri).toBe("/sap/bw/modeling/trfn/0abc/m")
    expect(cap[0].qs).toEqual({ lockHandle: "LOCKHANDLE1" })
  })

  test("ADSO without lockHandle is rejected before any request", async () => {
    const cap: Cap[] = []
    const obj = createBWObject(fakeClient(cap), BWObjectType.ADSO, "ZS_TR01")
    await expect(obj.delete({ transport: "BPDK903312" })).rejects.toThrow(/requires options\.lockHandle/)
    expect(cap).toHaveLength(0)
  })

  test("TRFN without lockHandle is rejected before any request", async () => {
    const cap: Cap[] = []
    const obj = createBWObject(fakeClient(cap), BWObjectType.TRANSFORMATION, "0ABC")
    await expect(obj.delete({ transport: "BPDK903312" })).rejects.toThrow(/requires options\.lockHandle/)
    expect(cap).toHaveLength(0)
  })
})

describeLive("BWObject.delete confirmation", () => {
  // delete() previously resolved undefined; MCP tool results built from it
  // failed schema validation (content[0].text missing). It must confirm.
  test("lockHandle-mode delete resolves to a confirmation object", async () => {
    const obj = createBWObject(fakeClient([]), BWObjectType.ADSO, "ZS_TR01")
    await expect(obj.delete({ lockHandle: "LOCKHANDLE1" })).resolves.toEqual({
      deleted: true,
      objectType: "adso",
      objectName: "ZS_TR01"
    })
  })

  // transport 模式的确认路径用真正 transport-mode 的类型（PC 走 /rspc、
  // preserveCase）锁——TRFN 已归 lockHandle 模式，不再承担 transport 例证。
  test("transport-mode delete confirms too", async () => {
    const obj = createBWObject(fakeClient([]), BWObjectType.PROCESS_CHAIN, "ZPC")
    await expect(obj.delete({ transport: "BPDK903312" })).resolves.toEqual({
      deleted: true,
      objectType: "pc",
      objectName: "ZPC"
    })
  })
})
