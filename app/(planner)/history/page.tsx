import { redirect } from "next/navigation"

// The history became the dashboard: keep old links (and the testers' bookmarks) working.
export default function HistoryRedirect() {
  redirect("/dashboard")
}
