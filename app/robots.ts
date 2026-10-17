import type { MetadataRoute } from "next"
import { IS_STAGING, SITE_URL } from "@/lib/site-url"

// Production: everything public is open to crawlers (the library's own pages say noindex until it is
// launched), the app's private areas are not. Staging: nothing, on top of its global noindex.
export default function robots(): MetadataRoute.Robots {
  if (IS_STAGING) return { rules: { userAgent: "*", disallow: "/" } }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin-dashboard", "/dashboard", "/preview/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
