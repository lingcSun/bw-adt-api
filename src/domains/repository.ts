import { AdtHTTP } from "../AdtHTTP"
import * as search from "../api/search"
import * as dataflow from "../api/dataflow"

/** Public facade for repository search / lineage. */
export class RepositoryDomain {
  constructor(private readonly h: AdtHTTP) {}

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
