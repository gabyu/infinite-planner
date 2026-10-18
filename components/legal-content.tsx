import Link from "next/link"
import { Fragment, type ReactNode } from "react"
import { CONTACT_EMAIL, LEGAL_EFFECTIVE_DATE, LEGAL_LAST_UPDATED } from "@/lib/legal"
import type { TermsSection } from "@/content/terms"

const PLACEHOLDERS: Record<string, string> = {
  "{{CONTACT_EMAIL}}": CONTACT_EMAIL,
  "{{EFFECTIVE_DATE}}": LEGAL_EFFECTIVE_DATE,
  "{{LAST_UPDATED}}": LEGAL_LAST_UPDATED,
}

function fill(text: string) {
  return text.replace(/\{\{[A-Z_]+\}\}/g, (token) => PLACEHOLDERS[token] ?? token)
}

// **bold** and [label](target) inside one paragraph; placeholders are filled first. Anything else is plain text.
function inline(raw: string): ReactNode {
  const text = fill(raw)
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g)
  return parts.map((part, index) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/)
    if (bold) return <strong key={index}>{bold[1]}</strong>
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
    if (link) {
      const [, label, target] = link
      return target.startsWith("/") ? (
        <Link key={index} href={target}>
          {label}
        </Link>
      ) : (
        <a key={index} href={target}>
          {label}
        </a>
      )
    }
    return <Fragment key={index}>{part}</Fragment>
  })
}

// The sections of a legal text kept in /content, numbered by position.
export function LegalSections({ sections }: { sections: TermsSection[] }) {
  return (
    <>
      {sections.map((section, index) => (
        <section key={section.heading} id={section.heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")} className="scroll-mt-24">
          <h2>
            {index + 1}. {section.heading}
          </h2>
          {section.blocks.map((block, blockIndex) =>
            typeof block === "string" ? (
              <p key={blockIndex}>{inline(block)}</p>
            ) : (
              <ul key={blockIndex}>
                {block.list.map((item) => (
                  <li key={item}>{inline(item)}</li>
                ))}
              </ul>
            ),
          )}
        </section>
      ))}
    </>
  )
}
