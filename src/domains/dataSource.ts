import { AdtHTTP } from "../AdtHTTP"
import * as ds from "../api/datasource"
import * as replication from "../api/replication"
import type { ReplicationTask } from "../api/types"

/** Public facade for dataSource (+ replication). */
export class DataSourceDomain {
  constructor(private readonly h: AdtHTTP) {}

  details(datasource: string, sourceSystem: string, forceCacheUpdate?: boolean) {
    return ds.getDataSourceDetails(this.h, datasource, sourceSystem, forceCacheUpdate)
  }

  fields(datasource: string, sourceSystem: string, forceCacheUpdate?: boolean) {
    return ds.getDataSourceFields(this.h, datasource, sourceSystem, forceCacheUpdate)
  }

  xml(datasource: string, sourceSystem: string, forceCacheUpdate?: boolean) {
    return ds.getDataSourceXml(this.h, datasource, sourceSystem, forceCacheUpdate)
  }

  versions(datasource: string, sourceSystem: string) {
    return ds.getDataSourceVersions(this.h, datasource, sourceSystem)
  }

  saveAndActivate(
    datasource: string,
    sourceSystem: string,
    xmlContent: string,
    options?: ds.SaveAndActivateDataSourceOptions
  ) {
    return ds.saveAndActivateDataSource(
      this.h,
      datasource,
      sourceSystem,
      xmlContent,
      options
    )
  }

  mergeProposal(datasource: string, sourceSystem: string, dataSourceXml: string) {
    return ds.mergeDataSourceProposal(this.h, datasource, sourceSystem, dataSourceXml)
  }

  replicationInfo(sourceSystem: string, datasource: string) {
    return replication.getReplicationInfo(this.h, sourceSystem, datasource)
  }

  replicate(
    sourceSystem: string,
    datasource: string,
    tasks: ReplicationTask[],
    options?: { activate?: string; background?: boolean }
  ) {
    return replication.replicateDataSource(
      this.h,
      sourceSystem,
      datasource,
      tasks,
      options
    )
  }

  replicateFull(
    sourceSystem: string,
    datasource: string,
    options?: { activate?: string; background?: boolean }
  ) {
    return replication.replicateDataSourceFull(
      this.h,
      sourceSystem,
      datasource,
      options
    )
  }
}
