// Local analyzer for tracked flights. Reads every KML under a folder, finds both airports of each flight, and prints what
// the flight did at each end. Stores nothing. Run with `pnpm analyze:procedures "<folder>"`.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { airportFor, analyzeFlight, flightEnds } from "@/lib/procedure-analysis"
import { compassPoint } from "@/lib/runway-guide"

function kmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    if (n.startsWith(".")) return []
    const full = join(dir, n)
    return statSync(full).isDirectory() ? kmlFiles(full) : /\.kml$/i.test(n) ? [full] : []
  })
}

const root = process.argv[2]
if (!root) throw new Error('usage: analyze-procedures "<folder>"')
for (const file of kmlFiles(root)) {
  const kml = readFileSync(file, "utf8")
  const { origin, destination } = flightEnds(kml)
  console.log(`\n${file.split("/").pop()}  ${origin ?? "?"} -> ${destination ?? "?"}`)
  for (const code of new Set([origin, destination])) {
    const airport = code ? airportFor(code) : null
    if (!code || !airport) continue
    const r = analyzeFlight(file, kml, airport)
    const way = r.bearing === null ? "?" : `${r.bearing} deg ${compassPoint(r.bearing)}`
    const prof = r.kind === "arrival" ? ` | on final from ${r.establishedNm ?? "?"} NM | altitude at 20/10 NM ${r.altAt[20] ?? "-"}/${r.altAt[10] ?? "-"} ft` : ""
    console.log(`  ${code} ${r.kind} rwy ${r.runway ?? "?"} | ${r.kind === "arrival" ? "enters 40 NM from" : "leaves toward"} ${way} | ${r.kind === "arrival" ? "top of descent" : "top of climb"} ${r.turnNm ?? "?"} NM${prof}`)
    if (r.flags.length) console.log(`    flags: ${r.flags.join("; ")}`)
  }
}
