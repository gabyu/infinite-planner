"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, Plus, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { doneKey, OCTANTS, type Coverage, type CoverageKind, type KindProgress } from "@/lib/procedure-coverage"
import { ImportWizard, type PendingRow } from "@/components/admin/procedures/import-wizard"
import { cn } from "@/lib/utils"

// What an airport has and what it still lacks, its progress, and a way to add flight files. Each cell is one direction on one
// runway: a number is how many flights fill it, "+" is a gap, "n/a" a direction nobody flies.
interface Props {
  icao: string
  airportName: string
  coverage: Coverage
}

interface AnalyzeResult {
  ok: boolean
  original: string
  error?: string
  route?: string
  rows?: Omit<PendingRow, "id" | "file" | "include" | "status">[]
  checks?: string[]
}

// A request is limited to about 4.5 MB on Vercel: files go in batches of at most 8 files and 3.5 MB.
const BATCH_FILES = 8
const BATCH_BYTES = 3.5 * 1024 * 1024

// Files from a drop, folders included: a dropped folder is walked and every file in it is taken.
async function filesFromDrop(items: DataTransferItemList): Promise<File[]> {
  const out: File[] = []
  const walk = async (entry: any): Promise<void> => {
    if (entry.isFile) {
      out.push(await new Promise<File>((resolve, reject) => entry.file(resolve, reject)))
    } else if (entry.isDirectory) {
      const reader = entry.createReader()
      for (;;) {
        const batch: any[] = await new Promise((resolve, reject) => reader.readEntries(resolve, reject))
        if (batch.length === 0) break
        for (const child of batch) await walk(child)
      }
    }
  }
  const entries = Array.from(items).map((item) => item.webkitGetAsEntry?.()).filter(Boolean)
  for (const entry of entries) await walk(entry)
  return out
}

export function CoveragePanel({ icao, airportName, coverage }: Props) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  // The procedures read from the files, being reviewed one screen at a time (nothing is saved before the last screen).
  const [draft, setDraft] = useState<PendingRow[] | null>(null)
  // Files that could not be read.
  const [results, setResults] = useState<AnalyzeResult[]>([])
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  async function upload(files: FileList | File[]) {
    const kml = Array.from(files).filter((f) => /\.kml$/i.test(f.name))
    if (kml.length === 0) {
      setResults([{ ok: false, original: "", error: "Only .kml files." }])
      return
    }
    const tooLarge = kml.filter((f) => f.size > BATCH_BYTES)
    const list = kml.filter((f) => f.size <= BATCH_BYTES)
    const all: AnalyzeResult[] = tooLarge.map((f) => ({ ok: false, original: f.name, error: "The file is too large to upload (limit 3.5 MB)." }))
    setBusy(true)
    setResults(all)
    setProgress({ done: 0, total: kml.length })

    // Batches: up to 8 files and 3.5 MB each, so one bad file never stops the rest.
    const batches: File[][] = []
    let current: File[] = []
    let bytes = 0
    for (const file of list) {
      if (current.length >= BATCH_FILES || bytes + file.size > BATCH_BYTES) {
        batches.push(current)
        current = []
        bytes = 0
      }
      current.push(file)
      bytes += file.size
    }
    if (current.length > 0) batches.push(current)

    let done = tooLarge.length
    const collected: PendingRow[] = []
    for (const batch of batches) {
      const form = new FormData()
      batch.forEach((f) => form.append("file", f))
      try {
        const response = await fetch("/api/admin/procedures/analyze", { method: "POST", body: form })
        const body = (await response.json().catch(() => null)) as { results?: AnalyzeResult[]; error?: string } | null
        const got = body?.results ?? batch.map((f) => ({ ok: false, original: f.name, error: body?.error ?? "Upload failed." }))
        all.push(...got.filter((r) => !r.ok))
        // What each readable file holds goes to the review, not to the database: nothing is saved until the admin confirms.
        const fresh: PendingRow[] = got.flatMap((r, index) =>
          (r.ok ? r.rows ?? [] : []).map((row, n) => ({ ...row, id: `${Date.now()}-${done}-${index}-${n}`, file: r.original, include: row.kind !== "unknown" })),
        )
        collected.push(...fresh.filter((row) => !collected.some((c) => c.airport === row.airport && c.content_hash === row.content_hash)))
      } catch {
        all.push(...batch.map((f) => ({ ok: false, original: f.name, error: "Upload failed." })))
      }
      done += batch.length
      setProgress({ done, total: kml.length })
      setResults([...all])
    }
    setBusy(false)
    setProgress(null)
    if (input.current) input.current.value = ""
    if (collected.length > 0) setDraft(collected)
  }

  async function mark(key: string, on: boolean) {
    await fetch("/api/admin/procedures", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mark", airport: icao, key, on }) })
    router.refresh()
  }

  const gaps = coverage.needed - coverage.covered

  return (
    <section aria-label={`${icao} coverage`} className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">
            <span className="font-mono">{icao}</span> <span className="font-normal text-muted-foreground">{airportName}</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            {coverage.covered} of {coverage.needed} directions covered{gaps > 0 ? ` · ${gaps} missing` : ""}
          </p>
        </div>
        <div className="text-3xl font-semibold tabular-nums">{coverage.percent}%</div>
      </div>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Overall progress" aria-valuenow={coverage.percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${coverage.percent}%` }} />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {(["arrival", "departure"] as CoverageKind[]).map((kind) => {
          const k: KindProgress = coverage[kind]
          return (
            <div key={kind} className="rounded-md border p-3">
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="font-medium">{kind === "arrival" ? "Arrivals" : "Departures"}</span>
                <span className="tabular-nums text-muted-foreground">
                  {k.done ? "Done" : `${k.covered} of ${k.needed}`} · {k.percent}%
                </span>
              </div>
              <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full transition-all", k.done ? "bg-emerald-500" : "bg-primary")} style={{ width: `${k.percent}%` }} />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="accent-primary" checked={k.done} onChange={(e) => mark(doneKey(kind), e.target.checked)} />
                Mark {kind === "arrival" ? "arrivals" : "departures"} as done
              </label>
            </div>
          )
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-separate border-spacing-1 text-center text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="text-left font-medium" />
              {OCTANTS.map((o) => (
                <th key={o} className="font-medium">
                  {o}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {coverage.rows.map((row) => (
              <tr key={`${row.kind}${row.family}`}>
                <th className="whitespace-nowrap pr-2 text-left text-xs font-medium">
                  {row.kind === "arrival" ? "Arrival" : "Departure"} {row.family}
                </th>
                {row.cells.map((cell) => {
                  const have = cell.flights.length
                  const base = "flex h-8 w-full items-center justify-center rounded-md border text-xs"
                  if (have > 0)
                    return (
                      <td key={cell.key}>
                        <div className={cn(base, "gap-1 border-primary/40 bg-primary/15 font-medium")} title={`${have} flight${have > 1 ? "s" : ""}`}>
                          <Check className="h-3 w-3" aria-hidden /> {have}
                        </div>
                      </td>
                    )
                  if (cell.notNeeded)
                    // Empty directions of a kind marked "done" are n/a and only follow that mark. A single direction marked n/a
                    // before this was removed can still be clicked to count again.
                    return (
                      <td key={cell.key}>
                        {coverage[row.kind].done ? (
                          <div className={cn(base, "border-transparent bg-muted/50 text-muted-foreground")} title="Not needed">
                            n/a
                          </div>
                        ) : (
                          <button type="button" onClick={() => mark(cell.key, false)} className={cn(base, "border-transparent bg-muted/50 text-muted-foreground")} title="Not needed. Click to count it again">
                            n/a
                          </button>
                        )}
                      </td>
                    )
                  return (
                    <td key={cell.key}>
                      <button
                        type="button"
                        onClick={() => input.current?.click()}
                        className={cn(base, "border-dashed text-muted-foreground transition-colors hover:bg-accent")}
                        title={`Missing: ${row.kind} ${row.family} from ${cell.octant}. Add a file.`}
                      >
                        <Plus className="h-3 w-3" aria-hidden />
                        <span className="sr-only">Missing: {row.kind} {row.family} from {cell.octant}</span>
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Arrival: where the flight came in from at 40 NM. Departure: where it was heading at the top of climb.
      </p>

      <div
        className={cn("mt-4 flex flex-wrap items-center gap-3 rounded-md border border-dashed p-3 transition-colors", dragging && "bg-accent")}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void filesFromDrop(e.dataTransfer.items).then((files) => upload(files.length > 0 ? files : e.dataTransfer.files))
        }}
      >
        <input ref={input} type="file" accept=".kml" multiple hidden onChange={(e) => e.target.files && void upload(e.target.files)} />
        <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {progress ? `Reading ${progress.done} of ${progress.total}…` : "Import Flight Plans"}
        </Button>
      </div>

      {draft && <ImportWizard rows={draft} onClose={() => setDraft(null)} onSaved={() => router.refresh()} />}

      {results.length > 0 && (
        <div className="mt-3 text-sm" aria-live="polite">
          <p className="font-medium">{results.length} file{results.length === 1 ? "" : "s"} not read</p>
          <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto">
            {results.map((r, i) => (
              <li key={i} className="text-destructive">
                {r.original && <span className="font-medium">{r.original}: </span>}
                {r.error}
              </li>
            ))}
          </ul>
        </div>
      )}
      {coverage.unplaced.length > 0 && (
        <div className="mt-3 text-sm text-amber-600 dark:text-amber-400">
          Not placed in the grid:
          {coverage.unplaced.map((u) => (
            <span key={u} className="block">
              {u}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}
