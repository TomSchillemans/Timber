export type DateFormatMode = "system" | "custom";
export type MonthStyle = "numeric" | "short" | "long";
export type HourCycle = "h23" | "h12";

export interface DateFormatSettings {
  mode: DateFormatMode;
  monthStyle: MonthStyle;
  hourCycle: HourCycle;
  showSeconds: boolean;
}

/**
 * Mirrors `DateFormatSettings::default()` in `src-tauri/src/settings.rs` —
 * "system" (OS-locale conventions) is the recommended default, not a fixed
 * format.
 */
export const DEFAULT_DATE_FORMAT_SETTINGS: DateFormatSettings = {
  mode: "system",
  monthStyle: "short",
  hourCycle: "h23",
  showSeconds: true,
};

export const DATE_FORMAT_CHANGED_EVENT = "date-format-changed";
