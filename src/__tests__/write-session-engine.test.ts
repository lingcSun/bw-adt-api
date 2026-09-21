import { withWriteSession } from "../api/writeSession"
import type { AdtHTTP } from "../AdtHTTP"

const client = {} as AdtHTTP

describe("withWriteSession 引擎（离线）", () => {
  it("按 lock→transport→update→activate→unlock 顺序执行并组装结果", async () => {
    const calls: string[] = []
    const result = await withWriteSession(
      client,
      {
        lock: async () => {
          calls.push("lock")
          return { lockHandle: "L1", corrNr: "CORR" }
        },
        update: async (_c, xml, io) => {
          calls.push("update")
          expect(io.lockHandle).toBe("L1")
          expect(io.corrNr).toBe("TR1")
          expect(io.timestamp).toBe("20260921000000")
          return { ok: true }
        },
        activate: async (_c, lockHandle, corrNr) => {
          calls.push("activate")
          expect(lockHandle).toBe("L1")
          expect(corrNr).toBe("TR1")
          return { success: true }
        },
        unlock: async () => {
          calls.push("unlock")
        },
      },
      {
        uri: "/sap/bw/modeling/adso/x/m",
        xml: "<adso:dataStore/>",
        timestamp: "20260921000000",
        transport: "TR1",
        transportDescription: "t",
      },
      // 离线：不发 transportCheck，直接短路
      async () => "TR1",
    )
    expect(calls).toEqual(["lock", "update", "activate", "unlock"])
    expect(result).toEqual({
      lockHandle: "L1",
      transport: "TR1",
      updateResult: { ok: true },
      activated: true,
      activateResult: { success: true },
    })
  })

  it("update 抛错时仍 unlock 且不激活（finally 语义）", async () => {
    const calls: string[] = []
    await expect(
      withWriteSession(
        client,
        {
          lock: async () => {
            calls.push("lock")
            return { lockHandle: "L1" }
          },
          update: async () => {
            calls.push("update")
            throw new Error("boom")
          },
          activate: async () => {
            calls.push("activate")
            return {}
          },
          unlock: async () => {
            calls.push("unlock")
          },
        },
        { uri: "u", xml: "x" },
        async () => undefined,
      ),
    ).rejects.toThrow("boom")
    expect(calls).toEqual(["lock", "update", "unlock"])
  })

  it("autoActivate=false 或未提供 activate 时跳过激活，activated=false", async () => {
    const calls: string[] = []
    const result = await withWriteSession(
      client,
      {
        lock: async () => {
          calls.push("lock")
          return { lockHandle: "L1" }
        },
        update: async () => {
          calls.push("update")
          return {}
        },
        activate: async () => {
          calls.push("activate")
          return {}
        },
        unlock: async () => {
          calls.push("unlock")
        },
      },
      { uri: "u", xml: "x", autoActivate: false },
      async () => undefined,
    )
    expect(calls).toEqual(["lock", "update", "unlock"])
    expect(result.activated).toBe(false)
    expect(result.activateResult).toBeUndefined()
  })
})
