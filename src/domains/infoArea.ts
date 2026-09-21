import { AdtHTTP } from "../AdtHTTP"
import * as repository from "../api/repository"
import * as adso from "../api/adso"

/**
 * Public facade for the InfoArea 容器域（structure kind：树导航 / 只读校验）。
 * P1 Task 2 归位：tree 自 repository.infoproviderStructure、validate 自
 * adso.validateInfoArea 迁入；旧位置保留 @deprecated 委托。
 */
export class InfoAreaDomain {
  constructor(private readonly h: AdtHTTP) {}

  /**
   * InfoArea 下可用于查询定义的对象树（2026-09-21 真机验证）。
   * type 默认 iobj_cha（特征），可选 iobj_kyf / iobj / adso。
   */
  tree(infoArea: string, type?: repository.InfoproviderStructureType) {
    return repository.getInfoproviderStructure(this.h, infoArea, type)
  }

  /** 验证 InfoArea 是否存在（validation exists）。 */
  validate(name: string) {
    return adso.validateInfoArea(this.h, name)
  }
}
