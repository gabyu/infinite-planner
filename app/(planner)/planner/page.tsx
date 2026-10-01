import { redirect } from "next/navigation"

// /planner used to be the KML import tool before /convert and /sketch had
// their own routes - redirect old bookmarks/links here instead of a 404.
export default function PlannerPage() {
  redirect("/convert")
}
