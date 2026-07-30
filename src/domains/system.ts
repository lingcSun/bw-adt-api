import { AdtHTTP } from "../AdtHTTP"
import * as systemInfo from "../api/systemInfo"

/** Public facade for system info / capabilities. */
export class SystemDomain {
  constructor(private readonly h: AdtHTTP) {}

  async info() {
    const info = await systemInfo.systemInfo(this.h)
    return info
  }

  getProperty(propertyName: string) {
    return systemInfo.getSystemProperty(this.h, propertyName)
  }

  hasCapability(capabilityName: string) {
    return systemInfo.hasCapability(this.h, capabilityName)
  }
}
