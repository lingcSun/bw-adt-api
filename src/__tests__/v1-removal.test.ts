/**
 * V1 移除回归锁（2026-09-20）：validation 端点仅支持 exists（加可创建类型 new），
 * 13 个永远报错的 validate* 函数已从 API 面移除。此测试防止它们被无意恢复。
 * 证据：docs/VERIFIED_APIS.md 第 7 节。
 */
import * as root from "../index"
import type { AdtHTTP } from "../AdtHTTP"

const REMOVED = [
  "validateADSOCanDelete",
  "validateADSOCanActivate",
  "validateTransformationCanDelete",
  "validateTransformationCanActivate",
  "validateDTPNewName",
  "validateDTPCanDelete",
  "validateDTPCanActivate",
  "validateInfoObjectCanDelete",
  "validateInfoObjectCanActivate",
  "validateProcessChainExists",
  "validateProcessChainNewName",
  "validateProcessChainCanDelete",
  "validateProcessChainCanActivate",
]

describe("V1：validation 死方法已移除", () => {
  test("根导出不含任何已移除的 validate* 函数", () => {
    for (const name of REMOVED) {
      expect((root as Record<string, unknown>)[name]).toBeUndefined()
    }
  })

  test("BWObject 实例不含 canDelete/canActivate", async () => {
    const { createBWObject, BWObjectType } = root
    const obj = createBWObject({} as AdtHTTP, BWObjectType.ADSO, "X")
    const rec = obj as unknown as Record<string, unknown>
    expect(rec.canDelete).toBeUndefined()
    expect(rec.canActivate).toBeUndefined()
  })

  test("存活的验证函数仍导出", () => {
    for (const name of ["validateADSOExists", "validateADSONewName", "validateTransformationExists", "validateDTPExists", "validateInfoObjectExists", "validateInfoArea"]) {
      expect(typeof (root as Record<string, unknown>)[name]).toBe("function")
    }
  })
})
