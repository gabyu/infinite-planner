import { DOMParser } from "xmldom"
import { getAirportInfo } from "@/lib/airports"
import { parseKML } from "@/lib/kml-parser"

// AeroHub Radar KML (format fixed by the partner): KML 2.2, UTF-8.
//   Document/ExtendedData/Data[@name]  departure, arrival, flightNumber, callsign, flightUrl
//   Placemark "Route"                  LineString, "lon,lat,alt" (altitude in metres, 0 when unknown)
//   Folder "Waypoints"                 one Placemark per point, same order as the LineString
// The geometry then goes through the same parseKML as FlightRadar24 and FlightAware (dedupe, 250 cap, numbering).

export type AeroHubError = "invalid_kml" | "invalid_airports"

export interface AeroHubMeta {
  departure: string
  arrival: string
  /** Called "flightNumber" in the file, but it is an AeroHub ID, not an official flight number. Never shown as one. */
  aerohubId: string | null
  callsign: string | null
  /** Only set when it passed validation (https and a host from the partner's flightUrlHosts). */
  flightUrl: string | null
}

type Parsed = ReturnType<typeof parseKML>

export type AeroHubResult =
  | {
      ok: true
      meta: AeroHubMeta
      /** Points in the file's Route LineString, before anything is dropped. */
      rawPointCount: number
      /** Planner-only markers (TOC, TOD) left out of the route. */
      droppedMarkers: number
      route: Parsed
    }
  | { ok: false; code: AeroHubError; detail?: string }

// Top of climb / top of descent are computed markers, not places a pilot can fly to. Runway points (RW21, RW09L,
// "DPT RW21") are real positions on the ground track and stay: the editor detects the runways from the route itself.
const MARKER_NAMES = new Set(["TOC", "TOD"])

const MAX_FIELD = 120
const ICAO = /^[A-Z]{4}$/

export function parseAeroHubKml(xml: string, flightUrlHosts: readonly string[]): AeroHubResult {
  // No DTD, no entities: nothing in this format needs them, and refusing them closes the XXE door.
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) return { ok: false, code: "invalid_kml", detail: "doctype" }

  let doc: Document
  try {
    doc = new DOMParser({
      errorHandler: {
        warning: () => {},
        error: () => {
          throw new Error("xml")
        },
        fatalError: () => {
          throw new Error("xml")
        },
      },
    }).parseFromString(xml, "text/xml") as unknown as Document
  } catch {
    return { ok: false, code: "invalid_kml", detail: "xml" }
  }

  const root = doc.documentElement
  if (!root || root.nodeName !== "kml") return { ok: false, code: "invalid_kml", detail: "root" }
  const document = child(root, "Document")
  if (!document) return { ok: false, code: "invalid_kml", detail: "document" }

  // Metadata
  const data: Record<string, string> = {}
  const extended = child(document, "ExtendedData")
  for (const node of extended ? children(extended, "Data") : []) {
    const name = node.getAttribute("name")
    const value = child(node, "value")?.textContent?.trim()
    if (name && value) data[name] = value.slice(0, MAX_FIELD)
  }

  const departure = (data.departure ?? "").toUpperCase()
  const arrival = (data.arrival ?? "").toUpperCase()
  if (!ICAO.test(departure) || !ICAO.test(arrival) || !getAirportInfo(departure) || !getAirportInfo(arrival)) {
    return { ok: false, code: "invalid_airports" }
  }

  // Route
  const routePlacemark = children(document, "Placemark").find((p) => child(p, "name")?.textContent?.trim() === "Route")
  const lineCoords = routePlacemark && child(child(routePlacemark, "LineString"), "coordinates")?.textContent
  const route = lineCoords ? parseCoordinates(lineCoords) : null
  if (!route || route.length < 2) return { ok: false, code: "invalid_kml", detail: "route" }

  // Point names, only usable when they line up one to one with the route.
  const folder = children(document, "Folder").find((f) => child(f, "name")?.textContent?.trim() === "Waypoints")
  const names = folder
    ? children(folder, "Placemark").map((p) => child(p, "name")?.textContent?.trim().toUpperCase() ?? "")
    : []
  const aligned = names.length === route.length

  const kept: string[] = []
  let dropped = 0
  route.forEach((point, index) => {
    if (aligned && MARKER_NAMES.has(names[index])) {
      dropped++
      return
    }
    kept.push(`${point.lng},${point.lat},${point.alt}`)
  })

  const synthetic = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><LineString><coordinates>${kept.join(" ")}</coordinates></LineString></Placemark></Document></kml>`
  const parsed = parseKML(synthetic) // no file name: nothing is added to the public flight statistics
  if (parsed.waypoints.length < 2) return { ok: false, code: "invalid_kml", detail: "route" }

  return {
    ok: true,
    meta: {
      departure,
      arrival,
      aerohubId: data.flightNumber ?? null,
      callsign: data.callsign ?? null,
      flightUrl: safeFlightUrl(data.flightUrl, flightUrlHosts),
    },
    rawPointCount: route.length,
    droppedMarkers: dropped,
    route: { ...parsed, source: "AeroHub" },
  }
}

function safeFlightUrl(raw: string | undefined, hosts: readonly string[]): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null
    return hosts.includes(url.hostname) ? url.toString() : null
  } catch {
    return null
  }
}

function parseCoordinates(text: string): { lng: number; lat: number; alt: number }[] | null {
  const points: { lng: number; lat: number; alt: number }[] = []
  for (const token of text.trim().split(/\s+/)) {
    if (!token) continue
    const parts = token.split(",")
    const lng = Number.parseFloat(parts[0])
    const lat = Number.parseFloat(parts[1])
    const alt = Number.parseFloat(parts[2] ?? "0")
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
    points.push({ lng, lat, alt: Number.isFinite(alt) ? alt : 0 })
  }
  return points
}

// Direct children only, so a Placemark nested elsewhere never stands in for the one the format defines.
function children(parent: Element | null | undefined, tag: string): Element[] {
  const out: Element[] = []
  if (!parent) return out
  for (let node = parent.firstChild; node; node = node.nextSibling) {
    if (node.nodeType === 1 && (node as Element).nodeName === tag) out.push(node as Element)
  }
  return out
}
function child(parent: Element | null | undefined, tag: string): Element | null {
  return children(parent, tag)[0] ?? null
}
