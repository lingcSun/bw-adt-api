import { AdtHTTP } from "../AdtHTTP"
import * as reporting from "../api/reporting"

/** Public facade for query / reporting preview. */
export class QueryDomain {
  constructor(private readonly h: AdtHTTP) {}

  initialView(
    providerName: string,
    options?: Parameters<typeof reporting.getReportingInitialView>[2]
  ) {
    return reporting.getReportingInitialView(this.h, providerName, options)
  }

  updateView(
    providerName: string,
    state: Parameters<typeof reporting.updateReportingView>[2],
    options?: Parameters<typeof reporting.updateReportingView>[3]
  ) {
    return reporting.updateReportingView(this.h, providerName, state, options)
  }

  preview(
    providerName: string,
    options: Parameters<typeof reporting.queryProviderPreview>[2]
  ) {
    return reporting.queryProviderPreview(this.h, providerName, options)
  }
}
