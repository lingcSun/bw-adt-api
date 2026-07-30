import { AdtHTTP } from "../AdtHTTP"
import * as iobj from "../api/infoobject"

/** Public facade for infoObject. */
export class InfoObjectDomain {
  constructor(private readonly h: AdtHTTP) {}

  async get(iobjName: string, options?: iobj.GetInfoObjectOptions) {
    const [active, metadata] = await Promise.all([
      iobj.getInfoObject(this.h, iobjName, options),
      iobj.getInfoObjectMetadata(this.h, iobjName).catch(() => undefined)
    ])
    return { ...active, metadata }
  }

  validateExists(iobjName: string) {
    return iobj.validateInfoObjectExists(this.h, iobjName)
  }

  validateNewName(iobjName: string) {
    return iobj.validateInfoObjectNewName(this.h, iobjName)
  }
}
