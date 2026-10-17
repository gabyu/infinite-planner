import type React from "react"
import { JsonLd } from "@/components/seo/json-ld"
import { pageJsonLd, pageMetadata } from "@/lib/seo"

// The page itself is a client component, so its metadata and structured data live here.
export const metadata = pageMetadata("convert")

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={pageJsonLd("convert")} />
      {children}
    </>
  )
}
