import { RouteArrow } from "@/components/route-arrow"

interface StartLayoutProps {
  from: React.ReactNode
  to: React.ReactNode
  importButton: React.ReactNode
  hint: React.ReactNode
}

// Pre-import screen of Convert: the form on the left (75%), how it works on the right (25%). The form's left edge
// is the logo's; the steps fill the width instead of leaving a hole.
export function StartLayout({ from, to, importButton, hint }: StartLayoutProps) {
  return (
    <div className="grid gap-8 lg:grid-cols-[3fr_1fr] lg:gap-12">
      <div>
        <div className="rounded-2xl bg-muted/50 p-5 sm:p-6">
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
            {from}
            <RouteArrow className="mx-0 mt-[2.9rem] h-5 w-5 text-muted-foreground" />
            {to}
          </div>
          <div className="mt-3">{importButton}</div>
        </div>
        {hint}
      </div>
      <HowItWorks />
    </div>
  )
}

const STEPS = [
  {
    title: "Download your KML",
    text: "From FlightRadar24 or FlightAware. Keep the original file name so the flight number is detected.",
  },
  { title: "Enter the two airports", text: "Search by ICAO code, airport name or city." },
  { title: "Import, adjust, export", text: "Edit waypoints and names, then download the .fpl for Infinite Flight." },
]

function HowItWorks() {
  return (
    <ol className="space-y-6 lg:pt-1">
      {STEPS.map((step, index) => (
        <li key={step.title} className="flex gap-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs text-muted-foreground">
            {index + 1}
          </span>
          <div>
            <p className="text-sm font-medium">{step.title}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{step.text}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
