import type React from "react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { JsonLd } from "@/components/seo/json-ld"
import { pageJsonLd, type PageKey } from "@/lib/seo"

// Shared shell for the legal pages (/terms, /privacy, /cookies): hero + readable prose column.
export function LegalPage({
  seo,
  icon,
  title,
  intro,
  children,
}: {
  // The page's entry in lib/seo.ts, for its structured data.
  seo: PageKey
  icon: React.ReactNode
  title: string
  intro: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <JsonLd data={pageJsonLd(seo)} />
      <SiteHeader />

      <main className="flex-grow">
        <section className="py-12 bg-gradient-to-b from-primary/10 to-background">
          <div className="container mx-auto px-4 text-center">
            <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              {icon}
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-[-0.03em] mb-6">{title}</h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">{intro}</p>
          </div>
        </section>

        <div className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto space-y-10 [&_p]:text-gray-600 [&_p]:dark:text-gray-300 [&_p]:leading-relaxed [&_li]:text-gray-600 [&_li]:dark:text-gray-300 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_p+p]:mt-3 [&_p+ul]:mt-3 [&_ul+p]:mt-3 [&_a]:link">
            {children}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
