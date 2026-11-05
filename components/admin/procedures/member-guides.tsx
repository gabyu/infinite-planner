"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LocalTime } from "@/components/local-time"
import { guideLegText } from "@/lib/copy"
import type { MemberGuide } from "@/lib/procedures-db"
import { cn } from "@/lib/utils"

// The procedures members saved from their own plans (private to them: only admins see them here), newest first. Who saved it,
// when, the path drawn in the runway's frame, and a way to delete it. Deleting never touches the plans that used it.

// The path as seen from above in the runway's frame: the threshold is the dot, the runway points to the right.
function PathPreview({ points }: { points: [number, number, number][] }) {
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const minX = Math.min(...xs, 0)
  const maxX = Math.max(...xs, 0)
  const minY = Math.min(...ys, 0)
  const maxY = Math.max(...ys, 0)
  const span = Math.max(maxX - minX, maxY - minY, 1)
  const W = 80
  const H = 48
  const scale = Math.min((W - 8) / span, (H - 8) / span)
  const cx = (W - (maxX - minX) * scale) / 2 - minX * scale
  const cy = (H - (maxY - minY) * scale) / 2 - minY * scale
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${(cx + x * scale).toFixed(1)},${(cy + y * scale).toFixed(1)}`).join(" ")
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Path in the runway's frame" className="shrink-0 rounded border bg-muted/30">
      <line x1={cx + Math.min(minX, 0) * scale} y1={cy} x2={cx + Math.max(maxX, 0) * scale} y2={cy} stroke="currentColor" strokeOpacity="0.15" />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={cx} cy={cy} r="2.5" className="fill-primary" />
    </svg>
  )
}

export function MemberGuides({ guides, airport, previewId }: { guides: MemberGuide[]; airport: string | null; previewId: string | null }) {
  const router = useRouter()
  const [onlyAirport, setOnlyAirport] = useState(Boolean(airport))
  const [kind, setKind] = useState<"all" | "departure" | "arrival">("all")
  const [confirm, setConfirm] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const shown = guides.filter((g) => (!onlyAirport || !airport || g.airport === airport) && (kind === "all" || g.kind === kind))

  // Shows one procedure on the map, in the address so it survives a refresh: ?airport=LFPG&preview=<id>. Showing another replaces it.
  function preview(g: MemberGuide) {
    router.replace(`/admin-dashboard/procedures?airport=${g.airport}&preview=${g.id}`, { scroll: false })
    // On a narrow screen the map is above the list: bring it into view.
    window.setTimeout(() => document.getElementById("procedures-map")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 250)
  }

  async function remove(id: string) {
    if (confirm !== id) return setConfirm(id)
    setBusy(id)
    setError(null)
    const response = await fetch("/api/admin/procedures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteGuide", id }),
    }).catch(() => null)
    setBusy(null)
    setConfirm(null)
    if (!response?.ok) return setError("The procedure could not be deleted.")
    router.refresh()
  }

  const action = "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"

  return (
    <section aria-labelledby="member-guides" className="rounded-lg border bg-card">
      <div className="space-y-2 border-b p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="member-guides" className="text-sm font-semibold">
            Saved by members <span className="font-normal text-muted-foreground">({shown.length}{shown.length !== guides.length ? ` of ${guides.length}` : ""})</span>
          </h2>
          <div className="flex flex-wrap items-center gap-1 text-xs">
            {airport && (
              <Button size="sm" variant={onlyAirport ? "secondary" : "ghost"} className="h-7 px-2 text-xs" onClick={() => setOnlyAirport((v) => !v)}>
                {onlyAirport ? `${airport} only` : "All airports"}
              </Button>
            )}
            {(["all", "departure", "arrival"] as const).map((k) => (
              <Button key={k} size="sm" variant={kind === k ? "secondary" : "ghost"} onClick={() => setKind(k)} className="h-7 px-2 text-xs capitalize">
                {k === "all" ? "All kinds" : `${k}s`}
              </Button>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Procedures members saved from their own flight plans. They count in the airport list and the coverage grid. Each is private to its author; only admins see this list. Deleting one does not change the plans that used it.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      {shown.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No procedures saved by members{onlyAirport && airport ? ` for ${airport}` : ""} yet.</p>
      ) : (
        <ul className="divide-y">
          {shown.map((g) => (
            <li key={g.id} className={cn("flex items-center gap-3 px-4 py-3", previewId === g.id && "bg-accent/50")}>
              <PathPreview points={g.points} />
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="flex flex-wrap items-center gap-x-2 text-sm">
                  <span className="font-mono font-medium">{g.airport}</span>
                  <span className="rounded border bg-muted px-1.5 font-mono text-xs">{g.runway ?? "?"}</span>
                  <span className="text-xs capitalize text-muted-foreground">{g.kind}</span>
                  <span className="font-mono text-xs">{guideLegText(g.distanceNm, g.bearingDeg)}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{g.ownerName ?? "Unknown member"}</span> · <LocalTime iso={g.createdAt} />
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {g.points.length} points{g.useCount > 0 ? ` · used ${g.useCount} time${g.useCount === 1 ? "" : "s"}` : ""} · origin {g.originSources.join(", ") || "unknown"}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-start">
                <button
                  type="button"
                  disabled={!g.runway}
                  title={g.runway ? "Show on the map" : "No runway: it can't be placed on the map"}
                  onClick={() => preview(g)}
                  className={cn(action, previewId === g.id && "bg-accent text-foreground")}
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden />
                  Preview
                </button>
                <button
                  type="button"
                  disabled={busy === g.id}
                  onClick={() => remove(g.id)}
                  className={cn(action, "hover:bg-destructive/10 hover:text-destructive", confirm === g.id && "bg-destructive/10 text-destructive")}
                >
                  {busy === g.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Trash2 className="h-3.5 w-3.5" aria-hidden />}
                  {confirm === g.id ? "Delete for good?" : "Delete"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
