// Fails while any string in the copy catalog is still marked PROVISIONAL (waiting for Gabriel's approval).
// Run by hand with `pnpm check:copy`; the production build runs it too (see `prebuild`).
import { readFileSync } from "node:fs"

const file = new URL("../lib/copy.ts", import.meta.url)
const lines = readFileSync(file, "utf8").split("\n")
const pending = lines
  .map((text, index) => ({ text: text.trim(), line: index + 1 }))
  .filter(({ text }) => text.endsWith("// PROVISIONAL"))

if (pending.length > 0) {
  console.error(`lib/copy.ts: ${pending.length} string(s) still PROVISIONAL, not approved for production:`)
  for (const { line, text } of pending.slice(0, 15)) console.error(`  line ${line}: ${text}`)
  if (pending.length > 15) console.error(`  ... and ${pending.length - 15} more`)
  process.exit(1)
}
console.log("lib/copy.ts: no provisional strings.")
