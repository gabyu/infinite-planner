"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { TrimAirport } from "@/lib/ground-trim"
import { OCTANTS, octantOf } from "@/lib/procedure-coverage"
import { runwayEnds } from "@/lib/runway-guide"
import { cn } from "@/lib/utils"
import { useImportDraft, type PendingRow } from "@/components/admin/procedures/import-draft"

// The review of an import, before anything is saved: every procedure the files hold (a flight gives a departure at its origin and an
// arrival at its destination), drawn on the map, with the runway and the direction the admin can correct for each one.
const selectClass = "h-7 rounded-md border border-input bg-background px-1.5 text-xs"

const runwayCache = new Map<string, string[]>()
async function runwaysOf(icao: string): Promise<string[]> {
  const cached = runwayCache.get(icao)
  if (cached) return cached
  try {
    const response = await fetch(`/api/airports/${icao}/runways`)
    const list = response.ok ? Array.from(new Set(runwayEnds((await response.json()) as TrimAirport).map((end) => end.name))).sort() : []
    runwayCache.set(icao, list)
    return list
  } catch {
    return []
  }
}

export function ImportReview() {
  const router = useRouter()
  const { pending, setPending, setHoverId } = useImportDraft()
  const [runways, setRunways] = useState<Record<string, string[]>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const airports = Array.from(new Set(pending.map((row) => row.airport))).join(",")
  useEffect(() => {
    let cancelled = false
    for (const icao of airports.split(",").filter(Boolean)) {
      void runwaysOf(icao).then((list) => !cancelled && setRunways((current) => (current[icao] ? current : { ...current, [icao]: list })))
    }
    return () => {
      cancelled = true
    }
  }, [airports])

  if (pending.length === 0) return null

  const patch = (id: string, change: Partial<PendingRow>) => setPending((current) => current.map((row) => (row.id === id ? { ...row, ...change } : row)))
  const placeable = (row: PendingRow) => row.kind !== "unknown" && row.status !== "added"
  const chosen = pending.filter((row) => placeable(row) && row.include)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const rows = chosen.map(({ id: _id, file: _file, include: _include, status: _status, ...row }) => ({ ...row, needs_check: row.runway === null }))
      const response = await fetch("/api/admin/procedures/commit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) })
      const body = (await response.json().catch(() => null)) as { results?: { content_hash: string; airport: string; added: boolean; error?: string }[]; error?: string } | null
      if (!response.ok || !body?.results) return setError(body?.error ?? "Couldn't save the procedures.")
      const byKey = new Map(body.results.map((r) => [`${r.airport}|${r.content_hash}`, r]))
      setPending((current) =>
        current.map((row) => {
          const result = byKey.get(`${row.airport}|${row.content_hash}`)
          if (!result || !row.include) return row
          return { ...row, status: result.added ? "added" : result.error?.includes("Already") ? "duplicate" : "error" }
        }),
      )
      router.refresh()
    } catch {
      setError("Couldn't save the procedures.")
    } finally {
      setSaving(false)
    }
  }

  const allDone = pending.every((row) => !placeable(row) || !row.include || row.status === "added" || row.status === "duplicate")

  return (
    <div className="mt-4 rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <p className="text-sm font-medium">
          New procedures <span className="font-normal text-muted-foreground">({pending.length}) · shown in teal on the map</span>
        </p>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setPending([])} disabled={saving}>
            {allDone ? "Close" : "Cancel"}
          </Button>
          {!allDone && (
            <Button size="sm" className="h-7 px-3 text-xs" onClick={save} disabled={saving || chosen.length === 0}>
              {saving && <Loader2 className="animate-spin" />}
              Import {chosen.length}
            </Button>
          )}
        </div>
      </div>
      {error && <p className="px-3 pt-2 text-sm text-destructive">{error}</p>}
      <ul className="divide-y">
        {pending.map((row) => {
          const options = runways[row.airport] ?? []
          const list = row.runway && !options.includes(row.runway) ? [row.runway, ...options] : options
          const direction = row.bearing === null ? "" : octantOf(row.bearing)
          const placed = row.kind !== "unknown"
          return (
            <li
              key={row.id}
              onMouseEnter={() => setHoverId(row.id)}
              onMouseLeave={() => setHoverId(null)}
              className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs", (!placed || !row.include) && "opacity-60")}
            >
              <input
                type="checkbox"
                aria-label={`Include ${row.route} ${row.kind}`}
                checked={row.include && placed && row.status !== "added"}
                disabled={!placed || row.status === "added" || saving}
                onChange={(event) => patch(row.id, { include: event.target.checked })}
              />
              <span className="w-[4.5rem] shrink-0">
                <span className="font-mono font-medium">{row.airport}</span>{" "}
                <span className="text-muted-foreground">{row.kind === "arrival" ? "arr" : row.kind === "departure" ? "dep" : "n/a"}</span>
              </span>
              <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground" title={row.file}>
                {row.route}
              </span>
              {placed ? (
                <>
                  <label className="flex items-center gap-1">
                    <span className="text-muted-foreground">Runway</span>
                    <select
                      className={cn(selectClass, !row.runway && "border-amber-500")}
                      value={row.runway ?? ""}
                      disabled={row.status === "added" || saving}
                      onChange={(event) => patch(row.id, { runway: event.target.value || null })}
                    >
                      <option value="">Choose</option>
                      {list.map((runway) => (
                        <option key={runway} value={runway}>
                          {runway}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1">
                    <span className="text-muted-foreground">{row.kind === "arrival" ? "From" : "To"}</span>
                    <select
                      className={selectClass}
                      value={direction}
                      disabled={row.status === "added" || saving}
                      // Picking a direction sets the bearing to the middle of it; leaving it alone keeps the measured one.
                      onChange={(event) => patch(row.id, { bearing: event.target.value ? OCTANTS.indexOf(event.target.value as (typeof OCTANTS)[number]) * 45 : null })}
                    >
                      {direction === "" && <option value="">Choose</option>}
                      {OCTANTS.map((octant) => (
                        <option key={octant} value={octant}>
                          {octant}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <span className="text-muted-foreground">Not on the ground here: left out.</span>
              )}
              {row.status && (
                <span className={cn("text-[11px]", row.status === "added" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                  {row.status === "added" ? "Added" : row.status === "duplicate" ? "Already there" : "Not saved"}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
