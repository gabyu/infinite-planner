"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, Plus, Upload } from "lucide-react"
import { doneKey, OCTANTS, type Coverage, type CoverageKind, type KindProgress } from "@/lib/procedure-coverage"

// What an airport has and what it still lacks, with the progress, and a way to add a flight file. Each cell is one
// direction on one runway: a number is how many flights fill it, "+" is a gap, "n/a" a direction marked not needed.
interface Props {
  icao: string
  airportName: string
  coverage: Coverage
}

interface UploadResult {
  ok: boolean
  original: string
  error?: string
  name?: string
  placed?: { airport: string; kind: string; runway: string | null; bearing: number | null }[]
  checks?: string[]
}

// Files from a drop, folders included: a dropped folder is walked and every .kml in it is taken.
async function filesFromDrop(items: DataTransferItemList): Promise<File[]> {
  const out: File[] = []
  const walk = async (entry: any): Promise<void> => {
    if (entry.isFile) {
      const file: File = await new Promise((resolve, reject) => entry.file(resolve, reject))
      out.push(file)
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

const BATCH = 5

export function CoveragePanel({ icao, airportName, coverage }: Props) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [marking, setMarking] = useState(false)
  const [results, setResults] = useState<UploadResult[]>([])
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  // Any number of files: sent in batches of five so a big series shows progress and one bad file never stops the rest.
  async function upload(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => /\.kml$/i.test(f.name))
    if (list.length === 0) {
      setResults([{ ok: false, original: "", error: "Only .kml files." }])
      return
    }
    setBusy(true)
    setResults([])
    setProgress({ done: 0, total: list.length })
    const all: UploadResult[] = []
    for (let i = 0; i < list.length; i += BATCH) {
      const slice = list.slice(i, i + BATCH)
      const form = new FormData()
      slice.forEach((f) => form.append("file", f))
      try {
        const response = await fetch("/api/dev/procedures/upload", { method: "POST", body: form })
        const body = (await response.json()) as { results?: UploadResult[]; error?: string }
        all.push(...(body.results ?? slice.map((f) => ({ ok: false, original: f.name, error: body.error ?? "Upload failed." }))))
      } catch {
        all.push(...slice.map((f) => ({ ok: false, original: f.name, error: "Upload failed." })))
      }
      setProgress({ done: Math.min(i + BATCH, list.length), total: list.length })
      setResults([...all])
    }
    router.refresh()
    setBusy(false)
    setProgress(null)
    if (input.current) input.current.value = ""
  }

  async function mark(key: string, notNeeded: boolean) {
    await fetch("/api/dev/procedures/mark", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ airport: icao, key, notNeeded }) })
    router.refresh()
  }

  const gaps = coverage.needed - coverage.covered

  return (
    <section className="mb-6 rounded border p-4" aria-label={`${icao} coverage`}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {icao} <span className="font-normal text-muted-foreground">{airportName}</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            {coverage.covered} of {coverage.needed} directions covered{gaps > 0 ? ` · ${gaps} missing` : ""}
          </p>
        </div>
        <div className="text-3xl font-semibold tabular-nums">{coverage.percent}%</div>
      </div>
      <div className="mb-4 h-2 overflow-hidden rounded bg-muted" role="progressbar" aria-valuenow={coverage.percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-green-600 transition-all" style={{ width: `${coverage.percent}%` }} />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {(["arrival", "departure"] as CoverageKind[]).map((kind) => {
          const k: KindProgress = coverage[kind]
          return (
            <div key={kind} className="rounded border p-3">
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="font-medium">{kind === "arrival" ? "Arrivals" : "Departures"}</span>
                <span className="tabular-nums text-muted-foreground">
                  {k.done ? "Done" : `${k.covered} of ${k.needed}`} · {k.percent}%
                </span>
              </div>
              <div className="mb-2 h-1.5 overflow-hidden rounded bg-muted">
                <div className={`h-full transition-all ${k.done ? "bg-green-600" : "bg-blue-500"}`} style={{ width: `${k.percent}%` }} />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={k.done} onChange={(e) => mark(doneKey(kind), e.target.checked)} />
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
                <th key={o} className="font-medium">{o}</th>
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
                  const base = "h-9 w-full rounded border text-xs"
                  if (have > 0)
                    return (
                      <td key={cell.key}>
                        <div className={`${base} flex items-center justify-center gap-1 border-green-600/40 bg-green-600/15 font-medium`} title={cell.flights.join("\n")}>
                          <Check className="h-3 w-3" /> {have}
                        </div>
                      </td>
                    )
                  if (cell.notNeeded)
                    return (
                      <td key={cell.key}>
                        <button type="button" onClick={() => marking && mark(cell.key, false)} className={`${base} border-transparent bg-muted/40 text-muted-foreground`} title={marking ? "Needed again" : "Marked not needed"}>
                          n/a
                        </button>
                      </td>
                    )
                  return (
                    <td key={cell.key}>
                      <button
                        type="button"
                        onClick={() => (marking ? mark(cell.key, true) : input.current?.click())}
                        className={`${base} flex items-center justify-center border-dashed hover:bg-muted ${marking ? "border-amber-500" : ""}`}
                        title={marking ? "Mark not needed" : `Missing: ${row.kind} ${row.family} from ${cell.octant}. Add a file.`}
                      >
                        <Plus className="h-3 w-3 opacity-60" />
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
        Arrival: where the flight came in from at 40 NM. Departure: where it was heading at the top of climb. Parallel runways (08L, 08R) count as one.
      </p>

      <div
        className={`mt-4 flex flex-wrap items-center gap-3 rounded border border-dashed p-3 ${dragging ? "bg-muted" : ""}`}
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
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {progress ? `Adding ${progress.done} of ${progress.total}…` : "Add flight files"}
        </button>
        <span className="text-sm text-muted-foreground">Select as many .kml files as you like (Cmd or Shift-click), or drop files or a whole folder here. A flight fills both of its airports.</span>
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={marking} onChange={(e) => setMarking(e.target.checked)} /> Mark directions not needed
        </label>
      </div>

      {results.length > 0 && (
        <p className="mt-3 text-sm font-medium">
          {results.filter((r) => r.ok).length} added
          {results.some((r) => !r.ok) ? `, ${results.filter((r) => !r.ok).length} not added` : ""}
        </p>
      )}
      {results.length > 0 && (
        <ul className="mt-1 max-h-60 space-y-1 overflow-y-auto text-sm">
          {results.map((r, i) => (
            <li key={i} className={r.ok ? "" : "text-red-600"}>
              {r.ok ? (
                <>
                  <span className="font-medium">{r.name}</span>
                  {" · "}
                  {r.placed?.map((p) => `${p.airport} ${p.kind} ${p.runway ?? "XX"}`).join(" · ")}
                  {r.checks && r.checks.length > 0 && <span className="text-amber-600"> · {r.checks.join("; ")}</span>}
                </>
              ) : (
                <>
                  {r.original && <span className="font-medium">{r.original}: </span>}
                  {r.error}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {coverage.unplaced.length > 0 && (
        <div className="mt-3 text-sm text-amber-600">Not placed in the grid:
          {coverage.unplaced.map((u) => <span key={u} className="block">{u}</span>)}</div>
      )}
    </section>
  )
}
