"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trash2 } from "lucide-react"
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
  const W = 96
  const H = 56
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

export function MemberGuides({ guides, airport }: { guides: MemberGuide[]; airport: string | null }) {
  const router = useRouter()
  const [onlyAirport, setOnlyAirport] = useState(Boolean(airport))
  const [kind, setKind] = useState<"all" | "departure" | "arrival">("all")
  const [confirm, setConfirm] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const shown = guides.filter((g) => (!onlyAirport || !airport || g.airport === airport) && (kind === "all" || g.kind === kind))

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

  return (
    <section aria-labelledby="member-guides" className="mt-8">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id="member-guides" className="text-sm font-semibold">
          Saved by members <span className="font-normal text-muted-foreground">({shown.length}{shown.length !== guides.length ? ` of ${guides.length}` : ""})</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {airport && (
            <Button size="sm" variant={onlyAirport ? "secondary" : "outline"} onClick={() => setOnlyAirport((v) => !v)}>
              {onlyAirport ? `${airport} only` : "All airports"}
            </Button>
          )}
          {(["all", "departure", "arrival"] as const).map((k) => (
            <Button key={k} size="sm" variant={kind === k ? "secondary" : "outline"} onClick={() => setKind(k)} className="capitalize">
              {k === "all" ? "All kinds" : `${k}s`}
            </Button>
          ))}
        </div>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">
        Procedures members saved from their own flight plans. Each is private to its author; only admins see this list. Deleting one does not change the plans that used it.
      </p>
      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
      {shown.length === 0 ? (
        <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">No procedures saved by members{onlyAirport && airport ? ` for ${airport}` : ""} yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {shown.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <PathPreview points={g.points} />
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="flex flex-wrap items-center gap-x-2 text-sm">
                  <span className="font-mono font-medium">{g.airport}</span>
                  <span className="rounded border bg-muted px-1.5 font-mono text-xs">{g.runway ?? "?"}</span>
                  <span className="text-xs capitalize text-muted-foreground">{g.kind}</span>
                  <span className="font-mono text-xs">{guideLegText(g.distanceNm, g.bearingDeg)}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  By <span className="font-medium text-foreground">{g.ownerName ?? "unknown member"}</span> · <LocalTime iso={g.createdAt} />
                  {g.useCount > 0 && ` · used ${g.useCount} time${g.useCount === 1 ? "" : "s"}`}
                  {g.points.length > 0 && ` · ${g.points.length} points`}
                </p>
                <p className="text-[11px] text-muted-foreground">Origin: {g.originSources.join(", ") || "unknown"}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy === g.id}
                onClick={() => remove(g.id)}
                className={cn("text-muted-foreground hover:bg-destructive/10 hover:text-destructive", confirm === g.id && "bg-destructive/10 text-destructive")}
              >
                {busy === g.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                {confirm === g.id ? "Delete for good?" : "Delete"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
