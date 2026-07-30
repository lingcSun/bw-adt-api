import { AdtHTTP } from "../AdtHTTP"
import * as ddic from "../api/ddic"

/** Public facade for DDIC / table data. */
export class DdicDomain {
  constructor(private readonly h: AdtHTTP) {}

  /** Merged describe: metadata + info + fields (+ data metadata when useful). */
  async describe(tableName: string) {
    const [metadata, info, fields, dataMetadata] = await Promise.all([
      ddic.getDDICTableMetadata(this.h, tableName).catch(() => undefined),
      ddic.getDDICTableInfo(this.h, tableName).catch(() => undefined),
      ddic.getDDICTableFields(this.h, tableName).catch(() => undefined),
      ddic.getDDICTableDataMetadata(this.h, tableName).catch(() => undefined)
    ])
    return { metadata, info, fields, dataMetadata }
  }

  getData(tableName: string, options?: object) {
    return ddic.getDDICTableData(this.h, tableName, options as any)
  }

  querySql(tableName: string, sqlStatement: string, options?: { maxRows?: number }) {
    return ddic.getTableDataViaSQL(this.h, tableName, sqlStatement, options)
  }

  adsoPreview(adsoName: string, maxRows?: number) {
    return ddic.getADSODataPreview(this.h, adsoName, maxRows)
  }

  adsoDdicLinks(adsoId: string) {
    return ddic.getADSODDICLinks(this.h, adsoId)
  }

  adsoDdicTableName(adsoId: string) {
    return ddic.getADSODDICTableName(this.h, adsoId)
  }
}
