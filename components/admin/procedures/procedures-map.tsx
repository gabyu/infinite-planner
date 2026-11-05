"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { useTheme } from "next-themes"
import { resolveBasemap, setBasemap } from "@/lib/map-tiles"
import { altitudeBucket } from "@/lib/route-render"
import type { FlightAnalysis, FlightGroup } from "@/lib/procedure-analysis"
import { isRunwayFlag } from "@/lib/procedure-flags"

// Every analysed flight of an airport drawn on a map, coloured by its group, with the runway, direction and profile of each.
// Read-only apart from removing a flight; merging groups and consensus paths come later.
// Group colours: the site's blue at its own saturation and lightness (hsl 221 83% 53% in light, 217 91% 60% in dark),
// one hue per group, kept in the cyan-to-magenta band of the altitude ramp. Same intensity and contrast for every group,
// so nothing on the map shouts louder than the brand blue.
const HUES = [221, 190, 255, 285, 315, 165, 345, 205, 238, 300]
const groupColor = (index: number, dark: boolean) => `hsl(${HUES[index % HUES.length]} ${dark ? 91 : 83}% ${dark ? 60 : 53}%)`

interface Props {
  icao: string
  center: [number, number]
  runways: { name: string; from: [number, number]; to: [number, number] }[]
  flights: FlightAnalysis[]
  arrivalGroups: FlightGroup[]
  departureGroups: FlightGroup[]
  /** A procedure a member saved, shown on its own over the flights (the admin's Preview button). Points in feet. */
  preview?: { id: string; label: string; points: { lat: number; lng: number; altitude: number }[] } | null
  /** Page content above and below the flight groups, in the left column beside the map. */
  before?: ReactNode
  after?: ReactNode
}

// One procedure drawn over the flights, like the route in the plan editor: a fine line coloured by altitude (cyan to violet), with a
// small dot and a tooltip (number and altitude) at each point. Replaces the previous one.
function drawPreview(L: any, map: any, preview: Props["preview"], _dark: boolean, layer: { current: any }) {
  layer.current?.remove()
  layer.current = null
  if (!preview || preview.points.length < 2) return
  const group = L.featureGroup()
  for (let i = 1; i < preview.points.length; i++) {
    const a = preview.points[i - 1]
    const b = preview.points[i]
    L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { className: `alt-${altitudeBucket((a.altitude + b.altitude) / 2)}`, weight: 2.5, interactive: false }).addTo(group)
  }
  preview.points.forEach((p, i) => {
    L.circleMarker([p.lat, p.lng], { radius: 3, className: `alt-${altitudeBucket(p.altitude)}`, weight: 1.5, fillOpacity: 1, fillColor: "#fff" })
      .bindTooltip(`${i + 1} · ${Math.round(p.altitude).toLocaleString("en-US")} ft · ${preview.label}`)
      .addTo(group)
  })
  group.addTo(map)
  layer.current = group
  map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 11 })
}

export function ProceduresMap({ icao, center, runways, flights, arrivalGroups, departureGroups, preview = null, before, after }: Props) {
  const mapEl = useRef<HTMLDivElement>(null)
  const layers = useRef<Map<string, any>>(new Map())
  const previewLayer = useRef<any>(null)
  const previewRef = useRef(preview)
  previewRef.current = preview
  const isolated = preview !== null
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [runwayFilter, setRunwayFilter] = useState<string>("all")
  const [hover, setHover] = useState<string | null>(null)
  const router = useRouter()
  const [shownKinds, setShownKinds] = useState({ arrival: true, departure: true })
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme === "dark"

  const groups = useMemo(() => [...arrivalGroups, ...departureGroups], [arrivalGroups, departureGroups])
  const groupOf = useMemo(() => {
    const map = new Map<string, { group: FlightGroup; color: string }>()
    groups.forEach((g, i) => g.members.forEach((m) => map.set(m, { group: g, color: groupColor(i, dark) })))
    return map
  }, [groups, dark])

  useEffect(() => {
    let map: any
    let cancelled = false
    ;(async () => {
      // @ts-ignore leaflet ships no types in this project
      const L = (await import("leaflet")).default
      // @ts-ignore
      await import("leaflet/dist/leaflet.css")
      if (cancelled || !mapEl.current) return
      map = L.map(mapEl.current, { zoomControl: true }).setView(center, 9)
      setBasemap(L as any, map, resolveBasemap("auto", dark) === "dark")
      runways.forEach((r) => L.polyline([r.from, r.to], { color: dark ? "#e2e8f0" : "#0f172a", weight: 5 }).addTo(map))
      L.circleMarker(center, { radius: 4, color: dark ? "#e2e8f0" : "#0f172a", fillColor: dark ? "#0f172a" : "#fff", fillOpacity: 1 }).addTo(map).bindTooltip(icao, { permanent: true, direction: "top" })
      flights.forEach((f) => {
        if (f.track.length < 2) return
        const info = groupOf.get(f.file)
        const line = L.polyline(f.track.map((p) => [p[0], p[1]]) as [number, number][], {
          color: info?.color ?? (dark ? "#94a3b8" : "#64748b"),
          weight: 2.5,
          opacity: 0.85,
          dashArray: f.kind === "departure" ? "6 5" : undefined,
        }).addTo(map)
        line.bindTooltip(`${f.route ?? f.file} · ${f.kind} ${f.runway ?? "?"}`)
        layers.current.set(f.file, line)
      })
      const all = flights.flatMap((f) => f.track.map((p) => [p[0], p[1]] as [number, number]))
      if (all.length) map.fitBounds(all, { padding: [30, 30] })
      ;(window as any).__procMap = map
      drawPreview(L, map, previewRef.current, dark, previewLayer)
    })()
    return () => {
      cancelled = true
      layers.current.clear()
      previewLayer.current = null
      map?.remove()
    }
  }, [center, dark, flights, groupOf, icao, runways])

  // The previewed procedure changes without rebuilding the map.
  const previewId = preview?.id ?? null
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // @ts-ignore leaflet ships no types in this project
      const L = (await import("leaflet")).default
      const map = (window as any).__procMap
      if (cancelled || !map) return
      drawPreview(L, map, previewRef.current, dark, previewLayer)
    })()
    return () => {
      cancelled = true
    }
  }, [previewId, dark])

  useEffect(() => {
    flights.forEach((f) => {
      const layer = layers.current.get(f.file)
      if (!layer) return
      const group = groupOf.get(f.file)?.group.id
      const kindShown = f.kind === "arrival" ? shownKinds.arrival : f.kind === "departure" ? shownKinds.departure : true
      const show = !isolated && kindShown && !(group && hidden.has(group)) && (runwayFilter === "all" || f.runway === runwayFilter)
      const map = layer._map ?? (window as any).__procMap
      if (show && !layer._map && map) layer.addTo(map)
      if (!show && layer._map) layer.remove()
      layer.setStyle?.({ weight: 2.5, opacity: hover && hover !== f.file ? 0.3 : hover === f.file ? 1 : 0.85 })
    })
  }, [hidden, runwayFilter, hover, flights, groupOf, shownKinds, dark, isolated])

  async function removeFlight(id: string, label: string) {
    if (!window.confirm(`Remove ${label} from ${icao}?`)) return
    // A member's procedure ("guide:<id>") is deleted through its own action; a flight file through the other.
    const body = id.startsWith("guide:") ? { action: "deleteGuide", id: id.slice(6) } : { action: "delete", id }
    await fetch("/api/admin/procedures", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    router.refresh()
  }

  // One member's procedure shown alone (the Preview button): every other line is hidden until "Show all".
  function showAll() {
    router.replace(`/admin-dashboard/procedures?airport=${icao}`, { scroll: false })
  }

  const runwayNames = Array.from(new Set(flights.map((f) => f.runway).filter(Boolean))) as string[]
  const toggle = (id: string) => setHidden((h) => { const n = new Set(h); n.has(id) ? n.delete(id) : n.add(id); return n })

  const groupBlock = (title: string, list: FlightGroup[]) =>
    list.length > 0 && (
      <div className="mb-4">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {list.map((g) => {
          const color = groupColor(groups.indexOf(g), dark)
          const members = flights.filter((f) => g.members.includes(f.file))
          const toNm = members.map((m) => m.turnNm).filter((v): v is number => v !== null).sort((a, b) => a - b)
          const median = toNm.length ? toNm[Math.floor(toNm.length / 2)] : null
          return (
            <div key={g.id} className="mb-2 rounded-md border bg-card p-2 text-sm">
              <label className="flex cursor-pointer items-center gap-2 font-medium">
                <input type="checkbox" checked={!hidden.has(g.id)} onChange={() => toggle(g.id)} />
                <span className="inline-block h-3 w-3 rounded-sm" style={{ background: color }} />
                {g.label} · {g.bearing}° · {members.length} flight{members.length > 1 ? "s" : ""}
              </label>
              <div className="mt-1 text-xs text-muted-foreground">
                {g.kind === "arrival" ? "top of descent" : "top of climb"} median {median ?? "?"} NM
              </div>
              <ul className="mt-1 space-y-0.5 text-xs">
                {members.map((m) => (
                  <li key={m.file} onMouseEnter={() => setHover(m.file)} onMouseLeave={() => setHover(null)} className="flex justify-between gap-2">
                    <span className="truncate" title={m.file}>{m.route ?? m.file.replace(/\.kml$/i, "")}</span>
                    <span className="flex shrink-0 items-center gap-2 tabular-nums">
                      <span>
                        rwy {m.runway ?? "?"}
                        {m.kind === "arrival" && m.establishedNm !== null ? ` · final ${m.establishedNm} NM` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFlight(m.file, m.route ?? "this flight")}
                        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                        title="Remove this flight from this airport"
                      >
                        <Trash2 className="h-3 w-3" aria-hidden />
                        <span className="sr-only">Remove {m.route ?? "flight"}</span>
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              {members.some((m) => m.flags.some((f) => !isRunwayFlag(f))) && (
                <div className="mt-1 text-xs text-amber-600">{members.flatMap((m) => m.flags).filter((f) => !isRunwayFlag(f)).join("; ")}</div>
              )}
            </div>
          )
        })}
      </div>
    )

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,640px)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-6 xl:order-1">
        {before}
        <section aria-label="Flights on the map" className="rounded-lg border bg-card p-4">
          <div className="mb-3 space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1" role="group" aria-label="Show on the map">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={shownKinds.arrival} onChange={(e) => setShownKinds((k) => ({ ...k, arrival: e.target.checked }))} />
                <svg width="24" height="6" aria-hidden><line x1="0" y1="3" x2="24" y2="3" stroke="currentColor" strokeWidth="2.5" /></svg>
                Arrivals <span className="text-muted-foreground">{flights.filter((f) => f.kind === "arrival").length}</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={shownKinds.departure} onChange={(e) => setShownKinds((k) => ({ ...k, departure: e.target.checked }))} />
                <svg width="24" height="6" aria-hidden><line x1="0" y1="3" x2="24" y2="3" stroke="currentColor" strokeWidth="2.5" strokeDasharray="6 5" /></svg>
                Departures <span className="text-muted-foreground">{flights.filter((f) => f.kind === "departure").length}</span>
              </label>
              <div className="ml-auto flex items-center gap-2">
                <span>Runway</span>
                <select className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={runwayFilter} onChange={(e) => setRunwayFilter(e.target.value)}>
                  <option value="all">All</option>
                  {runwayNames.sort().map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
          </div>
          {isolated && (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
              <span>Showing one procedure on the map.</span>
              <button type="button" onClick={showAll} className="rounded-md px-2 py-1 text-xs font-medium hover:bg-accent">
                Show all
              </button>
            </div>
          )}
          {arrivalGroups.length + departureGroups.length === 0 && <p className="text-sm text-muted-foreground">No flights or procedures for this airport yet.</p>}
          {groupBlock("Approaches", arrivalGroups)}
          {groupBlock("Departures", departureGroups)}
        </section>
        {after}
      </div>
      <div className="order-first xl:order-2 xl:sticky xl:top-4">
        <div id="procedures-map" ref={mapEl} className="h-[45vh] min-h-[320px] w-full overflow-hidden rounded-lg border xl:h-[calc(100vh-2rem)]" />
      </div>
    </div>
  )
}
