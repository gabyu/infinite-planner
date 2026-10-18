import { ScrollText } from "lucide-react"
import { LegalPage } from "@/components/legal-page"
import { LegalSections } from "@/components/legal-content"
import { TERMS_INTRO, TERMS_SECTIONS } from "@/content/terms"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata("terms")

// The wording lives in content/terms.ts, so it can be replaced without touching this page.
export default function TermsPage() {
  return (
    <LegalPage seo="terms" icon={<ScrollText className="h-6 w-6" />} title="Terms of Service" intro={TERMS_INTRO}>
      <LegalSections sections={TERMS_SECTIONS} />
    </LegalPage>
  )
}
