import { describe, expect, it } from "vitest";
import { formatTimestamp } from "./formatTimestamp";

describe("formatTimestamp", () => {
  it("formats a plain ISO timestamp into a compact readable form", () => {
    expect(formatTimestamp("2026-07-17T10:00:00Z")).toMatch(
      /17 jul\.? 2026, \d{2}:\d{2}:\d{2}/,
    );
  });

  it("formats a Monolog-style timestamp with microseconds and a timezone offset", () => {
    expect(
      formatTimestamp("2026-07-14T09:58:15.476491+02:00"),
    ).toMatch(/14 jul\.? 2026, \d{2}:\d{2}:\d{2}/);
  });

  it("returns a placeholder for a missing timestamp", () => {
    expect(formatTimestamp(null)).toBe("—");
  });

  it("falls back to the raw string for unparseable input", () => {
    expect(formatTimestamp("not a date")).toBe("not a date");
  });
});
