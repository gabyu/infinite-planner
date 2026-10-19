"use client"

import { fplFileName, generateFPL } from "@/lib/fpl-generator"
import { FPL_CONTENT_TYPES, saveFplInBrowser, type FplVariant } from "@/lib/fpl-download"

const VARIANTS: { id: FplVariant; label: string }[] = [
  { id: "a", label: "A: application/x-fpl" },
  { id: "b", label: "B: application/octet-stream" },
  { id: "xml", label: "C: application/xml (control, current)" },
]

const SAMPLE = [
  { name: "EHAM", lat: 52.308601, lng: 4.763889, altitude: -11 },
  { name: "SUGOL", lat: 52.7, lng: 3.2, altitude: 15000 },
  { name: "EGLL", lat: 51.4775, lng: -0.461389, altitude: 83 },
]

const button = "rounded-full border border-border px-5 py-3 text-left text-sm font-medium"

export function FplTest() {
  return (
    <main className="mx-auto max-w-xl space-y-8 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">FPL download test</h1>
        <p className="text-sm text-muted-foreground">
          Turn on Show All Filename Extensions in the Files app first. After each download, note the exact name in Files and whether
          Infinite Flight opens it with its flight plan importer (no SimBrief message).
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Server download (dashboard and library routes)</h2>
        {VARIANTS.map(({ id, label }) => (
          <a key={id} className={`${button} block`} href={`/api/fpl-test?v=${id}`}>
            {label}
          </a>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">In-browser save (the editor's Export)</h2>
        {VARIANTS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`${button} block w-full`}
            onClick={() =>
              saveFplInBrowser(generateFPL(SAMPLE), fplFileName("EHAM", "EGLL").replace("Infinite Planner", `Blob ${id.toUpperCase()}`), FPL_CONTENT_TYPES[id])
            }
          >
            {label}
          </button>
        ))}
      </section>
    </main>
  )
}
