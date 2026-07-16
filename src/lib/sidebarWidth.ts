export const SIDEBAR_MIN_WIDTH = 180;
export const SIDEBAR_MAX_WIDTH = 480;

export function clampSidebarWidth(
  width: number,
  min: number = SIDEBAR_MIN_WIDTH,
  max: number = SIDEBAR_MAX_WIDTH,
): number {
  return Math.min(Math.max(width, min), max);
}
