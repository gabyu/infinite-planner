import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import { LegalPage } from "@/components/legal-page"
import { CONTACT_EMAIL, LEGAL_LAST_UPDATED } from "@/lib/legal"

export const metadata = {
  title: "Privacy Policy - Infinite Planner",
  description: "What data Infinite Planner collects, why, and your rights over it.",
}

export default function PrivacyPage() {
  return (
    <LegalPage
      icon={<ShieldCheck className="h-6 w-6" />}
      title="Privacy Policy"
      intro="Short version: today, we don't collect anything tied to you personally — just anonymous flight plan stats. If you sign in with Discord (a feature we're currently rolling out), we store your Discord username and avatar to run your account, nothing more."
    >
      <section>
        <h2>1. Who we are</h2>
        <p>
          Infinite Planner (the "Service") is operated independently as a hobby project for the Infinite Flight
          community ("we", "us"). Questions about this Privacy Policy may be sent to the contact address in Section
          12.
        </p>
      </section>

      <section>
        <h2>2. Information we collect without an account</h2>
        <p>
          When you import a flight, we record the flight number, the departure and arrival airports, the date, and the
          flight tracking service the data came from. This information is used solely to produce the aggregate
          statistics shown publicly on the Service, such as the number of flight plans generated.
        </p>
        <p>
          The route itself (its waypoints and coordinates) is processed on your own device and is not transmitted to
          us. We do not retain the KML file you import; only the limited flight plan information described above is
          kept.
        </p>
      </section>

      <section>
        <h2>3. Information we collect when you sign in with Discord</h2>
        <p>
          The Service offers optional sign-in through Discord. If you choose to sign in, Discord provides us with your
          Discord username, avatar, and email address. We use your username and avatar to identify and display your
          account. Your email address is held by our authentication provider only to operate sign-in, and we do not use
          it to contact you.
        </p>
        <p>
          We never receive or store your Discord password. Flight plans you generate while signed in are stored and
          linked to your account.
        </p>
        <p>
          Every flight plan that a signed-in user exports may be displayed anonymously on the Service: its route (the
          departure and arrival airports, the waypoints, the altitudes and the date) can appear on the home page,
          for example on its globe of recent flights, and on a full-screen visualization page showing the latest
          flights. This applies to the flight plans of all users alike. The display never includes your Discord
          username, avatar, email address or any other information that identifies you.
        </p>
        <p>
          Your Discord username is the name by which you are identified on the Service, and the only element of your
          profile that is visible to anyone, until you make a flight plan public. When you make a flight plan public,
          your Discord username and avatar are displayed with it as its author to anyone who opens its page, whether or
          not they have an account. Your email address is never shown to other users or visitors.
        </p>
        <p>
          A flight plan you make <strong>public</strong> is listed in the Service's library, and search engines may index
          it, together with your Discord username. A <strong>private</strong> plan is visible to you only. Search
          engines and other caches may keep a page for some time after you make a plan private again, which we do not
          control.
        </p>
        <p>
          Signed-in users can open a pilot profile page, which shows your Discord username and avatar, the month you
          joined, the flight plans you published, and a few totals: the number of flight plans you created (including
          private ones), your published plans, the total distance, and the downloads and likes your plans received. It
          also shows your favorite airport and your most frequent flight numbers; these are worked out from all of your
          exported flight plans, private ones included, but only the result is shown, never the private plans
          themselves.
        </p>
        <p>
          We record which signed-in users liked, downloaded, or imported a published flight plan (one record per user
          and plan, to avoid counting twice), and the reports users send about flight plans, with the reporter and the
          reason. Anonymous visits are not counted. The record of who liked or downloaded a plan is visible to you for
          your own actions only; other users see totals.
        </p>
        <p>The core features of the Service can be used without creating an account.</p>
      </section>

      <section>
        <h2>4. Cookies</h2>
        <p>
          Our use of cookies is described in our <Link href="/cookies">Cookie Policy</Link>. In summary, no optional
          cookies are used unless you consent to analytics. A strictly necessary session cookie is used if you sign in
          with Discord, in order to keep you signed in.
        </p>
      </section>

      <section>
        <h2>5. Legal basis for processing (GDPR)</h2>
        <ul>
          <li>
            <strong>Anonymous flight plan statistics:</strong> our legitimate interest in producing aggregate,
            non-identifying usage statistics.
          </li>
          <li>
            <strong>Analytics:</strong> your consent, requested through the cookie banner, which you may withdraw at
            any time.
          </li>
          <li>
            <strong>Discord account data:</strong> your consent, given when you choose to sign in. You may delete your
            account at any time (see Section 9).
          </li>
          <li>
            <strong>Display of your Discord name and avatar on public flight plans:</strong> your consent, given when you
            make a flight plan public, as the confirmation screen informs you.
          </li>
        </ul>
      </section>

      <section>
        <h2>6. Who receives your information</h2>
        <p>We share information only with the following recipients, and only as needed to operate the Service:</p>
        <ul>
          <li>
            <strong>Anyone who opens a flight plan you make public</strong>, who can view it, sees your Discord name and
            avatar as its author and, once signed in, can download it. You can make it private at any time, after which
            its page no longer works.
          </li>
          <li>
            <strong>Discord</strong>, which handles authentication if you sign in. See{" "}
            <a href="https://discord.com/privacy" target="_blank" rel="noopener noreferrer">
              Discord's Privacy Policy
            </a>
            .
          </li>
          <li>
            <strong>Supabase</strong>, our database and authentication provider, which stores the information
            described in this policy.
          </li>
          <li>
            <strong>Google Analytics</strong>, which provides aggregate usage analytics, only if you have consented.
            See{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
              Google's Privacy Policy
            </a>
            .
          </li>
          <li>
            <strong>Vercel</strong>, which hosts the Service and provides anonymous performance measurements that do not
            contain personal data.
          </li>
        </ul>
        <p>We do not sell your personal data and do not share it with advertisers.</p>
      </section>

      <section>
        <h2>7. International transfers</h2>
        <p>
          Some of the providers listed above may process information outside the European Economic Area. Where this
          occurs, it is carried out under those providers' standard safeguards, such as Standard Contractual Clauses.
        </p>
      </section>

      <section>
        <h2>8. Retention</h2>
        <ul>
          <li>
            Anonymous flight plan statistics are kept indefinitely in aggregate form. As they are not linked to any
            individual, standard retention limits for personal data do not apply to them.
          </li>
          <li>
            Discord account data is kept until you delete your account. Deleting it also removes the flight plans you
            published, your likes and download records, and the reports you sent. Copies of your plans that other users
            imported stay in their accounts, without any link back to you.
          </li>
          <li>
            Unsaved drafts are not retained indefinitely, as described in our{" "}
            <Link href="/terms">Terms of Service</Link>.
          </li>
        </ul>
      </section>

      <section>
        <h2>9. Your rights</h2>
        <p>
          If you are located in the EU, the UK, or another jurisdiction with similar protections, you have the right to
          access, correct, export, or delete your personal data, and to object to or restrict certain processing. As
          accounts are a recent addition, these rights currently apply principally to Discord account data. To
          exercise any of them, please contact us using the details in Section 12.
        </p>
      </section>

      <section>
        <h2>10. Children</h2>
        <p>
          The Service is not directed at children. We do not knowingly collect personal data from anyone under 13 (or
          the applicable minimum age in your country).
        </p>
      </section>

      <section>
        <h2>11. Changes to this policy</h2>
        <p>
          We may update this policy as the Service evolves, in particular as account-based features are introduced.
          Material changes will be reflected in the "Last updated" date below.
        </p>
      </section>

      <section>
        <h2>12. Contact</h2>
        <p>
          Questions about your data or this policy may be sent to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
        <p className="text-sm italic">Last updated: {LEGAL_LAST_UPDATED}</p>
      </section>
    </LegalPage>
  )
}
