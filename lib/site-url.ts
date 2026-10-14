// The public origin of this deployment (same values as app/layout.tsx's metadataBase).
export const IS_STAGING = process.env.NEXT_PUBLIC_ENV === "staging"
export const SITE_URL = IS_STAGING
  ? "https://staging830921-infiniteplanner.gabyu.com"
  : "https://infiniteplanner.gabyu.com"
