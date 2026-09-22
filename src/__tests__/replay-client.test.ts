/**
 * 回放基础设施离线单测：卡带格式、ReplayHttpClient（FIFO 匹配/耗尽诊断/请求捕获）、
 * RecordingHttpClient（透传+落盘）。全程不碰网络、不依赖 .env（不用 describeLive：
 * 这里断言的是卡带引擎与录放逻辑本身，不是服务端真实行为——后者必须走活系统套件）。
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import {
  AdtHTTP,
  HttpClient,
  HttpClientException,
  HttpClientOptions,
  HttpClientResponse,
  isHttpClientException,
  session_types
} from "../AdtHTTP"
import {
  CassetteInteraction,
  cassette,
  loadCassette,
  normalizeCassette
} from "../testing/replay/cassette"
import { ReplayHttpClient, urlMatches } from "../testing/replay/ReplayHttpClient"
import { RecordingHttpClient } from "../testing/replay/recording"

const errOf = async (p: Promise<unknown>): Promise<HttpClientException> =>
  (await p.catch(e => e)) as HttpClientException

describe("cassette 卡带格式（离线）", () => {
  it("cassette() 为手写卡带兜底默认值：status 200 / OK / 空 headers / 空 body", () => {
    const c = cassette({ request: { method: "GET", url: "/a" } })
    expect(c.interactions).toHaveLength(1)
    expect(c.interactions[0].request).toEqual({
      method: "GET",
      url: "/a",
      headers: {}
    })
    expect(c.interactions[0].response).toEqual({
      status: 200,
      statusText: "OK",
      headers: {},
      body: ""
    })
  })

  it("normalizeCassette 校验形状，错误信息带来源与交互序号", () => {
    expect(() => normalizeCassette("nope", "x.json")).toThrow(/interactions/)
    expect(() => normalizeCassette({ nope: true }, "x.json")).toThrow(
      /interactions/
    )
    expect(() =>
      normalizeCassette(
        { interactions: [{ request: { method: "GET" } }] },
        "x.json"
      )
    ).toThrow(/interaction #0/)
    expect(() =>
      normalizeCassette(
        { interactions: [{ request: { method: "GET" } }] },
        "x.json"
      )
    ).toThrow(/url/)
  })

  it("loadCassette：文件缺失 / JSON 损坏时报错并带路径", () => {
    const dir = mkdtempSync(join(tmpdir(), "bw-adt-cassette-"))
    try {
      expect(() => loadCassette(join(dir, "missing.json"))).toThrow(
        /missing\.json/
      )
      const bad = join(dir, "bad.json")
      writeFileSync(bad, "{not json", "utf8")
      expect(() => loadCassette(bad)).toThrow(/bad\.json/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe("ReplayHttpClient FIFO 匹配（离线）", () => {
  it("按 FIFO 顺序消费交互并按序返回录制的响应", async () => {
    const replay = new ReplayHttpClient(
      cassette(
        { request: { method: "GET", url: "/sap/bc/adt/a" }, response: { body: "one" } },
        {
          request: { method: "POST", url: "/sap/bc/adt/a/b" },
          response: { status: 201, statusText: "Created", body: "two" }
        }
      )
    )
    const first = await replay.request({ url: "/sap/bc/adt/a" })
    expect(first.body).toBe("one")
    expect(first.status).toBe(200)
    const second = await replay.request({
      url: "/sap/bc/adt/a/b",
      method: "POST"
    })
    expect(second.status).toBe(201)
    expect(second.statusText).toBe("Created")
    expect(second.body).toBe("two")
  })

  it("URL 归一化：query、scheme://host、前导斜杠差异不破坏匹配", async () => {
    const replay = new ReplayHttpClient(
      cassette(
        { request: { method: "GET", url: "/sap/bc/adt/foo" }, response: { body: "q" } }
      )
    )
    // 请求带 query，卡带只有路径
    await expect(
      replay.request({ url: "/sap/bc/adt/foo?sap-client=001&sap-language=EN" })
    ).resolves.toBeDefined()
    // 请求是绝对 URL
    const replay2 = new ReplayHttpClient(
      cassette({ request: { method: "GET", url: "/sap/bc/adt/foo" } })
    )
    await expect(
      replay2.request({ url: "https://bw.host:44300/sap/bc/adt/foo" })
    ).resolves.toBeDefined()
    // 请求是相对路径（无前导斜杠）
    const replay3 = new ReplayHttpClient(
      cassette({ request: { method: "GET", url: "/sap/bc/adt/foo" } })
    )
    await expect(
      replay3.request({ url: "sap/bc/adt/foo" })
    ).resolves.toBeDefined()
  })

  it("前缀按路径段对齐：/foo 匹配 /foo/bar 但不匹配 /foobar；尾部斜杠不对称", () => {
    expect(urlMatches("/sap/bc/adt/foo", "/sap/bc/adt/foo/bar")).toBe(true)
    expect(urlMatches("/sap/bc/adt/foo", "/sap/bc/adt/foobar")).toBe(false)
    expect(urlMatches("/sap/bc/adt/foo", "/sap/bc/adt/foo")).toBe(true)
    // 尾部斜杠不对称：/a 匹配 /a/，但 /a/ 不匹配 /a
    expect(urlMatches("/a", "/a/")).toBe(true)
    expect(urlMatches("/a/", "/a")).toBe(false)
  })

  it("\"/\" 是通配前缀：匹配一切请求路径", () => {
    expect(urlMatches("/", "/foo/bar")).toBe(true)
    expect(urlMatches("/", "/")).toBe(true)
    expect(urlMatches("https://host:44300/", "/anything?q=1")).toBe(true)
  })

  it("通配前缀在回放里可用：卡带 url \"/\" 匹配任意请求", async () => {
    const replay = new ReplayHttpClient(
      cassette({ request: { method: "GET", url: "/" }, response: { body: "any" } })
    )
    await expect(
      replay.request({ url: "/sap/bc/adt/whatever", method: "GET" })
    ).resolves.toBeDefined()
    const replay2 = new ReplayHttpClient(
      cassette({ request: { method: "GET", url: "/" }, response: { body: "any" } })
    )
    await expect(
      replay2.request({ url: "sap-client-scoped", method: "GET" })
    ).resolves.toBeDefined()
  })

  it("method 大小写不敏感；缺省 method 视为 GET", async () => {
    const replay = new ReplayHttpClient(
      cassette({ request: { method: "get", url: "/a" } })
    )
    await expect(replay.request({ url: "/a", method: "GET" })).resolves
      .toBeDefined()
    const replay2 = new ReplayHttpClient(
      cassette({ request: { method: "GET", url: "/a" } })
    )
    await expect(replay2.request({ url: "/a" })).resolves.toBeDefined()
  })

  it("method 不匹配：抛 HttpClientException，诊断含期望交互与实际请求，且不消耗交互", async () => {
    const replay = new ReplayHttpClient(
      cassette({
        request: { method: "GET", url: "/sap/bc/adt/graph" },
        response: { body: "g" }
      })
    )
    const err = await errOf(
      replay.request({ url: "/sap/bc/adt/graph", method: "POST" })
    )
    expect(isHttpClientException(err)).toBe(true)
    expect(err.code).toBe("CASSETTE_MISMATCH")
    expect(err.message).toContain("GET /sap/bc/adt/graph")
    expect(err.message).toContain("POST /sap/bc/adt/graph")
    // 失配不消耗：改对方法后同一交互仍可消费
    await expect(replay.request({ url: "/sap/bc/adt/graph" })).resolves.toBeDefined()
  })

  it("路径不匹配：诊断同时给出期望下一条交互与实际请求", async () => {
    const replay = new ReplayHttpClient(
      cassette({
        request: { method: "PUT", url: "/sap/bc/adt/objects/x" },
        response: {}
      })
    )
    const err = await errOf(replay.request({ url: "/sap/bc/adt/other" }))
    expect(err.code).toBe("CASSETTE_MISMATCH")
    expect(err.message).toContain("PUT /sap/bc/adt/objects/x")
    expect(err.message).toContain("GET /sap/bc/adt/other")
  })

  it("耗尽：抛 CASSETTE_EXHAUSTED，诊断含已消费总数与实际请求", async () => {
    const replay = new ReplayHttpClient(
      cassette({ request: { method: "GET", url: "/only" }, response: {} })
    )
    await expect(replay.request({ url: "/only" })).resolves.toBeDefined()
    const err = await errOf(replay.request({ url: "/only", method: "POST" }))
    expect(isHttpClientException(err)).toBe(true)
    expect(err.code).toBe("CASSETTE_EXHAUSTED")
    expect(err.message).toMatch(/exhausted/i)
    expect(err.message).toContain("POST /only")
    expect(err.message).toContain("1")
  })
})

describe("ReplayHttpClient .sent 请求捕获（离线）", () => {
  it("捕获每个经过的请求（含失配/耗尽的），headers/body 保真且是快照", async () => {
    const replay = new ReplayHttpClient(cassette())
    const headers = {
      "X-sap-adt-sessiontype": "stateful",
      Cookie: "sap-contextid=CTX"
    }
    await expect(
      replay.request({
        url: "/sap/bc/adt/objects?x=1",
        method: "PUT",
        headers,
        body: "<payload/>"
      })
    ).rejects.toThrow(/exhausted/i)
    expect(replay.sent).toHaveLength(1)
    const [sent] = replay.sent
    expect(sent.method).toBe("PUT")
    expect(sent.url).toBe("/sap/bc/adt/objects?x=1")
    expect(sent.headers).toEqual({
      "X-sap-adt-sessiontype": "stateful",
      Cookie: "sap-contextid=CTX"
    })
    expect(sent.body).toBe("<payload/>")
    // 快照隔离：调用方事后篡改原 headers 对象，不影响已捕获记录
    headers.Cookie = "tampered"
    expect(replay.sent[0].headers.Cookie).toBe("sap-contextid=CTX")
  })

  it("qs 捕获进 .sent：快照隔离；匹配不受 qs 影响（卡带 qs 仅供参考）", async () => {
    const replay = new ReplayHttpClient(
      cassette({
        request: { method: "PUT", url: "/sap/bc/adt/objects" },
        response: { body: "ok" }
      })
    )
    const qs = { lockHandle: "LH1", corrNr: "TR1" }
    await expect(
      replay.request({ url: "/sap/bc/adt/objects", method: "PUT", qs })
    ).resolves.toBeDefined()
    expect(replay.sent).toHaveLength(1)
    expect(replay.sent[0].qs).toEqual({ lockHandle: "LH1", corrNr: "TR1" })
    // 快照隔离：调用方事后篡改原 qs 对象，不影响已捕获记录
    qs.lockHandle = "TAMPERED"
    expect(replay.sent[0].qs?.lockHandle).toBe("LH1")
    // 请求缺 qs → 快照里不落 qs 字段
    const replay2 = new ReplayHttpClient(
      cassette({ request: { method: "GET", url: "/a" }, response: {} })
    )
    await expect(replay2.request({ url: "/a" })).resolves.toBeDefined()
    expect("qs" in replay2.sent[0]).toBe(false)
  })

  it("旧形状卡带（交互无 qs 字段）照常规范与回放：匹配只看 method+路径", () => {
    const legacy = normalizeCassette(
      {
        interactions: [
          { request: { method: "GET", url: "/a" }, response: { body: "ok" } }
        ]
      },
      "legacy.json"
    )
    expect("qs" in legacy.interactions[0].request).toBe(false)
    const replay = new ReplayHttpClient(legacy)
    // 请求侧带 qs 也不影响匹配（qs 不参与匹配，避免破坏既有手工卡带）
    return expect(
      replay.request({ url: "/a", qs: { "sap-client": "001" } })
    ).resolves.toBeDefined()
  })

  it("失配不消耗、成功才前进：sent 记录每一次尝试", async () => {
    const replay = new ReplayHttpClient(
      cassette({ request: { method: "GET", url: "/a" }, response: {} })
    )
    await expect(replay.request({ url: "/wrong" })).rejects.toThrow(
      /mismatch/i
    )
    await expect(replay.request({ url: "/a" })).resolves.toBeDefined()
    await expect(replay.request({ url: "/a" })).rejects.toThrow(/exhausted/i)
    expect(replay.sent).toHaveLength(3)
    expect(replay.sent.map(s => s.url)).toEqual(["/wrong", "/a", "/a"])
  })

  it("驱动真实 AdtHTTP 走完 login + stateful 请求：sent 捕获线上的会话头与 contextid", async () => {
    const replay = new ReplayHttpClient(
      cassette(
        {
          request: { method: "GET", url: "/sap/bc/adt/compatibility/graph" },
          response: {
            headers: {
              "x-csrf-token": "TICKET-1",
              "set-cookie": ["sap-contextid=CTX123; path=/"]
            }
          }
        },
        {
          request: { method: "POST", url: "/sap/bc/adt/objects" },
          response: { body: "<ok/>" }
        }
      )
    )
    const http = new AdtHTTP(replay, "DEVELOPER", "secret", "001", "EN")
    const resp = await http.request("/sap/bc/adt/objects", {
      method: "POST",
      body: "<adso:dataStore/>",
      sessionType: session_types.stateful
    })
    expect(resp.body).toBe("<ok/>")
    expect(replay.sent).toHaveLength(2)
    const [login, main] = replay.sent
    expect(login.method).toBe("GET")
    expect(login.url).toBe("/sap/bc/adt/compatibility/graph")
    expect(login.headers["X-sap-adt-sessiontype"]).toBe("stateless")
    expect(main.method).toBe("POST")
    expect(main.body).toBe("<adso:dataStore/>")
    expect(main.headers["X-sap-adt-sessiontype"]).toBe("stateful")
    expect(main.headers["x-csrf-token"]).toBe("TICKET-1")
    expect(main.headers["Cookie"]).toContain("sap-contextid=CTX123")
  })
})

describe("RecordingHttpClient 透传与落盘（离线）", () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "bw-adt-cassette-"))
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it("透传响应与请求给 inner，同时记录请求/响应快照并触发 sink", async () => {
    const raw: HttpClientResponse = {
      status: 200,
      statusText: "OK",
      headers: {
        "content-type": "application/xml",
        "set-cookie": ["sap-contextid=A; path=/"]
      },
      body: "<x/>"
    }
    const innerFn = jest.fn(async (_options: HttpClientOptions) => raw)
    const inner: HttpClient = { request: innerFn }
    const seen: CassetteInteraction[] = []
    const rec = new RecordingHttpClient(inner, i => seen.push(i))
    const options = {
      url: "/sap/bc/adt/objects",
      method: "POST" as const,
      headers: { a: "b" },
      body: "B"
    }
    const resp = await rec.request(options)
    // 透传：inner 收到原 options，调用方拿到原响应引用
    expect(innerFn).toHaveBeenCalledWith(options)
    expect(resp).toBe(raw)
    expect(seen).toHaveLength(1)
    expect(rec.interactions).toHaveLength(1)
    const recorded = rec.interactions[0]
    expect(recorded.request).toEqual({
      method: "POST",
      url: "/sap/bc/adt/objects",
      headers: { a: "b" },
      body: "B"
    })
    expect(recorded.response).toEqual({
      status: 200,
      statusText: "OK",
      headers: {
        "content-type": "application/xml",
        "set-cookie": ["sap-contextid=A; path=/"]
      },
      body: "<x/>"
    })
    // 快照隔离：事后篡改原响应，已记录内容不变
    raw.headers["extra"] = "1"
    raw.body = "mutated"
    expect(rec.interactions[0].response.body).toBe("<x/>")
    expect(rec.interactions[0].response.headers).not.toHaveProperty("extra")
    expect(rec.interactions[0].response.headers["set-cookie"]).toEqual([
      "sap-contextid=A; path=/"
    ])
  })

  it("saveCassette 落盘 JSON；loadCassette 读回后 ReplayHttpClient 可原样回放（含 set-cookie）", async () => {
    const raw: HttpClientResponse = {
      status: 201,
      statusText: "Created",
      headers: { "set-cookie": ["sap-contextid=REC; path=/"] },
      body: "<created/>"
    }
    const rec = new RecordingHttpClient({
      request: async () => raw
    })
    await rec.request({
      url: "/sap/bc/adt/objects",
      method: "POST",
      headers: { a: "b" },
      body: "B"
    })
    const file = join(dir, "recording.json")
    rec.saveCassette(file)
    const onDisk = JSON.parse(readFileSync(file, "utf8"))
    expect(onDisk.interactions).toHaveLength(1)
    expect(onDisk.interactions[0].request.method).toBe("POST")
    expect(onDisk.interactions[0].response.body).toBe("<created/>")

    const replay = new ReplayHttpClient(loadCassette(file))
    const replayed = await replay.request({
      url: "/sap/bc/adt/objects",
      method: "POST",
      headers: { a: "b" },
      body: "B"
    })
    expect(replayed.status).toBe(201)
    expect(replayed.statusText).toBe("Created")
    expect(replayed.body).toBe("<created/>")
    expect(replayed.headers["set-cookie"]).toEqual(["sap-contextid=REC; path=/"])
  })

  it("非 set-cookie 数组头也做变异隔离（cloneHeaders 泛化数组拷贝）", async () => {
    const raw: HttpClientResponse = {
      status: 200,
      statusText: "OK",
      headers: { "x-multi-value": ["a", "b"] },
      body: ""
    }
    const rec = new RecordingHttpClient({ request: async () => raw })
    await rec.request({ url: "/a" })
    // 事后篡改原数组，已记录的快照不变
    ;(raw.headers["x-multi-value"] as string[]).push("c")
    expect(rec.interactions[0].response.headers["x-multi-value"]).toEqual([
      "a",
      "b"
    ])
  })

  it("inner 抛错时原样上抛且不记录", async () => {
    const boom = new Error("network down")
    const rec = new RecordingHttpClient({
      request: async () => {
        throw boom
      }
    })
    await expect(rec.request({ url: "/a" })).rejects.toBe(boom)
    expect(rec.interactions).toHaveLength(0)
  })
})
