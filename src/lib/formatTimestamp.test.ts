import { describe, expect, it } from "vitest";
import { formatTimestamp } from "./formatTimestamp";
import { DEFAULT_DATE_FORMAT_SETTINGS } from "./dateFormatSettings";

const CUSTOM_NL_SETTINGS = {
  mode: "custom" as const,
  monthStyle: "short" as const,
  hourCycle: "h23" as const,
  showSeconds: true,
};

describe("formatTimestamp", () => {
  it("formats a plain ISO timestamp into a compact readable form (custom mode)", () => {
    expect(
      formatTimestamp("2026-07-17T10:00:00Z", CUSTOM_NL_SETTINGS),
    ).toMatch(/17 jul\.? 2026, \d{2}:\d{2}:\d{2}/);
  });

  it("formats a Monolog-style timestamp with microseconds and a timezone offset", () => {
    expect(
      formatTimestamp("2026-07-14T09:58:15.476491+02:00", CUSTOM_NL_SETTINGS),
    ).toMatch(/14 jul\.? 2026, \d{2}:\d{2}:\d{2}/);
  });

  it("omits seconds when showSeconds is false", () => {
    const result = formatTimestamp("2026-07-17T10:00:00Z", {
      ...CUSTOM_NL_SETTINGS,
      showSeconds: false,
    });

    expect(result).not.toMatch(/:\d{2}:\d{2}/);
  });

  it("uses the OS-locale default when mode is system, without crashing", () => {
    const result = formatTimestamp("2026-07-17T10:00:00Z", {
      ...DEFAULT_DATE_FORMAT_SETTINGS,
      mode: "system",
    });

    expect(result).toContain("2026");
    expect(result).not.toBe("2026-07-17T10:00:00Z");
  });

  it("returns a placeholder for a missing timestamp", () => {
    expect(formatTimestamp(null)).toBe("—");
  });

  it("falls back to the raw string for unparseable input", () => {
    expect(formatTimestamp("not a date")).toBe("not a date");
  });
});
