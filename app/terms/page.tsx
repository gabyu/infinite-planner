import Link from "next/link"
import { ScrollText } from "lucide-react"
import { LegalPage } from "@/components/legal-page"
import { CONTACT_EMAIL, LEGAL_LAST_UPDATED } from "@/lib/legal"

export const metadata = {
  title: "Terms of Service - Infinite Planner",
  description: "The terms for using Infinite Planner, the flight plan hub for Infinite Flight.",
}

export default function TermsPage() {
  return (
    <LegalPage
      icon={<ScrollText className="h-6 w-6" />}
      title="Terms of Service"
      intro="Short version: this is a free tool for the Infinite Flight community. Use it reasonably, don't abuse it, and don't treat generated flight plans as real-world navigation data."
    >
      <section>
        <h2>1. The Service</h2>
        <p>
          Infinite Planner (the "Service") enables users of the Infinite Flight flight simulator to create flight
          plans, either by converting flight data obtained from third-party flight tracking services or by drawing a
          route manually. The Service is intended solely for use within the Infinite Flight simulator and not for
          real-world aviation.
        </p>
        <p>By accessing or using the Service, you agree to be bound by these Terms of Service.</p>
      </section>

      <section>
        <h2>2. No affiliation</h2>
        <p>
          The Service is not affiliated with, endorsed by, or officially connected to FlightRadar24, FlightAware, or
          Infinite Flight. Flight data obtained through those services remains the property of its respective
          providers, and no ownership of such data is claimed.
        </p>
      </section>

      <section>
        <h2>3. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>
            scrape, abuse, or overload the Service, or the third-party services on which it relies (including
            FlightRadar24 and FlightAware);
          </li>
          <li>
            circumvent any usage limits, or access the Service by automated means other than through an interface we
            may make available in the future; or
          </li>
          <li>
            use the Service or its content for any unlawful purpose, or in any manner that may harm the Service, its
            users, or the Infinite Flight community.
          </li>
        </ul>
        <p>We may suspend or restrict access to the Service for any user who fails to comply with these Terms.</p>
      </section>

      <section>
        <h2>4. Accounts</h2>
        <p>
          The Service offers optional sign-in through Discord, which may be used to access features such as saving,
          re-exporting, or sharing flight plans. An account is never required to use the core features of the Service.
        </p>
        <p>
          If you sign in, you are responsible for the security of your Discord account. Authentication is handled by
          Discord; we do not manage it and only receive confirmation of your sign-in from Discord.
        </p>
        <p>
          Your Discord username is the name by which you are identified on the Service, including to other users. It is
          the only element of your Discord profile that is made visible to other people. Your avatar and email address
          are never shown to other users or visitors.
        </p>
      </section>

      <section>
        <h2>5. Your content</h2>
        <p>
          You retain all rights in the flight plans you generate, import, or draw. We do not claim ownership of your
          routes or flight plan files. If you choose to share a flight plan, a link is created that anyone can open,
          without an account, to view and download it. By doing so, you grant other people permission to view and
          download that flight plan, and nothing more.
        </p>
        <p>
          When you share a flight plan, your Discord username is displayed with it as its author, and this cannot be
          turned off for a shared plan. If you do not wish your Discord username to be displayed, do not share the
          flight plan. You may stop sharing at any time, after which the link no longer works.
        </p>
        <p>
          For legal reasons, imported KML files are not retained; only the flight plan data generated from them may be
          kept. Unsaved drafts are not retained indefinitely and are deleted automatically unless you take steps to
          keep them, as described in our <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </section>

      <section>
        <h2>6. Disclaimer</h2>
        <p>
          The Service is provided "as is" and "as available", without warranty of any kind, express or implied.
          Generated flight plans are intended for use within the Infinite Flight simulator only. They do not
          constitute real-world aeronautical data and must never be used for actual navigation. We do not warrant the
          accuracy, completeness, or availability of data obtained from third-party flight tracking services.
        </p>
      </section>

      <section>
        <h2>7. Limitation of liability</h2>
        <p>
          To the fullest extent permitted by applicable law, the Service and its operator shall not be liable for any
          loss or damage arising out of or in connection with your use of the Service, including inaccurate flight
          plans, interruptions of service, or loss of data.
        </p>
      </section>

      <section>
        <h2>8. Changes to these Terms</h2>
        <p>
          We may amend these Terms from time to time. Your continued use of the Service after an amendment takes effect
          constitutes acceptance of the amended Terms. Material changes will be reflected in the "Last updated" date
          below.
        </p>
      </section>

      <section>
        <h2>9. Contact</h2>
        <p>
          Questions regarding these Terms may be sent to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
        <p className="text-sm italic">Last updated: {LEGAL_LAST_UPDATED}</p>
      </section>
    </LegalPage>
  )
}
