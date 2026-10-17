import { BRAND_NAME, LIBRARY_NAME } from "@/lib/brand"
import { IS_STAGING, SITE_URL } from "@/lib/site-url"
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

  const pages = Object.values(PAGES).filter((page) => page.indexable)
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
    `## ${LIBRARY_NAME} (shared flight plans)`,
    "",
    `- Plan pages: ${SITE_URL}/explore/plans/{origin}-{destination}[-{flight number}]-{id}. Each has the route, distance, flight time, waypoints and an FPL download.`,
    `- Route pages: ${SITE_URL}/explore/routes/{origin}-{destination} (ICAO codes), e.g. lfpg-klax.`,
    `- Airport pages: ${SITE_URL}/explore/location/{ICAO}, e.g. KPHX.`,
    `- Flight number pages: ${SITE_URL}/explore/flight_number/{flight number}, e.g. AF69.`,
    `- The full list of public pages is in ${SITE_URL}/sitemap.xml.`,
    "",
  ].join("\n")

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  })
}
