import { LegalLinks } from "@/components/legal-links"

// Slim footer for the admin area, which doesn't use the public SiteFooter.
export function AdminFooter() {
  return (
    <footer className="border-t px-4 py-4">
      <LegalLinks />
    </footer>
  )
}
