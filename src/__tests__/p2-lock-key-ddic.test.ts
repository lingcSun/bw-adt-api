/**
 * P2 批次离线测试：
 * - parseLockResponse IS_LOCAL（F8）
 * - withFreshSessionOnServerError 会话中毒恢复（F7）
 * - addADSOKeyToXml 键定义构建（F3）
 * - addADSOFieldToXml 无键 fail-fast（F3）
 */
import { parseLockResponse, withFreshSessionOnServerError, isServerErrorException } from "../api/common"
import { AdtErrorException } from "../AdtException"
import { AdtHTTP } from "../AdtHTTP"
import { addADSOFieldToXml, addADSOKeyToXml } from "../api/adso"

const LOCK_BODY = (isLocal: boolean) => `<?xml version="1.0"?>
<asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0"><asx:values><DATA>
<LOCK_HANDLE>00ABC123</LOCK_HANDLE>${isLocal ? "<IS_LOCAL>X</IS_LOCAL>" : ""}<CORRNR></CORRNR>
</DATA></asx:values></asx:abap>`

describe("parseLockResponse isLocal（F8）", () => {
  test("IS_LOCAL=X → isLocal: true", () => {
    expect(parseLockResponse(LOCK_BODY(true))).toMatchObject({ lockHandle: "00ABC123", isLocal: true })
  })
  test("无 IS_LOCAL → isLocal: false", () => {
    expect(parseLockResponse(LOCK_BODY(false)).isLocal).toBe(false)
  })
  test("纯数字锁句柄仍为 string（fullParse 数字转换防御）", () => {
    const body = LOCK_BODY(false).replace("00ABC123", "12345678")
    expect(parseLockResponse(body).lockHandle).toBe("12345678")
    expect(typeof parseLockResponse(body).lockHandle).toBe("string")
  })
})

describe("withFreshSessionOnServerError（F7）", () => {
  const srvErr = (status: number) =>
    new AdtErrorException(status, {}, "", `server error ${status}`)

  test("5xx：丢弃会话重登后重试一次成功", async () => {
    const calls = { dropSession: 0, login: 0, op: 0 }
    const client = {
      async dropSession() { calls.dropSession++ },
      async login() { calls.login++ }
    } as unknown as AdtHTTP
    const op = async () => {
      calls.op++
      if (calls.op === 1) throw srvErr(500)
      return "ok" as const
    }
    const result = await withFreshSessionOnServerError(client, op)
    expect(result).toBe("ok")
    expect(calls).toEqual({ dropSession: 1, login: 1, op: 2 })
  })

  test("5xx 重试后仍失败：抛出第二次的错误", async () => {
    const calls = { op: 0 }
    const client = {
      async dropSession() { /* ok */ },
      async login() { /* ok */ }
    } as unknown as AdtHTTP
    const op = async () => {
      calls.op++
      throw srvErr(500)
    }
    await expect(withFreshSessionOnServerError(client, op)).rejects.toThrow("server error 500")
    expect(calls.op).toBe(2)
  })

  test("4xx 不重试（会话恢复只针对 5xx）", async () => {
    const op = jest.fn(async () => { throw srvErr(400) })
    await expect(withFreshSessionOnServerError({} as AdtHTTP, op)).rejects.toThrow("server error 400")
    expect(op).toHaveBeenCalledTimes(1)
  })

  test("非服务端错误原样上抛", async () => {
    const op = jest.fn(async () => { throw new Error("plain") })
    await expect(withFreshSessionOnServerError({} as AdtHTTP, op)).rejects.toThrow("plain")
  })

  test("isServerErrorException 判定边界", () => {
    expect(isServerErrorException(srvErr(500))).toBe(true)
    expect(isServerErrorException(srvErr(501))).toBe(true)
    expect(isServerErrorException(srvErr(400))).toBe(false)
    expect(isServerErrorException(new Error("x"))).toBe(false)
  })
})

const KEYED_XML = `<?xml version="1.0"?>
<adso:dataStore xmlns:adso="http://www.sap.com/bw/modeling/adso.ecore">
  <element xsi:type="adso:AdsoElement" name="ZFLD0" dimension="#///CHA§" sidDeterminationMode="N">
    <inlineType name="CHAR" length="10" semanticType="empty"/>
  </element>
  <keyElement>#///0EXISTING</keyElement>
</adso:dataStore>`

const KEYLESS_XML = `<?xml version="1.0"?>
<adso:dataStore xmlns:adso="http://www.sap.com/bw/modeling/adso.ecore">
  <dimension name="GROUP1"><descriptions/></dimension>
</adso:dataStore>`

describe("addADSOKeyToXml（F3）", () => {
  test("发射实测通过的形态：同名引用元素（含 inlineType/globalElementName）+ keyElement", () => {
    const next = addADSOKeyToXml(KEYLESS_XML, "0material")
    expect(next).toContain('<keyElement>#///0MATERIAL</keyElement>')
    expect(next).toContain('name="0MATERIAL" infoObjectName="0MATERIAL"')
    expect(next).toContain('dimension="#///__CHARACTERISTIC§"')
    expect(next).toContain('globalElementName="0MATERIAL"')
    expect(next).toContain("<inlineType")
    expect(next.indexOf("<element")).toBeLessThan(next.indexOf("<keyElement"))
  })

  test("幂等：已有同 iobj keyElement 时返回原文", () => {
    expect(addADSOKeyToXml(KEYED_XML, "0EXISTING")).toBe(KEYED_XML)
  })

  test("元素已存在时仅补 keyElement", () => {
    const withElem = KEYLESS_XML.replace("</adso:dataStore>", "  <element name=\"0MATERIAL\"/></adso:dataStore>")
    const next = addADSOKeyToXml(withElem, "0MATERIAL")
    expect(next).toContain("<keyElement>#///0MATERIAL</keyElement>")
    expect(next.match(/name="0MATERIAL"/g)).toHaveLength(1)
  })

  test("非法 InfoObject 名抛错", () => {
    expect(() => addADSOKeyToXml(KEYLESS_XML, "bad name!")).toThrow(/invalid InfoObject/)
  })
})

describe("addADSOFieldToXml 无键 fail-fast（F3）", () => {
  test("keyless XML 报错并指引 addADSOKeyToXml", () => {
    expect(() =>
      addADSOFieldToXml(KEYLESS_XML, { name: "ZF1", dataType: "CHAR", length: 5 })
    ).toThrow(/no <keyElement>[\s\S]*addADSOKeyToXml/)
  })

  test("有键 XML 正常插入", () => {
    const next = addADSOFieldToXml(KEYED_XML, { name: "ZF1", dataType: "CHAR", length: 5 })
    expect(next).toContain('name="ZF1"')
  })
})
