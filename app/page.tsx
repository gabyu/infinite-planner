import { FlightPlanEditor } from "@/components/flight-plan-editor"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-white dark:bg-slate-900">
      <FlightPlanEditor />
    </main>
  )
}
