import { describe, expect, it } from "vitest";
import { clampSidebarWidth } from "./sidebarWidth";

describe("clampSidebarWidth", () => {
  it("returns the width unchanged when within bounds", () => {
    expect(clampSidebarWidth(300, 180, 480)).toBe(300);
  });

  it("clamps to the minimum when below it", () => {
    expect(clampSidebarWidth(50, 180, 480)).toBe(180);
  });

  it("clamps to the maximum when above it", () => {
    expect(clampSidebarWidth(900, 180, 480)).toBe(480);
  });
});
