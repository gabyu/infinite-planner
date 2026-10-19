// One place for how an .fpl is handed to the browser, so every download (editor, dashboard, library) behaves the same.
// Safari builds the saved file's extension from the Content-Type, and an XML type makes it save "name.fpl.xml", which
// Infinite Flight then opens with its SimBrief importer. The type below is therefore not XML.

// Verified on Safari for iOS (dashboard download saved as name.fpl, opened in Infinite Flight): a custom type, not XML.
export const FPL_CONTENT_TYPE = "application/x-fpl"

export function fplDownloadHeaders(fileName: string, contentType: string = FPL_CONTENT_TYPE): Record<string, string> {
  return {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${fileName.replace(/["\\]/g, "")}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
  }
}

// Browser-side save, for the editor's Export: the Blob's type is what Safari reads, so it must match the server's.
export function saveFplInBrowser(content: string, fileName: string, contentType: string = FPL_CONTENT_TYPE) {
  const url = URL.createObjectURL(new Blob([content], { type: contentType }))
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
