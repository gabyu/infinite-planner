// The one place that decides what every public page says about itself: title, description, canonical URL,
// social card, structured data and the entry the AI-facing /llms.txt lists. Pages never write their own
// <title> or description: static pages name an entry of PAGES, dynamic ones (plans, route hubs...) go through
// buildMetadata(). No server-only imports, so the registry can be read anywhere.
import type { Metadata } from "next"
import { BRAND_NAME, LIBRARY_PATH } from "@/lib/brand"
import { FAQ_TEXT } from "@/lib/faq"
import { IS_STAGING, SITE_URL } from "@/lib/site-url"

export const SITE_TAGLINE = "The Flight Plan Hub for Infinite Flight"
export const DEFAULT_OG_IMAGE = { url: "/images/infinite-planner-og.webp", width: 1200, height: 630, alt: BRAND_NAME }

// Search engines cut titles at ~60 characters and descriptions at ~160: stay under both.
export const TITLE_MAX = 70
export const DESCRIPTION_MAX = 165

export type SchemaType = "WebSite" | "WebApplication" | "AboutPage" | "CollectionPage" | "FAQPage" | "WebPage"

export interface PageEntry {
  path: string
  // The page's own name. The brand is appended by pageTitle() unless `absoluteTitle` is set.
  title: string
  absoluteTitle?: boolean
  // Unique across the site (checked by checkRegistry). One or two sentences of what is on THIS page.
  description: string
  // Longer, plain-language explanation for AI agents (/llms.txt). Facts only.
  summary: string
  schema: SchemaType
  // Private or utility pages are kept out of search results and out of /llms.txt.
  indexable: boolean
}

export const PAGES = {
  home: {
    path: "/",
    title: `${BRAND_NAME} - ${SITE_TAGLINE}`,
    absoluteTitle: true,
    description:
      "Watched a flight on FlightRadar24 and want to fly it? Turn it into an Infinite Flight plan in minutes, or draw your own route. Free, built for the community.",
    summary:
      "Infinite Planner is a free web tool for Infinite Flight, the mobile flight simulator. It converts KML flight tracks from FlightRadar24 or FlightAware into Infinite Flight flight plans (FPL files), lets you draw a route from scratch, and hosts a public library of shared flight plans.",
    schema: "WebSite",
    indexable: true,
  },
  convert: {
    path: "/convert",
    title: "Fly any real flight: KML to Infinite Flight plan",
    description:
      "Drop in a FlightRadar24 or FlightAware KML file, check the route on the map and download a ready-to-fly Infinite Flight plan, trimmed to the 250 waypoint limit.",
    summary:
      "Convert: upload a KML file exported from FlightRadar24 or FlightAware. The source is detected automatically, the route is shown on a map, and it is simplified to Infinite Flight's limit of 250 waypoints while keeping turns and altitude changes. The result downloads as an FPL flight plan.",
    schema: "WebApplication",
    indexable: true,
  },
  sketch: {
    path: "/sketch",
    title: "Draw your own route for Infinite Flight",
    description:
      "Click a route onto the map, set your altitudes and download it as an Infinite Flight plan. No KML file needed, just the flight you have in mind.",
    summary:
      "Sketch: draw a route on a world map by placing waypoints, set altitudes, and export the result as an Infinite Flight flight plan. Use it for fictional or hand-built routes where no real flight track exists.",
    schema: "WebApplication",
    indexable: true,
  },
  explore: {
    path: LIBRARY_PATH,
    title: "Routes: flight plans by Infinite Flight pilots",
    description:
      "Find a route drawn by fellow pilots. Download it for Infinite Flight, or import it and make it your own.",
    summary:
      "Routes (Explore): a public library of Infinite Flight flight plans shared by pilots. Search by airport, route or flight number, sort by popularity, download a plan as an FPL file, or open it in Convert to adjust it. Each plan, route, airport and flight number has its own page.",
    schema: "CollectionPage",
    indexable: true,
  },
  help: {
    path: "/help",
    title: "Help and FAQ",
    description:
      "New here? See how Infinite Planner works step by step, with answers to common questions on file formats, waypoints, ATC, Explore and sharing.",
    summary:
      "Help: a step-by-step guide to turning a KML flight track into an Infinite Flight flight plan, plus frequently asked questions about supported file formats, the 250 waypoint limit, accuracy, ATC, sharing and the library.",
    schema: "FAQPage",
    indexable: true,
  },
  terms: {
    path: "/terms",
    title: "Terms of Service",
    description:
      "The ground rules for using Infinite Planner: fair use, accounts, the plans you share, and why our flight plans are for the simulator only.",
    summary:
      "Terms of Service: acceptable use, accounts, ownership of published content, the simulation-only disclaimer, limitation of liability, and the contact address.",
    schema: "WebPage",
    indexable: true,
  },
  privacy: {
    path: "/privacy",
    title: "Privacy Policy",
    description:
      "Straight answers on what data Infinite Planner collects with and without an account, why, who sees it, how long we keep it and your GDPR rights.",
    summary:
      "Privacy Policy: no personal data is collected without an account, only anonymous flight plan statistics. Signing in with Discord stores the Discord username and avatar. Covers legal basis (GDPR), recipients, retention and user rights.",
    schema: "WebPage",
    indexable: true,
  },
  cookies: {
    path: "/cookies",
    title: "Cookie Policy and preferences",
    description:
      "We set one sign-in cookie, and Google Analytics only if you say yes. See what we store in your browser and change your choice whenever you like.",
    summary:
      "Cookie Policy: one strictly necessary sign-in cookie, one optional analytics cookie (Google Analytics, only after consent). The page also holds the control to change or withdraw your cookie preferences.",
    schema: "WebPage",
    indexable: true,
  },
} as const satisfies Record<string, PageEntry>

export type PageKey = keyof typeof PAGES

export function pageTitle(entry: Pick<PageEntry, "title" | "absoluteTitle">) {
  return entry.absoluteTitle ? entry.title : `${entry.title} | ${BRAND_NAME}`
}

export function absoluteUrl(path: string) {
  return `${SITE_URL}${path === "/" ? "" : path}`
}

export interface BuildMetadataInput {
  // Final <title>, brand included (use pageTitle() or the helper of the page type).
  title: string
  description: string
  path: string
  indexable?: boolean
  // Whether links on a non-indexable page may still be followed (listing variants: yes; private pages: no).
  follow?: boolean
  // false when the page has its own file-based image (opengraph-image.tsx).
  image?: boolean
}

// Every page's metadata comes out of here, so title, description, canonical, Open Graph and Twitter
// can never disagree with each other.
export function buildMetadata({
  title,
  description,
  path,
  indexable = true,
  follow,
  image = true,
}: BuildMetadataInput): Metadata {
  const images = image ? [DEFAULT_OG_IMAGE] : undefined
  // Staging has no password: nothing there is ever indexable, whatever the page says.
  if (IS_STAGING) indexable = false
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: follow ?? false },
    openGraph: { type: "website", locale: "en_US", url: path, title, description, siteName: BRAND_NAME, images },
    twitter: { card: "summary_large_image", title, description, images: image ? [DEFAULT_OG_IMAGE.url] : undefined },
  }
}

export function pageMetadata(key: PageKey): Metadata {
  const entry: PageEntry = PAGES[key]
  return buildMetadata({
    title: pageTitle(entry),
    description: entry.description,
    path: entry.path,
    indexable: entry.indexable,
  })
}

// Pages that exist but must stay out of search results (dashboard, pilot profiles, visualizer).
export function privatePageMetadata(title: string): Metadata {
  return {
    title: { absolute: `${title} | ${BRAND_NAME}` },
    robots: { index: false, follow: false, nocache: true },
  }
}

// ---- Structured data (schema.org) ------------------------------------------------------------------

type Json = Record<string, unknown>

export function organizationJsonLd(): Json {
  return {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: BRAND_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.svg`,
    sameAs: ["https://discord.gg/ZdB72sjET5"],
  }
}

// The JSON-LD of a registry page. Home carries the site-wide WebSite and Organization nodes.
export function pageJsonLd(key: PageKey): Json {
  const entry: PageEntry = PAGES[key]
  const url = absoluteUrl(entry.path)
  const base = { name: pageTitle(entry), description: entry.description, url, inLanguage: "en" }
  const graph: Json[] = []

  if (key === "home") {
    graph.push(
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: BRAND_NAME,
        alternateName: SITE_TAGLINE,
        url: SITE_URL,
        description: entry.description,
        inLanguage: "en",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      organizationJsonLd(),
      {
        "@type": "SoftwareApplication",
        name: BRAND_NAME,
        applicationCategory: "GameApplication",
        operatingSystem: "Web",
        url: SITE_URL,
        description: entry.summary,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
    )
  } else if (entry.schema === "WebApplication") {
    graph.push({
      ...base,
      "@type": "WebApplication",
      applicationCategory: "GameApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      isPartOf: { "@id": `${SITE_URL}/#website` },
    })
  } else {
    graph.push({
      ...base,
      "@type": entry.schema,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      ...(entry.schema === "FAQPage"
        ? {
            mainEntity: Object.values(FAQ_TEXT).map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: { "@type": "Answer", text: faq.answer },
            })),
          }
        : {}),
    })
  }

  if (key !== "home") {
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: BRAND_NAME, item: SITE_URL },
        { "@type": "ListItem", position: 2, name: entry.title, item: url },
      ],
    })
  }
  return { "@context": "https://schema.org", "@graph": graph }
}

// ---- Dynamic pages -----------------------------------------------------------------------------------

// Shortens a description at a word boundary, with an ellipsis.
export function clip(text: string, max = DESCRIPTION_MAX) {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).replace(/[\s,;:.(-]+\S*$/, "")}…`
}

// ---- Registry check -----------------------------------------------------------------------------------

// Throws on a duplicate or oversized title/description. Run by scripts/check-seo.ts (npm run check:seo),
// so a copy-pasted description fails before it ships.
export function checkRegistry(): string[] {
  const problems: string[] = []
  const seenTitles = new Map<string, string>()
  const seenDescriptions = new Map<string, string>()
  for (const [key, entry] of Object.entries(PAGES) as [string, PageEntry][]) {
    const title = pageTitle(entry)
    if (title.length > TITLE_MAX) problems.push(`${key}: title is ${title.length} characters (max ${TITLE_MAX})`)
    if (entry.description.length > DESCRIPTION_MAX)
      problems.push(`${key}: description is ${entry.description.length} characters (max ${DESCRIPTION_MAX})`)
    if (entry.description.length < 70) problems.push(`${key}: description is too short to be useful`)
    const sameTitle = seenTitles.get(title)
    if (sameTitle) problems.push(`${key}: same title as ${sameTitle}`)
    const sameDescription = seenDescriptions.get(entry.description)
    if (sameDescription) problems.push(`${key}: same description as ${sameDescription}`)
    seenTitles.set(title, key)
    seenDescriptions.set(entry.description, key)
  }
  return problems
}
