import {
  DEFAULT_DATE_FORMAT_SETTINGS,
  type DateFormatSettings,
} from "./dateFormatSettings";

/**
 * ISO timestamps from some log sources carry microsecond precision
 * (6 fractional digits) rather than the millisecond precision the Date
 * constructor reliably parses — trim to 3 digits before parsing.
 */
function normalizeFractionalSeconds(timestamp: string): string {
  return timestamp.replace(/(\.\d{3})\d+/, "$1");
}

function buildFormatter(settings: DateFormatSettings): Intl.DateTimeFormat {
  if (settings.mode === "system") {
    // No explicit locale: resolves to the OS/runtime's default locale, so
    // the date/time conventions follow the system's own settings.
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "medium",
    });
  }
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: settings.monthStyle,
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: settings.showSeconds ? "2-digit" : undefined,
    hourCycle: settings.hourCycle,
  });
}

/**
 * Formats a raw log timestamp (e.g. "2026-07-14T09:58:15.476491+02:00")
 * into a compact, human-readable form. Falls back to the raw string for
 * unparseable input so a format the app doesn't recognize is still visible
 * rather than silently hidden.
 */
export function formatTimestamp(
  timestamp: string | null,
  settings: DateFormatSettings = DEFAULT_DATE_FORMAT_SETTINGS,
): string {
  if (!timestamp) {
    return "—";
  }
  const date = new Date(normalizeFractionalSeconds(timestamp));
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return buildFormatter(settings).format(date);
}
