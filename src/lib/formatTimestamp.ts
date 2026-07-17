const DISPLAY_FORMAT = new Intl.DateTimeFormat("nl-NL", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/**
 * ISO timestamps from some log sources carry microsecond precision
 * (6 fractional digits) rather than the millisecond precision the Date
 * constructor reliably parses — trim to 3 digits before parsing.
 */
function normalizeFractionalSeconds(timestamp: string): string {
  return timestamp.replace(/(\.\d{3})\d+/, "$1");
}

/**
 * Formats a raw log timestamp (e.g. "2026-07-14T09:58:15.476491+02:00")
 * into a compact, human-readable form in the viewer's local time.
 * Falls back to the raw string for unparseable input so a format the app
 * doesn't recognize is still visible rather than silently hidden.
 */
export function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) {
    return "—";
  }
  const date = new Date(normalizeFractionalSeconds(timestamp));
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return DISPLAY_FORMAT.format(date);
}
