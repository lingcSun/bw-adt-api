import { AdtHTTP } from "../AdtHTTP"
import * as dtp from "../api/dtp"

/** Public facade for dataFlow · DTP. */
export class DtpDomain {
  constructor(private readonly h: AdtHTTP) {}

  details(dtpId: string, forceCacheUpdate?: boolean) {
    return dtp.getDTPDetails(this.h, dtpId, forceCacheUpdate)
  }

  xml(dtpId: string, forceCacheUpdate?: boolean) {
    return dtp.getDTPXml(this.h, dtpId, forceCacheUpdate)
  }

  versions(dtpId: string) {
    return dtp.getDTPVersions(this.h, dtpId)
  }

  check(dtpId: string) {
    return dtp.checkDTP(this.h, dtpId)
  }

  saveAndActivate(
    dtpId: string,
    xmlContent: string,
    options?: dtp.SaveAndActivateDTPOptions
  ) {
    return dtp.saveAndActivateDTP(this.h, dtpId, xmlContent, options)
  }

  execute(dtpId: string) {
    return dtp.executeDTP(this.h, dtpId)
  }
}
