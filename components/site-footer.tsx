import { SiteFooterBar } from "./site-footer-bar"

// Slim footer shared by the public pages and the planner. The detail lives behind "Legal".
export function SiteFooter() {
  return (
    <footer className="border-t">
      <SiteFooterBar />
    </footer>
  )
}
