/**
 * ABAP runtime dumps (ST22) Atom feed — ported from abap-adt-api feeds.ts.
 * Endpoint: GET /sap/bc/adt/runtime/dumps
 */
import { AdtHTTP } from "../AdtHTTP"
import {
  fullParse,
  xmlArray,
  xmlNodeAttr,
  parseJsonDate,
} from "../utilities"

export interface Link {
  etag?: number
  href: string
  rel: string
  type?: string
  title?: string
}

export interface DumpCategory {
  term: string
  label: "ABAP runtime error" | "Terminated ABAP program"
}

export interface Dump {
  categories: DumpCategory[]
  links: Link[]
  id: string
  author?: string
  title: string
  updated: Date
  text: string
  type: string
}

export interface DumpsFeed {
  href: string
  title: string
  updated: Date
  dumps: Dump[]
}

/** Parse Atom dumps feed body. Exported for unit tests. */
export const parseDumps = (body: string): DumpsFeed => {
  const raw = fullParse(body, {
    removeNSPrefix: true,
    // dump summaries embed escaped HTML; default entity budget is too low
    processEntities: { enabled: true, maxTotalExpansions: 1000000 },
  })?.feed
  const { href } = xmlNodeAttr(raw?.link)
  const { title, updated } = raw
  const dumps = xmlArray(raw, "entry").map((e: any) => {
    const category = xmlArray(e, "category").map(xmlNodeAttr)
    const links = xmlArray(e, "link").map(xmlNodeAttr)
    const author = e.author?.name
    const { "#text": text = "", "@_type": type = "" } = e.summary ?? {}
    return {
      categories: category,
      links,
      id: e.id,
      author,
      title: e.title,
      updated: parseJsonDate(e.updated),
      text: text,
      type,
    }
  })
  return { href, title, updated: parseJsonDate(updated), dumps }
}

/**
 * List ABAP runtime dumps (ST22).
 * @param query plain URL query string, e.g. "maxNumber=5&from=20260901120000"
 */
export async function dumps(
  h: AdtHTTP,
  query: string = ""
): Promise<DumpsFeed> {
  const headers = { Accept: "application/atom+xml;type=feed" }
  const qs: Record<string, string> = {}
  for (const pair of query.replace(/^\?/, "").split("&")) {
    if (!pair) continue
    const eq = pair.indexOf("=")
    if (eq < 0) qs[decodeURIComponent(pair)] = ""
    else
      qs[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(
        pair.slice(eq + 1)
      )
  }
  const response = await h.request("/sap/bc/adt/runtime/dumps", {
    method: "GET",
    qs,
    headers,
  })
  return parseDumps(response.body)
}
