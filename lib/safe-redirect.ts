// Only same-site relative paths are allowed as a post-login destination, to avoid
// open redirects ("//evil.com", "/\evil.com", "https://evil.com" are all rejected).
export function safeNextPath(next: string | null | undefined, fallback = "/") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback
  return next
}
