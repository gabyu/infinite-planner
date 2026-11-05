// Kept apart from procedure-analysis (which carries the whole runway dataset) so the browser can import it cheaply.

/**
 * The notes the analysis leaves when it could not tell which runway a flight used ("runway marked XX: check it", "not matched by the
 * ground trim"...). The runway is chosen by hand when files are imported, so these are not shown to the admin any more.
 */
export function isRunwayFlag(flag: string): boolean {
  return /marked XX|not matched by the ground trim|no runway data matched|not on a named runway|landing runway not told|along a runway heading|^runway to check$/.test(flag)
}
