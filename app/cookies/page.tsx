import Link from "next/link"
import { Cookie } from "lucide-react"
import { LegalPage } from "@/components/legal-page"
import { CookiePreferencesButton } from "@/components/cookie-preferences-button"

export const metadata = {
  title: "Cookie Policy - Infinite Planner",
  description: "What Infinite Planner does and doesn't store in your browser, and why.",
}

export default function CookiesPage() {
  return (
    <LegalPage
      icon={<Cookie className="h-6 w-6" />}
      title="Cookie Policy"
      intro="Short version: the only cookie we set is the one that keeps you signed in, and only if you sign in. The only optional one is Google Analytics, and only if you say yes."
    >
      <section>
        <h2>1. Information stored on your device</h2>
        <p>
          Your display preference (light or dark) and your cookie choice are stored locally in your browser. They are
          not cookies and are not transmitted to us. Beyond this, the Service stores nothing on your device unless you
          sign in.
        </p>
      </section>

      <section>
        <h2>2. Strictly necessary cookies (sign-in)</h2>
        <p>
          If you choose to sign in with Discord, we set a session cookie so that the Service can recognise you as
          signed in. This cookie is strictly necessary for sign-in to function and is therefore not subject to the
          cookie banner. It is set only after you sign in and is removed when you sign out.
        </p>
        <p>
          Signing in shares your Discord username, avatar, and email address with us through our authentication
          provider, Supabase. We use your username and avatar to display your account, and we do not use your email
          address for any other purpose or to contact you. See our <Link href="/privacy">Privacy Policy</Link> for
          details.
        </p>
      </section>

      <section>
        <h2>3. Analytics cookies (optional)</h2>
        <p>
          With your consent, we use Google Analytics to understand how the Service is used and which pages are visited.
          Google Analytics sets its own cookies for this purpose. If you reject or ignore the cookie banner, Google
          Analytics is not loaded and no analytics cookies are set.
        </p>
        <p>
          You may change your choice at any time using the "Cookie preferences" link in the footer of every page. See{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
            Google's Privacy Policy
          </a>{" "}
          for how Google handles this data.
        </p>
      </section>

      <section>
        <h2>4. Other services</h2>
        <p>The following services do not use cookies, and are listed for transparency:</p>
        <ul>
          <li>
            <strong>Vercel Speed Insights</strong> provides anonymous performance measurements of the Service. It does
            not process personal data.
          </li>
          <li>
            <strong>Supabase</strong> stores the limited flight statistics described in our{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. What we do not do</h2>
        <ul>
          <li>We do not require you to create an account to use the core features of the Service.</li>
          <li>We do not use advertising or retargeting cookies.</li>
          <li>We do not sell or share your data with third parties other than the services listed above.</li>
        </ul>
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="mb-2">6. Managing your preferences</h2>
        <p className="mb-4">
          You may accept or reject Google Analytics at any time. Your choice takes effect immediately.
        </p>
        <CookiePreferencesButton />
      </section>
    </LegalPage>
  )
}
