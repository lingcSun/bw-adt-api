import { AdtHTTP } from "../AdtHTTP"
import * as pc from "../api/processchain"

/** Public facade for processChain (ops-oriented). */
export class ProcessChainDomain {
  constructor(private readonly h: AdtHTTP) {}

  details(chainId: string) {
    return pc.getProcessChainDetails(this.h, chainId)
  }

  check(chainId: string) {
    return pc.checkProcessChain(this.h, chainId)
  }

  execute(chainId: string) {
    return pc.executeProcessChain(this.h, chainId)
  }

  stop(chainId: string) {
    return pc.stopProcessChain(this.h, chainId)
  }

  async logs(chainId: string) {
    const [logs, status] = await Promise.all([
      pc.getProcessChainLogs(this.h, chainId),
      pc.getProcessChainStatus(this.h, chainId)
    ])
    return { logs, status }
  }
}
