/**
 * 域注册表与门面一致性（P1 Task 1，离线）。
 *
 * 注册表是后续任务（infoProvider 多态、动词族审计）的单一事实源：
 * - kind 三分类与域分类学笔记一致（query/ddic 为 structure：只读消费面）；
 * - verbs 列各域门面"当前实际"的方法名（类是事实，注册表跟随），
 *   一致性断言 verbs == 门面原型方法名，不断言 ∈ VERB_FAMILIES
 *   （越族动词用 notes 记录，如 dataSource.replicate）。
 *
 * 全部断言离线可得：只实例化类（{} as AdtHTTP），不发网络请求、不读 .env。
 */
import type { AdtHTTP } from "../AdtHTTP"
import {
  DOMAIN_REGISTRY,
  VERB_FAMILIES,
  getDomain
} from "../domains/registry"
import {
  AdsoDomain,
  DataSourceDomain,
  DdicDomain,
  DtpDomain,
  InfoAreaDomain,
  InfoObjectDomain,
  InfoProviderDomain,
  ProcessChainDomain,
  QueryDomain,
  RepositoryDomain,
  SystemDomain,
  TransportDomain,
  TrfnDomain
} from "../domains"

/** registry name → 门面类；无条目 = 尚未挂载到 BWAdtClient（注册表先行登记）。 */
const FACADE_CLASSES: Record<string, new (h: AdtHTTP) => unknown> = {
  adso: AdsoDomain,
  trfn: TrfnDomain,
  dtp: DtpDomain,
  dataSource: DataSourceDomain,
  processChain: ProcessChainDomain,
  infoObject: InfoObjectDomain,
  repository: RepositoryDomain,
  query: QueryDomain,
  system: SystemDomain,
  ddic: DdicDomain,
  transport: TransportDomain,
  infoArea: InfoAreaDomain,
  infoProvider: InfoProviderDomain
}

/** 未挂载域清单：infoArea（P1 Task 2）、infoProvider（P1 Task 3）均已挂载，当前应为空。 */
const EXPECTED_UNATTACHED: string[] = []

/** 门面原型上的公开方法名（prototype own-properties，去 constructor）。 */
function facadeMethods(facade: unknown): string[] {
  return Object.getOwnPropertyNames(Object.getPrototypeOf(facade)).filter(
    n => n !== "constructor"
  )
}

function attachedNames(): string[] {
  return DOMAIN_REGISTRY.filter(e => FACADE_CLASSES[e.name]).map(e => e.name)
}

describe("域注册表（13 域 = 12 现有 + infoProvider）", () => {
  test("恰好包含全部 13 域，无重复", () => {
    const names = DOMAIN_REGISTRY.map(e => e.name)
    expect(names).toHaveLength(13)
    expect(new Set(names).size).toBe(13)
    expect([...names].sort()).toEqual(
      [
        "adso",
        "dataSource",
        "ddic",
        "dtp",
        "infoArea",
        "infoObject",
        "infoProvider",
        "processChain",
        "query",
        "repository",
        "system",
        "transport",
        "trfn"
      ].sort()
    )
  })

  test("getDomain 按名取域；未知名返回 undefined", () => {
    expect(getDomain("adso")?.name).toBe("adso")
    expect(getDomain("infoArea")?.kind).toBe("structure")
    expect(getDomain("nope")).toBeUndefined()
  })

  test("每个条目都有 summary 与非空 verbs", () => {
    for (const e of DOMAIN_REGISTRY) {
      expect(e.summary.length).toBeGreaterThan(0)
      expect(e.verbs.length).toBeGreaterThan(0)
    }
  })
})

describe("kind 三分类（域分类学）", () => {
  test("modeling: infoProvider/adso/trfn/dtp/dataSource/infoObject", () => {
    for (const name of [
      "infoProvider",
      "adso",
      "trfn",
      "dtp",
      "dataSource",
      "infoObject"
    ]) {
      expect(getDomain(name)?.kind).toBe("modeling")
    }
  })

  test("ops: processChain（rspc 运维对象，无锁无激活）", () => {
    expect(getDomain("processChain")?.kind).toBe("ops")
  })

  test("structure: infoArea/repository/query/system/ddic/transport（只读消费面）", () => {
    for (const name of [
      "infoArea",
      "repository",
      "query",
      "system",
      "ddic",
      "transport"
    ]) {
      expect(getDomain(name)?.kind).toBe("structure")
    }
  })

  test("kind 值域只有 modeling/ops/structure 三种", () => {
    const kinds = [...new Set(DOMAIN_REGISTRY.map(e => e.kind))].sort()
    expect(kinds).toEqual(["modeling", "ops", "structure"])
  })

  test("VERB_FAMILIES 覆盖全部 kind 且非空", () => {
    expect(Object.keys(VERB_FAMILIES).sort()).toEqual([
      "modeling",
      "ops",
      "structure"
    ])
    for (const verbs of Object.values(VERB_FAMILIES)) {
      expect(verbs.length).toBeGreaterThan(0)
    }
  })
})

describe("infoArea 预注册（P1 Task 2 落地）", () => {
  test("已注册：structure、tree/validate 动词、标注 P1 Task 2 落地", () => {
    const e = getDomain("infoArea")
    expect(e).toBeDefined()
    expect(e?.kind).toBe("structure")
    expect(e?.verbs).toEqual(["tree", "validate"])
    expect(e?.notes).toContain("P1 Task 2")
  })
})

describe("infoProvider 预注册（P1 Task 3 落地）", () => {
  test("已注册：modeling、details/exists/adso 动词、ADSO 判别优先", () => {
    const e = getDomain("infoProvider")
    expect(e).toBeDefined()
    expect(e?.kind).toBe("modeling")
    expect(e?.verbs).toEqual(["details", "exists", "adso"])
    expect(e?.summary).toContain("ADSO")
  })

  test("全部注册域均已挂载到 client（EXPECTED_UNATTACHED 为空）", () => {
    const unattached = DOMAIN_REGISTRY.filter(
      e => !FACADE_CLASSES[e.name]
    ).map(e => e.name)
    expect(unattached).toEqual(EXPECTED_UNATTACHED)
  })
})

describe("注册表 verbs ⇄ 门面实际方法名（一致性）", () => {
  test.each(attachedNames())("%s: registry verbs == 原型方法名", name => {
    const entry = getDomain(name)
    const Facade = FACADE_CLASSES[name]
    expect(entry).toBeDefined()
    expect(Facade).toBeDefined()
    const facade = new Facade({} as AdtHTTP)
    expect(entry?.verbs).toEqual(facadeMethods(facade))
  })
})
