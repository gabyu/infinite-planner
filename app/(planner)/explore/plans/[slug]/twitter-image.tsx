// X/Twitter reads its own file convention; it gets the same card as Open Graph. Route segment config
// has to be written out here: Next doesn't follow re-exports for it.
export const revalidate = 300
export const runtime = "nodejs"
export { default, alt, size, contentType } from "./opengraph-image"
