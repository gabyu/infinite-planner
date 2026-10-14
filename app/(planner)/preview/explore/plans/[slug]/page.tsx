import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PlanPage, planPageMetadata } from "@/components/plans/plan-page"
import { getViewer } from "@/lib/library"

// The live variant of a plan page that admins get while the library isn't launched (the middleware
// rewrites /explore/plans/* to it). Never cached, never indexed, and refuses everyone who isn't an admin
// even if a request reaches it directly.
export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const meta = await planPageMetadata(params.slug, "preview")
  return { ...meta, robots: { index: false, follow: false } }
}

export default async function Page({ params }: { params: { slug: string } }) {
  const viewer = await getViewer()
  if (!viewer.isAdmin) notFound()
  return <PlanPage slug={params.slug} mode="preview" />
}
