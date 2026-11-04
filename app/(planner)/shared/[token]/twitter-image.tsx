// X/Twitter reads its own file convention; it gets the same card as Open Graph.
export { default, alt, size, contentType, dynamic } from "./opengraph-image"
// Next reads this field statically, so it cannot be re-exported.
export const runtime = "nodejs"
