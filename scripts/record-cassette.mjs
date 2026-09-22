#!/usr/bin/env node
/**
 * 真机卡带录制 — 对真实 BW 系统跑一遍自建对象的完整写流程，经
 * RecordingHttpClient 把每条 HTTP 往返记入卡带；随后可用 --replay 离线重放同一流程，
 * 验证"录制→回放"闭环。
 *
 * 纪律（沿用 .local/test-objects.md 约定）：
 *   - 只在 BW_REC_INFOAREA（默认 ZGLD_TEST）/$TMP 建临时对象，即建即删，finally 兜底清理
 *   - 卡带落盘前做凭据脱敏：Authorization/Cookie/set-cookie/CSRF/contextid 的值一律 [REDACTED]
 *   - 卡带响应体仍是真实系统数据（对象 XML 等），.local 默认不入库；提交前需人工审阅
 *
 * 用法：
 *   node scripts/record-cassette.mjs                        # 录制模式（连真机，需 .env）
 *   node scripts/record-cassette.mjs --replay <cassette>    # 回放模式（离线验证闭环）
 *
 * 环境变量：BW_BASE_URL/BW_USERNAME/BW_PASSWORD/BW_CLIENT/BW_LANGUAGE（.env）；
 *   可选 BW_REC_ADSO（靶子名，默认 ZBWAPI_REC1）、BW_REC_INFOAREA（默认 ZGLD_TEST）、
 *   BW_REC_TEMPLATE（创建模板，默认 ZS_FID23）。
 */
import { createRequire } from "node:module"
import { mkdirSync, writeFileSync, existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(here, "../.env") })

const pkg = require("../build/index.js")
const { BWAdtClient, saveAndActivateADSO, BWObjectType } = pkg
void saveAndActivateADSO
void BWObjectType
const { RecordingHttpClient } = require("../build/testing/replay/recording.js")
const { ReplayHttpClient } = require("../build/testing/replay/ReplayHttpClient.js")
const { loadCassette } = require("../build/testing/replay/cassette.js")
const { AxiosHttpClient } = require("../build/AxiosHttpClient.js")

const BASE_URL = process.env.BW_BASE_URL
const USERNAME = process.env.BW_USERNAME
const PASSWORD = process.env.BW_PASSWORD
const SAP_CLIENT = process.env.BW_CLIENT || "100"
const LANGUAGE = process.env.BW_LANGUAGE || "ZH"
const ADSO_ID = (process.env.BW_REC_ADSO || "ZBWAPI_R1").toUpperCase() // ADSO 名限 3-9 字符
const INFO_AREA = (process.env.BW_REC_INFOAREA || "ZGLD_TEST").toUpperCase()
const TEMPLATE = (process.env.BW_REC_TEMPLATE || "ZS_FID23").toUpperCase()

const argv = process.argv.slice(2)
const replayMode = argv[0] === "--replay"
if (!replayMode && !BASE_URL) {
  console.error("录制模式需要 .env 提供 BW_BASE_URL 等连接信息（或用 --replay <cassette> 离线回放）")
  process.exit(1)
}

// 卡带脱敏：会话类头只保留字段名，值一律打码。回放匹配只用 method+URL 路径，
// 响应头值不参与回放，因此脱敏不影响闭环。
const REDACT = new Set(["authorization", "cookie", "set-cookie", "x-csrf-token", "sap-contextid"])
const redactHeaders = (headers = {}) => {
  const out = {}
  for (const [k, v] of Object.entries(headers)) {
    out[k] = REDACT.has(k.toLowerCase()) ? "[REDACTED]" : v
  }
  return out
}
const redactInteraction = (it) => ({
  ...it,
  request: { ...it.request, headers: redactHeaders(it.request.headers) },
  response: { ...it.response, headers: redactHeaders(it.response.headers) },
})

const mkdirp = (p) => mkdirSync(p, { recursive: true })
const outDir = resolve(here, "../.local/cassettes")
const outPath = resolve(outDir, `save-activate-${ADSO_ID.toLowerCase()}-${Date.now()}.json`)

let transport
if (replayMode) {
  const cassettePath = resolve(argv[1])
  if (!existsSync(cassettePath)) {
    console.error("卡带不存在:", cassettePath)
    process.exit(1)
  }
  transport = new ReplayHttpClient(loadCassette(cassettePath))
  console.log("回放模式:", cassettePath)
} else {
  transport = new RecordingHttpClient(new AxiosHttpClient(BASE_URL))
  console.log("录制模式:", BASE_URL, "→ 卡带将写入", outPath)
}

const client = new BWAdtClient(transport, USERNAME, PASSWORD, SAP_CLIENT, LANGUAGE)
let created = false

// 兜底清理：无论中途成功失败，对象建了就尽量删掉（遵循即建即删约定）。
async function cleanup() {
  if (!created) return
  try {
    const lock = await client.lockADSO(ADSO_ID)
    await client.adso.delete(ADSO_ID, { lockHandle: lock.lockHandle })
    console.log("兜底清理：已删除", ADSO_ID)
  } catch (e) {
    console.error("兜底清理失败（需人工检查残留）:", ADSO_ID, e?.message ?? e)
  }
}

try {
  await client.login()
  console.log("✓ login")

  // 1. 创建（ADSO 模板，$TMP 本地对象）
  await client.adso.create({
    name: ADSO_ID,
    description: "cassette recording target (auto-removed)",
    infoArea: INFO_AREA,
    masterLanguage: LANGUAGE,
    responsible: USERNAME,
    template: { objectName: TEMPLATE, type: "ADSO" },
    packageName: "$TMP",
  })
  created = true
  console.log("✓ create", ADSO_ID)

  // 2. 读工作副本（forceCacheUpdate=true）
  const xml = await client.adso.xml(ADSO_ID, true)
  console.log("✓ xml", xml.length, "chars")

  // 3. 首轮写（lock → transportchecks → PUT → activation → unlock，核心录制对象）
  const save1 = await client.adso.saveAndActivate(ADSO_ID, xml)
  console.log("✓ saveAndActivate #1 activated=", save1.activated)

  // 4. 二轮写：加字段再保存（采集多轮写交互）
  const field = { name: "ZZREC_F1", dataType: "CHAR", length: 10, label: "REC" }
  await client.adso.addField(ADSO_ID, field)
  console.log("✓ addField", field.name)

  // 5. 读路径：details / versions
  const details = await client.adso.details(ADSO_ID, true)
  const versions = await client.adso.versions(ADSO_ID)
  console.log("✓ details/versions", versions?.length ?? "?", "versions")

  // 6. 删除（lockHandle 模式）
  const lock = await client.lockADSO(ADSO_ID)
  await client.adso.delete(ADSO_ID, { lockHandle: lock.lockHandle })
  created = false
  console.log("✓ delete", ADSO_ID)

  // 7. 删除后 exists 应为 false（顺带采集 exists 的往返）
  const gone = await client.adso.exists(ADSO_ID)
  console.log("✓ exists after delete =", gone)

  void save1
  void details
} finally {
  await cleanup()
  try {
    await client.logout()
    console.log("✓ logout")
  } catch {
    /* 会话可能已随对象删除，忽略登出失败 */
  }
}

if (replayMode) {
  console.log("回放完成：请求序列与卡带完全匹配，闭环成立。")
} else {
  mkdirp(outDir)
  const cassette = transport.toCassette()
  const safe = {
    ...cassette,
    interactions: (cassette.interactions ?? []).map(redactInteraction),
  }
  writeFileSync(outPath, JSON.stringify(safe, null, 2))
  console.log(`✓ 卡带已写入 ${outPath}（${safe.interactions.length} 条交互，凭据头已脱敏）`)
  console.log("下一步：人工审阅响应体后，可提交到固定路径供 CI 回放；回放验证：")
  console.log(`  node scripts/record-cassette.mjs --replay ${outPath}`)
}
