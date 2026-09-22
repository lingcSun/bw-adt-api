/**
 * 写引擎回放测试——VERIFIED_APIS §2 会话规约的线上（wire-level）断言。
 *
 * 手工卡带在这里扮演「§2 规约服务端」：按 §2 典型写序列预置响应
 * （lock=stateful → [transportchecks=stateless] → PUT=stateless → activation=stateless
 * → unlock=stateful），用 ReplayHttpClient 离线驱动真实 AdtHTTP +
 * saveAndActivateADSO 全链路，再对实际发出的请求（client.sent / 完整 options 快照）
 * 断言线语义：X-sap-adt-sessiontype 头、Cookie 上的 sap-contextid、
 * PUT 的 lockHandle query、activation 的 lockHandle body、finally 解锁。
 *
 * 诚实原则：这套测试证明的是「本仓库写引擎遵从 §2 规约」，不是 SAP 服务端的真实行为；
 * 卡带里的响应体是为让引擎走通而仿制的夹具（形状对照 parse* 的期望），凡断言
 * 「服务端真实行为」的测试必须走活系统（describeLive），卡带回放结果永远不得
 * 作为线上实测证据引用（Task 1 note / VERIFIED_APIS.md 地位不受影响）。
 *
 * 会话模型的一个精确细节：§2 表格里 contextid 由**首个 stateful 请求（lock）的响应**
 * 颁发（§1 会话表：stateful 首次不带 contextid），因此这里断言——
 * - lock：stateful 头，请求不带 contextid（尚未建立）；
 * - unlock：stateful 头 + 携带 lock 响应颁发的 contextid（回到持锁会话）；
 * - stateless 请求（transportchecks/PUT/activation）：绝不携带 contextid。
 * 全流程不存在「stateless + contextid」由第 ③ 组测试对三个流程统一断言。
 */
import { AdtHTTP, HttpClient, HttpClientOptions, HttpClientResponse, session_types } from "../AdtHTTP"
import { AdtErrorException, isAdtError } from "../AdtException"
import { SaveAndActivateADSOResult, saveAndActivateADSO } from "../api/adso"
import { Cassette, CassetteInteractionInput, cassette } from "../testing/replay/cassette"
import { ReplayHttpClient } from "../testing/replay/ReplayHttpClient"

// ============================================================================
// 夹具常量与「§2 规约服务端」卡带
// ============================================================================

const ADSO_ID = "ZTESTADSO"
const URI_NAME = "ztestadso" // 引擎统一小写进 URI
const LOCK_HANDLE = "00ABC123"
const CSRF_TOKEN = "x-csrf-token-cassette"
const CONTEXT_ID = "(BWP-100-cassette-ctx1)"
const SAP_CLIENT = "100"
const ADT_SESSIONTYPE = "X-sap-adt-sessiontype" // AdtHTTP 的 SESSION_HEADER 值
const TIMESTAMP = "20260922100000" // 由 ADSO_XML 的 adtcore:changedAt 提取

const ADSO_XML = `<?xml version="1.0" encoding="UTF-8"?>
<adso:dataStore xmlns:adso="http://www.sap.com/bw/modeling/adso.ecore" xmlns:adtcore="http://www.sap.com/adt/core" schemaVersion="1.0" name="${ADSO_ID}" readOnly="false" activateData="true" writeChangelog="true" adtcore:changedAt="2026-09-22T10:00:00Z">
  <endUserTexts label="replay cassette fixture"/>
  <tlogoProperties adtcore:language="EN" adtcore:name="${ADSO_ID}" adtcore:type="ADSO" adtcore:masterLanguage="EN" adtcore:masterSystem="BPD" adtcore:responsible="DEVELOPER">
    <infoArea>ZAREA</infoArea>
  </tlogoProperties>
  <keyElement>#///0MATERIAL</keyElement>
</adso:dataStore>`

/** lock 响应：asx DATA 形状对照 parseLockResponse（形状夹具，非实测证据） */
const lockXml = () => `<?xml version="1.0"?>
<asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0"><asx:values><DATA>
<LOCK_HANDLE>${LOCK_HANDLE}</LOCK_HANDLE><IS_LOCAL>X</IS_LOCAL><CORRUSER>DEVELOPER</CORRUSER>
</DATA></asx:values></asx:abap>`

/** transportchecks 响应：RECORDING=""（$TMP 本地对象不需要 TR）对照 parseTransportCheck */
const transportCheckXml = () => `<?xml version="1.0"?>
<asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0"><asx:values><DATA>
<PGMID>LIMU</PGMID><OBJECT>ADSO</OBJECT><OBJECTNAME>${ADSO_ID}</OBJECTNAME>
<OPERATION>I</OPERATION><DEVCLASS>$TMP</DEVCLASS><RECORDING></RECORDING><RESULT>S</RESULT>
</DATA></asx:values></asx:abap>`

/** PUT / activation 响应：atom feed + checkresult，对照 parseActivationResponse */
const checkFeed = (title: string, messageType: string) => `<?xml version="1.0" encoding="UTF-8"?>
<atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:bwModel="http://www.sap.com/bw/modeling">
  <atom:entry>
    <atom:id>sap/bw/modeling/adso/${URI_NAME}/m</atom:id>
    <atom:title>${title}</atom:title>
    <atom:content type="application/xml">
      <bwModel:checkresult messageType="${messageType}"/>
    </atom:content>
  </atom:entry>
</atom:feed>`

interface TapeOptions {
  /** 给了 transport 则 resolveTransportForWrite 短路、不发 transportchecks；不给则卡带按 RECORDING="" 应答 */
  transport?: string
  /** activation 交互改为 500 失败（驱动 finally 解锁与错误透传） */
  activationFails?: boolean
}

/** 手写「§2 规约服务端」卡带：交互顺序即 §2 典型写序列（docs/VERIFIED_APIS.md §2 表） */
const adsoWriteTape = (opts: TapeOptions = {}): Cassette => {
  const interactions: CassetteInteractionInput[] = [
    // 1. 登录 GET（AdtHTTP 附带 sap-client/sap-language query）：发 csrf token + 普通会话
    //    cookie；stateless 登录不颁发 sap-contextid（§1：contextid 由首个 stateful 请求的响应建立）
    {
      request: { method: "GET", url: "/sap/bc/adt/compatibility/graph" },
      response: {
        headers: {
          "x-csrf-token": CSRF_TOKEN,
          "set-cookie": [`sap-usercontext=sap-client=${SAP_CLIENT}; path=/`]
        }
      }
    },
    // 2. lock（§2 步骤 1，stateful）：ABAP 锁句柄 + set-cookie 颁发 sap-contextid
    {
      request: { method: "POST", url: `/sap/bw/modeling/adso/${URI_NAME}?action=lock` },
      response: {
        body: lockXml(),
        headers: { "set-cookie": [`sap-contextid=${CONTEXT_ID}; path=/`] }
      }
    }
  ]
  if (!opts.transport) {
    // 3a. transportchecks（§2 步骤 2，stateless；仅当调用方未显式给 transport 时出现）
    interactions.push({
      request: { method: "POST", url: "/sap/bc/adt/cts/transportchecks" },
      response: { body: transportCheckXml() }
    })
  }
  // 3b/4. PUT（§2 步骤 4，stateless；lockHandle/corrNr 走 URL query）
  interactions.push({
    request: { method: "PUT", url: `/sap/bw/modeling/adso/${URI_NAME}/m` },
    response: { body: checkFeed("Object saved", "Information") }
  })
  // 5. activation（§2 步骤 5，stateless；lockHandle 在 body 的 checkProperties 里）
  interactions.push({
    request: { method: "POST", url: "/sap/bw/modeling/activation" },
    response: opts.activationFails
      ? { status: 500, statusText: "Internal Server Error", headers: {}, body: "" }
      : { body: checkFeed("Activation successful", "Success") }
  })
  // 6. unlock（§2 步骤 6，stateful，finally 兜底）
  interactions.push({
    request: { method: "POST", url: `/sap/bw/modeling/adso/${URI_NAME}?action=unlock` },
    response: {}
  })
  return cassette(...interactions)
}

/**
 * ReplayHttpClient 的 .sent 只存 method/url/headers/body；而本仓库的 PUT/activation
 * 经 qs 传 lockHandle/corrNr（axios 在线上把 params 拼进 URL），qs 不进 .sent。
 * 这里在测试侧包一层把完整 HttpClientOptions（含 qs）也快照下来，与 inner.sent 同序——
 * 「PUT URL 带 lockHandle」的断言即来自此处（不改 src/testing/**）。
 */
class QsCapturingReplay implements HttpClient {
  private readonly inner: ReplayHttpClient
  private readonly capturedOptions: HttpClientOptions[] = []

  constructor(tape: Cassette) {
    this.inner = new ReplayHttpClient(tape)
  }

  get sent() {
    return this.inner.sent
  }

  get remaining() {
    return this.inner.remaining
  }

  /** 完整请求选项快照（含 qs），与 inner.sent 同序 */
  get sentOptions(): readonly HttpClientOptions[] {
    return this.capturedOptions
  }

  async request(options: HttpClientOptions): Promise<HttpClientResponse> {
    this.capturedOptions.push({ ...options })
    return this.inner.request(options)
  }
}

interface ReplayFlow {
  client: QsCapturingReplay
  result?: SaveAndActivateADSOResult
  error?: unknown
}

/** 构造 AdtHTTP over Replay 并跑完 saveAndActivateADSO，捕获结果/错误 */
const replayAdsoSave = async (opts: TapeOptions = {}): Promise<ReplayFlow> => {
  const client = new QsCapturingReplay(adsoWriteTape(opts))
  const http = new AdtHTTP(client, "DEVELOPER", "secret", SAP_CLIENT, "EN")
  try {
    const result = await saveAndActivateADSO(http, ADSO_ID, ADSO_XML,
      opts.transport ? { transport: opts.transport } : {})
    return { client, result }
  } catch (error) {
    return { client, error }
  }
}

// ============================================================================
// §2 断言助手：每条失败信息都必须引用 VERIFIED_APIS §2
// ============================================================================

const S2 = "docs/VERIFIED_APIS.md §2（写操作会话模型，已核实）"

const s2 = (cond: boolean, what: string): void => {
  if (!cond) throw new Error(`§2 规约违规: ${what} [出处: ${S2}]`)
}

const sessionTypeOf = (r: { headers: Record<string, string> }): string | undefined =>
  r.headers[ADT_SESSIONTYPE]

const carriesContextId = (r: { headers: Record<string, string> }): boolean =>
  (r.headers["Cookie"] || "").includes("sap-contextid")

// ============================================================================
// 回放测试
// ============================================================================

describe("写引擎回放——§2 规约的线上断言（离线卡带，零网络）", () => {
  it("① happy path（transport: TR1）：结果正确，且 .sent 序列逐条符合 §2", async () => {
    const { client, result, error } = await replayAdsoSave({ transport: "TR1" })
    expect(error).toBeUndefined()

    // —— 调用结果 ——
    expect(result).toBeDefined()
    expect(result!.lockHandle).toBe(LOCK_HANDLE)
    expect(result!.transport).toBe("TR1")
    expect(result!.activated).toBe(true)
    expect(result!.updateResult).toMatchObject({ success: true })
    expect(result!.activateResult).toMatchObject({ success: true })

    // 卡带恰好消费完：流程不多不少正好 5 个请求（登录+lock+PUT+activation+unlock）
    expect(client.remaining).toBe(0)
    expect(client.sent).toHaveLength(5)
    const [login, lock, put, activation, unlock] = client.sent

    // 0. 登录：GET graph，stateless，首次带 csrf-token: fetch
    expect(login.method).toBe("GET")
    expect(login.url).toBe("/sap/bc/adt/compatibility/graph")
    expect(login.headers["x-csrf-token"]).toBe("fetch")
    s2(sessionTypeOf(login) === session_types.stateless,
      `登录请求应带 stateless 会话头（实际 ${JSON.stringify(sessionTypeOf(login))}）`)

    // 1. lock：§2.1 必须 stateful（不是 stateful;enqueue）；首个 stateful 请求不带
    //    contextid——contextid 由本请求的响应颁发（§1 会话表），故这里断言其缺位
    expect(lock.url).toBe(`/sap/bw/modeling/adso/${URI_NAME}?action=lock`)
    s2(sessionTypeOf(lock) === session_types.stateful,
      `lock 必须发 stateful 会话头（实际 ${JSON.stringify(sessionTypeOf(lock))}）；` +
      `stateful;enqueue 会销毁会话，禁止使用`)
    s2(!carriesContextId(lock),
      "lock 请求不带 sap-contextid（首个 stateful 请求，会话尚未建立；contextid 由 lock 响应颁发，见 §1/§2）")
    expect(lock.headers["x-csrf-token"]).toBe(CSRF_TOKEN)

    // 2. PUT：§2.3 必须 stateless、不带 contextid；lockHandle 走 URL query（§2.3 服务端
    //    用 enqueue 表校验 URL 上的 lockHandle）
    expect(put.method).toBe("PUT")
    expect(put.url).toBe(`/sap/bw/modeling/adso/${URI_NAME}/m`)
    s2(sessionTypeOf(put) === session_types.stateless,
      `PUT 必须走 stateless 会话头（实际 ${JSON.stringify(sessionTypeOf(put))}）`)
    s2(!carriesContextId(put),
      "stateless PUT 不得携带 sap-contextid（携带会把请求路由进 stateful 会话并销毁它）")
    const putOptions = client.sentOptions[2]
    const putQs = putOptions?.qs as Record<string, string> | undefined
    s2(putQs != null && putQs["lockHandle"] === LOCK_HANDLE,
      `PUT 的 URL query 必须带 lockHandle=${LOCK_HANDLE}（实际 qs: ${JSON.stringify(putQs)}）；` +
      `服务端用 enqueue 锁表校验 URL 上的 lockHandle`)
    s2(putQs?.["corrNr"] === "TR1",
      `显式 transport 时 PUT 应带 corrNr=TR1（实际 qs: ${JSON.stringify(putQs)}）`)
    expect(put.headers["timestamp"]).toBe(TIMESTAMP)
    expect(put.body).toBe(ADSO_XML)

    // 3. activation：§2.3 必须 stateless、不带 contextid；lockHandle 在请求体
    expect(activation.url).toBe("/sap/bw/modeling/activation")
    s2(sessionTypeOf(activation) === session_types.stateless,
      `activation 必须走 stateless 会话头（实际 ${JSON.stringify(sessionTypeOf(activation))}）`)
    s2(!carriesContextId(activation),
      "stateless activation 不得携带 sap-contextid")
    expect(activation.body).toContain(`lockHandle="${LOCK_HANDLE}"`)
    const activationOptions = client.sentOptions[3]
    expect((activationOptions?.qs as Record<string, string> | undefined)?.["corrNr"]).toBe("TR1")

    // 4. unlock：§2.4 回到持锁的 stateful 会话——stateful 头 + contextid（lock 响应颁发）
    expect(unlock.url).toBe(`/sap/bw/modeling/adso/${URI_NAME}?action=unlock`)
    s2(sessionTypeOf(unlock) === session_types.stateful,
      `unlock 必须回到 stateful 会话头（实际 ${JSON.stringify(sessionTypeOf(unlock))}）`)
    s2(carriesContextId(unlock),
      "unlock 必须携带 sap-contextid（回到持锁的 stateful 会话）")
    expect(unlock.headers["Cookie"]).toContain(`sap-contextid=${CONTEXT_ID}`)
  })

  it("①b transportchecks 流程（未显式给 transport）：stateless 且不带 contextid", async () => {
    const { client, result, error } = await replayAdsoSave({})
    expect(error).toBeUndefined()
    expect(result).toBeDefined()
    expect(result!.transport).toBeUndefined() // RECORDING="" → 不需要 TR
    expect(result!.activated).toBe(true)
    expect(client.remaining).toBe(0)
    expect(client.sent).toHaveLength(6)

    const check = client.sent[2]
    expect(check.method).toBe("POST")
    expect(check.url).toBe("/sap/bc/adt/cts/transportchecks")
    s2(sessionTypeOf(check) === session_types.stateless,
      `transportchecks 必须走 stateless 会话头（实际 ${JSON.stringify(sessionTypeOf(check))}）`)
    s2(!carriesContextId(check),
      "stateless transportchecks 不得携带 sap-contextid")
  })

  it("② activation 失败：unlock 仍在 finally 发出（stateful+contextid），错误透传", async () => {
    const { client, result, error } = await replayAdsoSave({
      transport: "TR1",
      activationFails: true
    })

    // 错误透传，不吞也不换成成功结果
    expect(result).toBeUndefined()
    expect(isAdtError(error)).toBe(true)
    expect((error as AdtErrorException).err).toBe(500)
    expect((error as AdtErrorException).message).toContain("500")

    // unlock 仍在失败后发出，且是最后一个请求（finally 兜底，不留锁）
    const sent = client.sent
    const activationIdx = sent.findIndex(r => r.url === "/sap/bw/modeling/activation")
    const unlockIdx = sent.findIndex(r => r.url.endsWith("action=unlock"))
    expect(activationIdx).toBeGreaterThan(0)
    s2(unlockIdx === sent.length - 1,
      "activation 失败后 unlock 必须仍然发出且是最后一个请求（编排应在 finally 中 unlock，避免中途失败留下锁）")
    s2(unlockIdx > activationIdx,
      "unlock 必须发生在失败的 activation 之后（finally 语义）")
    const unlock = sent[unlockIdx]
    s2(sessionTypeOf(unlock) === session_types.stateful && carriesContextId(unlock),
      `失败路径的 unlock 仍必须 stateful + 携带 sap-contextid（实际会话头 ` +
      `${JSON.stringify(sessionTypeOf(unlock))}，contextid: ${carriesContextId(unlock)}）`)
    expect(client.remaining).toBe(0)
  })

  it("③ 三个流程全部请求中，不存在 stateless 请求携带 sap-contextid", async () => {
    const flows = [
      await replayAdsoSave({ transport: "TR1" }),
      await replayAdsoSave({}), // 含 transportchecks 的流程
      await replayAdsoSave({ transport: "TR1", activationFails: true })
    ]

    let statelessCount = 0
    let statefulCount = 0
    for (const { client } of flows) {
      for (const r of client.sent) {
        if (sessionTypeOf(r) === session_types.stateful) {
          statefulCount++
          continue
        }
        statelessCount++
        s2(!carriesContextId(r),
          `stateless 请求 ${r.method} ${r.url} 携带了 sap-contextid——` +
          `contextid 只能随 stateful 请求发送，stateless 携带会路由进并销毁持锁会话`)
      }
    }
    // 非空校验：断言不是空转（确实观察到了两类请求）
    expect(statelessCount).toBeGreaterThan(0)
    expect(statefulCount).toBeGreaterThan(0)
  })
})
