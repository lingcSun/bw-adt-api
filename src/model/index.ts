/**
 * 建模层入口（P2）。
 *
 * `InfoProviderModel` 是水合式可编辑模型的联合类型。v1 只有 ADSO 一个
 * variant——后续类型（IOBJ/HCPR/…）每经真机验证一种，联合随之增长，
 * 不提前占位（与 domains/infoProvider 的"不猜未验证类型"同一纪律）。
 */
import { AdsoModel } from "./adso"

export { AdsoModel, type ModelOp } from "./adso"

/** InfoProvider 编辑模型，v1 单 variant 联合；随类型验证逐一扩展。 */
export type InfoProviderModel = AdsoModel
