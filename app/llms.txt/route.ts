import { BRAND_NAME, LIBRARY_PATH } from "@/lib/brand"
import { IS_STAGING } from "@/lib/site-url"
import { absoluteUrl, PAGES, pageTitle, SITE_TAGLINE } from "@/lib/seo"

// /llms.txt: the site in plain markdown for AI agents (llmstxt.org). Built from the same registry as the
// page metadata, so what agents read here can't drift from what the pages say.
export const dynamic = "force-static"

const FACTS = [
  "Infinite Flight is a mobile flight simulator; Infinite Planner is an independent community tool and is not affiliated with it.",
  "Input: a KML flight track exported from FlightRadar24 or FlightAware (the source is detected automatically), or a route drawn on the map.",
  "Output: an FPL flight plan file that Infinite Flight can load.",
  "Infinite Flight allows 250 waypoints per flight plan. Longer tracks are simplified, keeping turns and altitude changes.",
  "Free to use. Signing in with Discord is optional and is needed only to save, publish and like flight plans.",
  "Generated flight plans are for flight simulation only, never for real-world navigation.",
]

export function GET() {
  if (IS_STAGING) return new Response("Not indexed.\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } })

  const pages = Object.values(PAGES).filter((page) => page.indexable && !page.path.startsWith(LIBRARY_PATH))
  const body = [
    `# ${BRAND_NAME}`,
    "",
    `> ${SITE_TAGLINE}. ${PAGES.home.summary}`,
    "",
    "## Key facts",
    "",
    ...FACTS.map((fact) => `- ${fact}`),
    "",
    "## Pages",
    "",
    ...pages.map((page) => `- [${pageTitle(page)}](${absoluteUrl(page.path)}): ${page.summary}`),
    "",
  ].join("\n")

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  })
}
