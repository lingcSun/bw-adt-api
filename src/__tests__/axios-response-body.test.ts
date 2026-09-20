import { responseBody } from "../AxiosHttpClient"

describe("responseBody() - axios 响应体保真", () => {
  test("字符串原样透传", () => {
    expect(responseBody("<xml>hi</xml>")).toBe("<xml>hi</xml>")
    expect(responseBody("")).toBe("")
  })

  test("null/undefined 归一为空串", () => {
    expect(responseBody(null)).toBe("")
    expect(responseBody(undefined)).toBe("")
  })

  test("JSON 对象不得退化为 [object Object]（2026-09-20 N1）", () => {
    const parsed = { chain: { name: "X", variants: [1, 2] } }
    expect(responseBody(parsed)).toBe(JSON.stringify(parsed))
    expect(responseBody(parsed)).not.toBe("[object Object]")
  })

  test("数组与原始值按 JSON 序列化", () => {
    expect(responseBody([{ a: 1 }])).toBe('[{"a":1}]')
    expect(responseBody(42)).toBe("42")
  })
})
