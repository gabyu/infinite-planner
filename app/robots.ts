import type { MetadataRoute } from "next"
import { IS_STAGING, SITE_URL } from "@/lib/site-url"

// Production: everything public is open to crawlers (the members-only library is disallowed and noindex), the app's private areas are not. Staging: nothing, on top of its global noindex.
export default function robots(): MetadataRoute.Robots {
  if (IS_STAGING) return { rules: { userAgent: "*", disallow: "/" } }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin-dashboard", "/dashboard", "/preview/", "/explore", "/pilots", "/auth/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
