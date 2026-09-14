import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { MapPin, Cookie } from "lucide-react"
import { DiscordIcon } from "@/components/discord-icon"
import { SiteFooter } from "@/components/site-footer"
import { CookiePreferencesButton } from "@/components/cookie-preferences-button"

export const metadata = {
  title: "Cookie Policy - Infinite Planner",
  description: "What Infinite Planner does and doesn't store in your browser, and why.",
}

export default function CookiesPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation */}
      <header className="border-b">
        <div className="container mx-auto py-2 sm:py-4 px-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 no-underline group">
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-md flex items-center justify-center">
              <Image
                src="/ip_logo.svg"
                alt="Infinite Planner Logo"
                width={32}
                height={32}
                className="w-full h-full group-hover:opacity-80 transition-opacity"
              />
            </div>
            <h1 className="text-sm sm:text-xl font-bold text-blue-600 dark:text-blue-400 group-hover:opacity-80 transition-opacity cursor-pointer whitespace-nowrap">
              Infinite Planner
            </h1>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4 md:gap-6">
            <Link
              href="/how-it-works"
              className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100 px-3 py-2 rounded-md transition-colors no-underline text-sm font-medium h-10 flex items-center"
            >
              Guide
            </Link>
            <Link
              href="/faq"
              className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100 px-3 py-2 rounded-md transition-colors no-underline text-sm font-medium h-10 flex items-center"
            >
              FAQ
            </Link>
            <Link
              href="https://discord.gg/ZdB72sjET5"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:block"
            >
              <Button variant="outline" className="h-10 flex items-center gap-2 px-4 bg-transparent">
                <DiscordIcon className="w-5 h-5" />
                <span>Join Discord</span>
              </Button>
            </Link>
            <Link href="/planner">
              <Button className="h-10 flex items-center gap-2 px-2 sm:px-4">
                <MapPin size={16} />
                <span className="hidden sm:inline">Open Planner Tool</span>
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-12 bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-950">
          <div className="container mx-auto px-4 text-center">
            <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <Cookie className="h-6 w-6" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Cookie Policy</h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
              Short version: we don't set any cookies ourselves. The only optional one is Google Analytics, and only
              if you say yes.
            </p>
          </div>
        </section>

        <div className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto space-y-10 [&_p]:text-gray-600 [&_p]:dark:text-gray-300 [&_p]:leading-relaxed [&_li]:text-gray-600 [&_li]:dark:text-gray-300 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1">
            <section>
              <h2>What Infinite Planner itself stores</h2>
              <p>
                Nothing, cookie-wise. Your theme (light/dark) and your cookie choice are saved with{" "}
                <code className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-sm font-mono">
                  localStorage
                </code>{" "}
                in your own browser - not a cookie, and never sent to our servers.
              </p>
            </section>

            <section>
              <h2>Google Analytics (optional)</h2>
              <p>
                If you accept it, we load Google Analytics to get a rough sense of how many people use Infinite
                Planner and which pages they visit. It sets its own cookies to do this. If you reject or ignore the
                banner, the script never loads and no analytics cookie is set.
              </p>
              <p>
                You can change your mind at any time with the "Cookie preferences" link in the footer of every page.
                See{" "}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  Google's Privacy Policy
                </a>{" "}
                for how they handle this data.
              </p>
            </section>

            <section>
              <h2>Other services we use</h2>
              <p>These don't use cookies, but for transparency, here's everything else your browser talks to:</p>
              <ul>
                <li>
                  <strong>Vercel Speed Insights</strong> - anonymous performance metrics (page load times) to help us
                  keep the site fast. No personal data, no cookies.
                </li>
                <li>
                  <strong>Supabase</strong> - when you import a KML file, we store the flight number, airports, date,
                  and source parsed from the filename to power the "Infinite Planner Statistics" section on the
                  homepage. The flight plan content itself (waypoints, coordinates) never leaves your browser except
                  for that summary.
                </li>
              </ul>
            </section>

            <section>
              <h2>What we don't do</h2>
              <ul>
                <li>No accounts, no logins, no personal profiles</li>
                <li>No advertising or retargeting cookies</li>
                <li>We never sell or share data with third parties beyond the services listed above</li>
              </ul>
            </section>

            <section className="rounded-lg border bg-card p-6">
              <h2 className="mb-2">Change your mind</h2>
              <p className="mb-4">
                You can accept or reject Google Analytics again at any time - it takes one click and applies
                immediately.
              </p>
              <CookiePreferencesButton />
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <SiteFooter />
    </div>
  )
}
