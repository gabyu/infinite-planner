import type { Metadata } from "next"
import { FplTest } from "./fpl-test"
import { privatePageMetadata } from "@/lib/seo"

// TEMPORARY (Safari .fpl.xml test): hidden, not linked, kept out of search results. Remove once a variant is chosen.
export const metadata: Metadata = privatePageMetadata("FPL download test")

export default function FplTestPage() {
  return <FplTest />
}
