import type { MetadataRoute } from "next"
import { LIBRARY_PATH } from "@/lib/brand"
import { PAGES, absoluteUrl } from "@/lib/seo"

// The site's own indexable pages. The library (Explore, plans, pilots) is for signed-in members only and is never
// listed here, launched or not.
export default function sitemap(): MetadataRoute.Sitemap {
  return Object.values(PAGES)
    .filter((page) => page.indexable && !page.path.startsWith(LIBRARY_PATH))
    .map((page) => ({ url: absoluteUrl(page.path) }))
}
