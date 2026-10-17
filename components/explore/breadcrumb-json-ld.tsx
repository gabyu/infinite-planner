import { JsonLd } from "@/components/seo/json-ld"
import { SITE_URL } from "@/lib/site-url"

// schema.org BreadcrumbList: Routes -> Route -> Plan. Nothing else is claimed about the page.
export function BreadcrumbJsonLd({ items }: { items: { name: string; path: string }[] }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: `${SITE_URL}${item.path}`,
        })),
      }}
    />
  )
}
