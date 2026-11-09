import { SUPPORT_LABEL, SUPPORT_URL } from "@/lib/brand"

// The optional support link (Ko-fi). Opens in a new tab; nothing is loaded from Ko-fi on our pages.
export function SupportLink({ className }: { className?: string }) {
  return (
    <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className={className}>
      {SUPPORT_LABEL}
    </a>
  )
}
