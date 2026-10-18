// The text of the Terms of Service, and nothing else: replace the wording here (the lawyer's final text) and
// the /terms page follows, no component to touch. See components/legal-content.tsx for how it is shown.
//
// Inline markup inside a paragraph or a list item:
//   **bold**             bold
//   [label](/privacy)    a link (a path stays on the site; "mailto:" opens the mail app)
//   {{CONTACT_EMAIL}}    the contact address, as a mailto link        (lib/legal.ts)
//   {{EFFECTIVE_DATE}}   the date the Terms take effect              (lib/legal.ts)
//   {{LAST_UPDATED}}     the date of the last change                 (lib/legal.ts)
// Sections are numbered by their position, so "Section 5" in the text means the fifth one.

export type TermsBlock = string | { list: string[] }

export interface TermsSection {
  heading: string
  blocks: TermsBlock[]
}

export const TERMS_INTRO =
  "Short version: this is a free tool for the Infinite Flight community. Use it reasonably, don't abuse it, and don't treat generated flight plans as real-world navigation data."

export const TERMS_SECTIONS: TermsSection[] = [
  {
    heading: "The Service",
    blocks: [
      'Infinite Planner (the "Service") enables users of the Infinite Flight flight simulator to create flight plans, either by converting flight data obtained from third-party flight tracking services or by drawing a route manually. The Service is intended solely for use within the Infinite Flight simulator and not for real-world aviation.',
      "By accessing or using the Service, you agree to be bound by these Terms of Service.",
    ],
  },
  {
    heading: "Independence",
    blocks: [
      "Infinite Planner is independent. It is not affiliated with, endorsed by, or officially connected to Infinite Flight, FlightRadar24, FlightAware, or any other flight tracking service. Flight data obtained through those services remains the property of its respective providers, and no ownership of such data is claimed.",
    ],
  },
  {
    heading: "Acceptable use",
    blocks: [
      "You agree not to:",
      {
        list: [
          "scrape, abuse, or overload the Service, or the third-party services on which it relies (including FlightRadar24 and FlightAware);",
          "circumvent any usage limits, or access the Service by automated means other than through an interface we may make available in the future; or",
          "use the Service or its content for any unlawful purpose, or in any manner that may harm the Service, its users, or the Infinite Flight community.",
        ],
      },
      "We may suspend or restrict access to the Service for any user who fails to comply with these Terms.",
    ],
  },
  {
    heading: "Accounts",
    blocks: [
      "The Service offers optional sign-in through Discord, which may be used to access features such as saving, re-exporting, or publishing flight plans. An account is never required to use the core features of the Service.",
      "If you sign in, you are responsible for the security of your Discord account. Authentication is handled by Discord; we do not manage it and only receive confirmation of your sign-in from Discord.",
      "Your Discord username is the name by which you are identified on the Service, including to other users. When you make a flight plan public (Section 5), your Discord username and your avatar are shown with it. Your email address is never shown to other users or visitors.",
    ],
  },
  {
    heading: "Your content",
    blocks: [
      "You retain all rights in the flight plans you create. We do not claim ownership of your routes or flight plan files.",
      "**What can be published.** You may share or publish only content that you designed yourself in Infinite Planner and that you have the right to share. Content derived from third-party data or files, including a flight plan converted from a flight tracking export, may not be published, and the Service does not offer it. Such a flight plan stays in your account, and the same holds for any copy or edit of it.",
      "Each exported flight plan has a visibility that you choose, and that is **private** until you change it. **Public** means it is listed in the public library of the Service (Explore), can be found by search, is indexed by search engines, and can be opened by anyone who has its link. There is nothing in between: a flight plan is either private or public. Nothing is made public without an explicit action from you.",
      "When you make a flight plan public, your Discord username and avatar are displayed with it as its author, and this cannot be turned off for that plan. If you do not wish them to be displayed, keep the flight plan private. By publishing a flight plan you grant the Service a non-exclusive, worldwide, royalty-free licence to host, display, and distribute it, and to let signed-in users download it, like it, and import a copy of it, for as long as it remains published. You confirm that you designed it, that you are entitled to publish it, and that it does not infringe the rights of anyone else.",
      "You may change a flight plan back to private at any time, after which its page and link stop working. The links created by the earlier sharing feature of the Service were withdrawn when it was replaced by this visibility setting and no longer work. Search engines and other caches may keep showing a page for some time after it was withdrawn, which we do not control. A copy that another user imported while your plan was published belongs to that user: it stays in their account and is not affected when you unpublish or delete the original. Downloading a flight plan from the library requires signing in with Discord.",
      "For legal reasons, imported KML files are not retained; only the flight plan data generated from them may be kept. Unsaved drafts are not retained indefinitely and are deleted automatically unless you take steps to keep them, as described in our [Privacy Policy](/privacy).",
    ],
  },
  {
    heading: "Third-party data",
    blocks: [
      "Some features let you convert files that you obtained yourself from third-party flight tracking services. You are responsible for complying with the terms of any service you take data from, including any limit those terms place on how the data may be used, kept, or shared.",
    ],
  },
  {
    heading: "Removal of content",
    blocks: [
      "Anyone who is signed in may report a published flight plan. We may hide or remove any content, and may stop an account from publishing, in response to a complaint or at our own discretion, in particular if the content breaks these Terms or the rights of others.",
    ],
  },
  {
    heading: "Copyright complaints",
    blocks: [
      "If you believe a flight plan on the Service infringes your copyright or other rights, use the Report control on its page and choose the copyright reason, or write to [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}). Please include:",
      {
        list: [
          "the address of the page, or the route and author it shows;",
          "what you believe is infringed, and how you are entitled to act on it; and",
          "your name and an email address where we can reach you.",
        ],
      },
      "We review each complaint. While we do, or afterwards, we may hide the flight plan or remove it, and we may tell the person who published it that a complaint was made. We may stop the account of a person who repeatedly publishes content that infringes the rights of others from publishing.",
    ],
  },
  {
    heading: "Simulation only",
    blocks: [
      "The Service is for flight simulation. Generated flight plans are intended for use within the Infinite Flight simulator only. They are not real-world aeronautical data and must never be used for actual navigation.",
    ],
  },
  {
    heading: "Disclaimer",
    blocks: [
      'The Service is provided "as is" and "as available", without warranty of any kind, express or implied. We do not guarantee the accuracy, completeness, or availability of any flight plan or of data obtained from third-party flight tracking services.',
    ],
  },
  {
    heading: "Limitation of liability",
    blocks: [
      "To the fullest extent permitted by applicable law, the Service and its operator shall not be liable for any loss or damage arising out of or in connection with your use of the Service, including inaccurate flight plans, interruptions of service, or loss of data.",
    ],
  },
  {
    heading: "Changes to these Terms",
    blocks: [
      'We may amend these Terms from time to time. Your continued use of the Service after an amendment takes effect constitutes acceptance of the amended Terms. Material changes will be reflected in the "Last updated" date below.',
    ],
  },
  {
    heading: "Contact",
    blocks: [
      "Questions regarding these Terms may be sent to [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}).",
      "Effective date: {{EFFECTIVE_DATE}}. Last updated: {{LAST_UPDATED}}.",
    ],
  },
]
