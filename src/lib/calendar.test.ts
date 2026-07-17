import { describe, expect, it } from "vitest";
import { buildMonthGrid, monthLabel } from "./calendar";

describe("buildMonthGrid", () => {
  it("returns a whole number of weeks covering every day of the month", () => {
    const cells = buildMonthGrid(2026, 7);

    expect(cells.length % 7).toBe(0);
    const currentMonthDates = cells
      .filter((c) => c.inCurrentMonth)
      .map((c) => c.date);
    expect(currentMonthDates).toContain("2026-07-01");
    expect(currentMonthDates).toContain("2026-07-31");
    expect(currentMonthDates).toHaveLength(31);
  });

  it("pads leading/trailing cells with adjacent-month dates marked as outside", () => {
    const cells = buildMonthGrid(2026, 7);

    const outside = cells.filter((c) => !c.inCurrentMonth);
    for (const cell of outside) {
      expect(cell.date.startsWith("2026-07")).toBe(false);
    }
  });
});

describe("monthLabel", () => {
  it("formats a Dutch month name with the year", () => {
    expect(monthLabel(2026, 7)).toBe("juli 2026");
  });
});
