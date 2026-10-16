import type { Metadata } from "next"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import FAQSelector from "@/components/faq-selector"
import { HowItWorksContent } from "@/components/help/how-it-works-content"

export const metadata: Metadata = {
  title: "Help - Infinite Planner",
  description:
    "How Infinite Planner works, step by step, and answers to the questions people ask most: file formats, waypoints, ATC, Explore and sharing.",
  alternates: { canonical: "/help" },
}

// One page for the guide and the FAQ (they used to be /how-it-works and /faq, which now redirect here).
export default function HelpPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-grow">
        <section className="bg-gradient-to-b from-primary/10 to-background py-12">
          <div className="container mx-auto px-4 text-center">
            <h1 className="mb-6 font-display text-4xl font-semibold tracking-[-0.03em] md:text-5xl">Help</h1>
            <p className="mx-auto mb-8 max-w-3xl text-xl text-gray-600 dark:text-gray-300">
              How Infinite Planner works, and answers to the questions people ask most.
            </p>
            <nav aria-label="On this page" className="flex justify-center gap-3 text-sm">
              <a href="#how-it-works" className="rounded-full border px-4 py-1.5 no-underline hover:bg-muted">
                How it works
              </a>
              <a href="#faq" className="rounded-full border px-4 py-1.5 no-underline hover:bg-muted">
                FAQ
              </a>
            </nav>
          </div>
        </section>

        <section id="how-it-works" aria-labelledby="how-it-works-title" className="scroll-mt-20">
          <h2 id="how-it-works-title" className="sr-only">
            How it works
          </h2>
          <HowItWorksContent />
        </section>

        <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 border-t bg-gray-50 py-12 dark:bg-gray-900/40">
          <div className="container mx-auto px-4">
            <h2 id="faq-title" className="mb-8 font-display text-3xl font-semibold tracking-[-0.02em]">
              Frequently asked questions
            </h2>
            <FAQSelector />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
