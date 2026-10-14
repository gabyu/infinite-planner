
export interface LibraryTotals {
  published: number
  downloads: number
  likes: number
  imports: number
}

// What the community did with the user's plans, in four small numbers. Only shown once the library is open to them.
export function LibraryOverview({ totals }: { totals: LibraryTotals }) {
  const cards = [
    { label: "Published", value: totals.published },
    { label: "Downloads received", value: totals.downloads },
    { label: "Likes received", value: totals.likes },
    { label: "Imports received", value: totals.imports },
  ]
  return (
    <section className="mt-6" aria-label="Your plans in the library">
      <h2 className="text-sm font-semibold">In the library</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map(({ label, value }) => (
          <div key={label} className="rounded-lg border bg-card px-4 py-3">
            <dt className="studio-label">{label}</dt>
            <dd className="mt-1.5 font-mono text-lg">{value.toLocaleString("en-US")}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
