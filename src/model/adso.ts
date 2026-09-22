import type { AdtHTTP } from "../AdtHTTP"
import {
  getADSOXml,
  addADSOFieldToXml,
  removeADSOFieldFromXml,
  addADSOKeyToXml,
  type ADSOFieldDefinition
} from "../api/adso"

/**
 * 一条模型操作日志：记录「调用者可见意图」（kind + args + summary），
 * 不是 XML diff 片段——v1 不做三方合并/冲突重放（P3+），`plan()` 即 diff 预览。
 */
export interface ModelOp {
  kind: "addField" | "removeField" | "addKey"
  /** ISO 8601 时间戳（编辑成功落账的时刻）。 */
  at: string
  /** 调用者传入的实参（不含 xml 自身）。 */
  args: unknown[]
  /** 人类可读的一句话意图（含对象技术名）。 */
  summary: string
}

/**
 * ADSO 的水合式编辑模型（P2 Task 1）。
 *
 * hydrate 时经 `getADSOXml(h, id, true)` 全新读一份 XML 作为工作副本；
 * 三个链式编辑方法只把工作副本喂给 src/api/adso.ts 的纯变换函数——
 * 纯函数成功返回新 XML 才替换副本并追加 op；纯函数抛错（如重名字段）
 * 则副本与 op-log 皆保持不变、异常原样上抛。模型自身不重写任何 XML 手术逻辑。
 */
export class AdsoModel {
  private xmlContent: string
  private opLog: ModelOp[] = []

  private constructor(
    /** ADSO 技术名。 */
    readonly id: string,
    xml: string
  ) {
    this.xmlContent = xml
  }

  /**
   * 从服务端水合一个模型：全新读（forceCacheUpdate=true），
   * 不吃缓存，保证工作副本与服务器当前状态一致。
   */
  static async hydrate(h: AdtHTTP, adsoId: string): Promise<AdsoModel> {
    const xml = await getADSOXml(h, adsoId, true)
    return new AdsoModel(adsoId, xml)
  }

  /** 当前工作副本 XML（编辑方法返回的新 XML）。 */
  get xml(): string {
    return this.xmlContent
  }

  /** 只读 op-log 快照（每次取值返回副本，外部改动不影响账本）。 */
  get ops(): readonly ModelOp[] {
    return [...this.opLog]
  }

  /** diff 预览：逐条列出待落盘的意图；无 op 时给出占位行。 */
  plan(): string[] {
    if (this.opLog.length === 0) return ["(no pending ops)"]
    return this.opLog.map((op, i) => `${i + 1}. ${op.kind} — ${op.summary}`)
  }

  /** 加 field 类型字段（本地字段或经 infoObjectName 的 IOBJ 引用字段）。 */
  addField(field: ADSOFieldDefinition): this {
    const next = addADSOFieldToXml(this.xmlContent, field)
    this.xmlContent = next
    this.opLog.push({
      kind: "addField",
      at: new Date().toISOString(),
      args: [field],
      summary: `add field ${field.name}`
    })
    return this
  }

  /** 移除字段（field / InfoObject 引用通用，按 element name 匹配）。 */
  removeField(name: string): this {
    const next = removeADSOFieldFromXml(this.xmlContent, name)
    this.xmlContent = next
    this.opLog.push({
      kind: "removeField",
      at: new Date().toISOString(),
      args: [name],
      summary: `remove field ${name}`
    })
    return this
  }

  /**
   * 加键（InfoObject 键 = keyElement + 同名引用元素，实测形态见
   * addADSOKeyToXml）。length 透传给纯函数（仅实测过 40）。
   */
  addKey(infoObjectName: string, length?: number): this {
    const next = addADSOKeyToXml(this.xmlContent, infoObjectName, { length })
    this.xmlContent = next
    this.opLog.push({
      kind: "addKey",
      at: new Date().toISOString(),
      args: [infoObjectName, length],
      summary: `add key ${infoObjectName.toUpperCase()}`
    })
    return this
  }
}
