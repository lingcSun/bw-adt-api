/**
 * 建模层入口。
 *
 * `InfoProviderModel` 是水合式可编辑模型的联合类型。v1 仅 ADSO variant；
 * 其它类型（IOBJ/HCPR/…）验证后扩展联合，不提前占位。
 */
import { AdsoModel } from "./adso"

export { AdsoModel, type ModelOp } from "./adso"

/** InfoProvider 编辑模型，v1 单 variant 联合；随类型验证逐一扩展。 */
export type InfoProviderModel = AdsoModel
