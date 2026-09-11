import { extractAbapClassName } from "../api/transformation"

/**
 * Offline unit tests for ABAP class-name extraction / fallback naming.
 * Naming convention (verified): /BIC/ + TRFN id chars [13..32] + _M
 * (ABAP name length ≤ 30; the old `/BIC/3M`+suffix fallback exceeded it).
 */

describe("extractAbapClassName", () => {
  test("prefers classNameM from Routine Group step", () => {
    const raw = {
      "trfn:transformation": {
        "@_name": "0BE9X06HU3MN3FB1TO6MNLEGQI6XIJEO",
        group: [
          {
            "@_type": "G",
            rule: [
              {
                step: [
                  {
                    "@_type": "ROUTINE",
                    "@_classNameM": "/BIC/3FB1TO6MNLEGQI6XIJEO_M",
                  },
                ],
              },
            ],
          },
        ],
      },
    }
    expect(extractAbapClassName(raw)).toBe("/BIC/3FB1TO6MNLEGQI6XIJEO_M")
  })

  test("fallback uses slice(12) convention (≤30 chars)", () => {
    const id = "0BE9X06HU3MN3FB1TO6MNLEGQI6XIJEO" // 32 chars
    const raw = { "trfn:transformation": { "@_name": id } }
    const name = extractAbapClassName(raw)
    expect(name).toBe("/BIC/3FB1TO6MNLEGQI6XIJEO_M")
    expect(name!.length).toBeLessThanOrEqual(30)
  })

  test("fallback does not use the old /BIC/3M+suffix pattern", () => {
    const id = "0F30KPOAZK07TIY86JBGVAO9XHWIVIBT"
    const raw = { name: id }
    const name = extractAbapClassName(raw)
    expect(name).toBe("/BIC/TIY86JBGVAO9XHWIVIBT_M")
    expect(name).not.toMatch(/^\/BIC\/3M/)
    expect(name!.length).toBeLessThanOrEqual(30)
  })

  test("returns undefined when name too short for fallback", () => {
    expect(extractAbapClassName({ name: "SHORT" })).toBeUndefined()
  })
})
