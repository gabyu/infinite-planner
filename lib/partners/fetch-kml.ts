import type { Partner } from "@/config/partners"

// Server-side fetch of a partner's KML. The URL must already have passed validatePartnerUrl.
// Never follows a redirect, gives up after the partner's timeout (body included), and stops reading at the size limit
// whatever Content-Length says.

export type FetchKmlError = "expired" | "timeout" | "network" | "redirect" | "too_large" | "wrong_type"

export type FetchKmlResult = { ok: true; text: string } | { ok: false; code: FetchKmlError }

const KML_TYPE = "application/vnd.google-earth.kml+xml"

export async function fetchPartnerKml(
  partner: Partner,
  url: URL,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchKmlResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), partner.fetchTimeoutMs)
  try {
    let response: Response
    try {
      response = await fetchImpl(url.toString(), {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
        headers: { Accept: KML_TYPE },
      })
    } catch (error) {
      return { ok: false, code: isAbort(error, controller) ? "timeout" : "network" }
    }

    if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
      await response.body?.cancel().catch(() => {})
      return { ok: false, code: "redirect" }
    }
    if (response.status === 403 || response.status === 410) {
      await response.body?.cancel().catch(() => {})
      return { ok: false, code: "expired" }
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {})
      return { ok: false, code: "network" }
    }

    const type = (response.headers.get("content-type") ?? "").trim().toLowerCase()
    if (!type.startsWith(KML_TYPE)) {
      await response.body?.cancel().catch(() => {})
      return { ok: false, code: "wrong_type" }
    }

    // A declared length over the limit is refused early; an absent or lying one is caught while streaming.
    const declared = Number(response.headers.get("content-length"))
    if (Number.isFinite(declared) && declared > partner.maxFileSizeBytes) {
      await response.body?.cancel().catch(() => {})
      return { ok: false, code: "too_large" }
    }

    if (!response.body) return { ok: false, code: "network" }
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let received = 0
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        received += value.byteLength
        if (received > partner.maxFileSizeBytes) {
          await reader.cancel().catch(() => {})
          return { ok: false, code: "too_large" }
        }
        chunks.push(value)
      }
    } catch (error) {
      return { ok: false, code: isAbort(error, controller) ? "timeout" : "network" }
    }

    const bytes = new Uint8Array(received)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return { ok: true, text: new TextDecoder("utf-8").decode(bytes) }
  } finally {
    clearTimeout(timer)
  }
}

function isAbort(error: unknown, controller: AbortController): boolean {
  return controller.signal.aborted || (error instanceof Error && error.name === "AbortError")
}
