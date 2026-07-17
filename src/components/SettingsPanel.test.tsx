import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPanel } from "./SettingsPanel";
import { DEFAULT_DATE_FORMAT_SETTINGS } from "../lib/dateFormatSettings";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn(),
}));

describe("SettingsPanel", () => {
  beforeEach(async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_date_format_settings") {
        return Promise.resolve(DEFAULT_DATE_FORMAT_SETTINGS);
      }
      if (cmd === "save_date_format_settings") {
        return Promise.resolve(undefined);
      }
      return Promise.reject(new Error(`unexpected command: ${cmd}`));
    });
  });

  it("defaults to system mode and hides custom fields", async () => {
    render(<SettingsPanel />);

    expect(
      await screen.findByRole("radio", { name: /systeem/i }),
    ).toBeChecked();
    expect(
      screen.queryByRole("combobox", { name: /maandweergave/i }),
    ).not.toBeInTheDocument();
  });

  it("shows custom fields and saves + broadcasts on switching to custom mode", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const { emit } = await import("@tauri-apps/api/event");
    render(<SettingsPanel />);

    await userEvent.click(
      await screen.findByRole("radio", { name: /aangepast/i }),
    );

    expect(
      screen.getByRole("combobox", { name: /maandweergave/i }),
    ).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("save_date_format_settings", {
      settings: { ...DEFAULT_DATE_FORMAT_SETTINGS, mode: "custom" },
    });
    expect(emit).toHaveBeenCalledWith("date-format-changed", {
      ...DEFAULT_DATE_FORMAT_SETTINGS,
      mode: "custom",
    });
  });

  it("toggles the seconds checkbox", async () => {
    render(<SettingsPanel />);

    await userEvent.click(
      await screen.findByRole("radio", { name: /aangepast/i }),
    );
    const secondsCheckbox = screen.getByRole("checkbox", {
      name: /seconden/i,
    });
    expect(secondsCheckbox).toBeChecked();

    await userEvent.click(secondsCheckbox);

    expect(secondsCheckbox).not.toBeChecked();
  });
});
