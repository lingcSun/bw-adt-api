import { AdtHTTP } from "../AdtHTTP"
import * as search from "../api/search"
import * as dataflow from "../api/dataflow"
import * as repository from "../api/repository"

/** Public facade for repository search / lineage / structure. */
export class RepositoryDomain {
  constructor(private readonly h: AdtHTTP) {}

  /**
   * InfoArea 下可用于查询定义的对象树（2026-09-21 真机验证）。
   * type 默认 iobj_cha（特征），可选 iobj_kyf / iobj / adso。
   *
   * @deprecated 使用 `client.infoArea.tree`（P1 Task 2 归位 infoArea 域）。
   */
  infoproviderStructure(
    infoArea: string,
    type?: repository.InfoproviderStructureType
  ) {
    return repository.getInfoproviderStructure(this.h, infoArea, type)
  }

  search(options: search.BWSearchOptions) {
    return search.searchBWObjects(this.h, options)
  }

  transformationsOf(adsoName: string) {
    return search.getTransformationsOf(this.h, adsoName)
  }

  dtpsOf(adsoName: string) {
    return search.getDTPsOf(this.h, adsoName)
  }

  dataflow(
    objectName: string,
    objectType: string = "ADSO",
    options?: dataflow.DataflowOptions
  ) {
    return dataflow.getDataflow(this.h, objectName, objectType, options)
  }

  lineage(
    targetName: string,
    sourceName: string,
    targetType: string = "ADSO",
    options?: dataflow.DataflowOptions
  ) {
    return dataflow.getDataflowLineage(
      this.h,
      targetName,
      sourceName,
      targetType,
      options
    )
  }
}
