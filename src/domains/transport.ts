import { AdtHTTP } from "../AdtHTTP"
import * as transport from "../api/transport"

/** Public facade for CTS transport. */
export class TransportDomain {
  constructor(private readonly h: AdtHTTP) {}

  check(objectUri: string, devclass?: string, operation?: string) {
    return transport.transportCheck(this.h, objectUri, devclass, operation)
  }

  create(refUri: string, description: string, devclass?: string) {
    return transport.createTransport(this.h, refUri, description, devclass)
  }
}
