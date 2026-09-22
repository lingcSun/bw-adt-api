import { AdtHTTP } from "../AdtHTTP"
import * as search from "../api/search"
import { AdsoDomain } from "./adso"
import { AdsoModel, type InfoProviderModel } from "../model"

/**
 * 精确名匹配：BW 技术名服务端归大写，判别两侧统一大写比较
 * （与 api/search.ts getTransformationsOf 的 title 比较同一口径）。
 */
function isExactName(hit: search.BWSearchResult, name: string) {
  return hit.objectName.toUpperCase() === name.toUpperCase()
}

/**
 * 按精确名搜 InfoProvider 并返回命中项。
 * searchInDescription=false：判别只认名字，描述词命中会引入噪音。
 */
async function findExact(h: AdtHTTP, name: string) {
  const hits = await search.searchBWObjects(h, {
    searchTerm: name,
    searchInName: true,
    searchInDescription: false
  })
  return hits.find(hit => isExactName(hit, name))
}

/**
 * Public facade for InfoProvider（多态域，P1 Task 3）。
 *
 * 唯一诚实可用的判别（见 .agents/notes/implemented/architecture/2026-09-21-domain-taxonomy.md）：
 * details/exists 经 repository.search 精确名取 objectType；ADSO 转发
 * AdsoDomain（证据最全的已验证类型），其余类型抛错不猜——每真机验证
 * 一种类型，进一种。
 */
export class InfoProviderDomain {
  constructor(private readonly h: AdtHTTP) {}

  /**
   * InfoProvider 详情：search 判别 objectType 后按类型分发。
   * ADSO → AdsoDomain.details；其余类型/未命中分别抛
   * "not verified yet" / "not found"（不猜未验证端点）。
   */
  async details(name: string) {
    const hit = await findExact(this.h, name)
    if (!hit) throw new Error(`InfoProvider ${name} not found`)
    if (hit.objectType !== "ADSO") {
      throw new Error(
        `InfoProvider type ${hit.objectType} not verified yet — see ` +
          ".agents/notes/implemented/architecture/2026-09-21-domain-taxonomy.md"
      )
    }
    return new AdsoDomain(this.h).details(name)
  }

  /** InfoProvider 是否存在：search 精确名命中（大小写不敏感）。 */
  async exists(name: string) {
    return (await findExact(this.h, name)) !== undefined
  }

  /**
   * ADSO 类型特化面：返回绑定同一 AdtHTTP 的 AdsoDomain 实例
   * （与 `client.adso` 同类；`client.adso` 是本方法的快捷方式）。
   * name 不在此消费——返回的是通用 ADSO 门面，各动词自取参数。
   */
  adso(_name: string) {
    return new AdsoDomain(this.h)
  }

  /**
   * InfoProvider 水合编辑模型：search 判别 objectType 后按类型分发
   * （P2 Task 2 落地，替换 Task 1 占位桩）。
   * ADSO → AdsoModel.hydrate（全新读工作副本）；其余类型/未命中
   * 与 details 同一守卫口径（not verified yet / not found，不猜未验证类型）。
   */
  async hydrate(name: string): Promise<InfoProviderModel> {
    const hit = await findExact(this.h, name)
    if (!hit) throw new Error(`InfoProvider ${name} not found`)
    if (hit.objectType !== "ADSO") {
      throw new Error(
        `InfoProvider type ${hit.objectType} not verified yet — see ` +
          ".agents/notes/implemented/architecture/2026-09-21-domain-taxonomy.md"
      )
    }
    return AdsoModel.hydrate(this.h, name)
  }
}
