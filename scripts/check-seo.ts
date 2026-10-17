// npm run check:seo: fails on a duplicate, missing or oversized title/description in the page registry.
import { checkRegistry } from "../lib/seo"

const problems = checkRegistry()
if (problems.length > 0) {
  console.error(problems.map((problem) => `- ${problem}`).join("\n"))
  process.exit(1)
}
console.log("SEO registry OK: every page has a unique title and description.")
