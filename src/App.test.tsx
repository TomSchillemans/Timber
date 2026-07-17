import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { RootFolder } from "./components/RootFolderList";
import { makeFolderTree } from "./test/fixtures";
import { DEFAULT_DATE_FORMAT_SETTINGS } from "./lib/dateFormatSettings";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

const folders: RootFolder[] = [{ path: "/logs/web74", available: true }];
const tree = makeFolderTree();
const logEntries = [
  {
    timestamp: "2026-07-17T10:00:00Z",
    level: "info",
    node: null,
    message: "database started",
    extraFields: {},
  },
];

async function mockInvoke(overrides: Record<string, unknown> = {}) {
  const responses: Record<string, unknown> = {
    list_root_folders: folders,
    folder_scanner: tree,
    log_parser: logEntries,
    log_file_dates: [],
    get_date_format_settings: DEFAULT_DATE_FORMAT_SETTINGS,
    ...overrides,
  };
  const { invoke } = await import("@tauri-apps/api/core");
  vi.mocked(invoke).mockImplementation((command: string) => {
    if (command in responses) {
      return Promise.resolve(responses[command]);
    }
    return Promise.reject(new Error(`unexpected command: ${command}`));
  });
}

describe("App", () => {
  beforeEach(async () => {
    await mockInvoke();
  });

  it("scans and renders the tree after selecting a root folder", async () => {
    render(<App />);

    await userEvent.click(await screen.findByText("/logs/web74"));

    expect(await screen.findByText("database")).toBeInTheDocument();
  });

  it("parses and renders logs after selecting a folder with log files", async () => {
    render(<App />);

    await userEvent.click(await screen.findByText("/logs/web74"));
    await userEvent.click(await screen.findByText("database"));

    expect(await screen.findByText("database started")).toBeInTheDocument();
  });

  it("defaults the day filter to the most recent day and requests only that day", async () => {
    await mockInvoke({ log_file_dates: ["2026-07-16", "2026-07-14"] });
    const { invoke } = await import("@tauri-apps/api/core");

    render(<App />);

    await userEvent.click(await screen.findByText("/logs/web74"));
    await userEvent.click(await screen.findByText("database"));

    await userEvent.click(
      await screen.findByRole("button", { name: /2026-07-16/ }),
    );

    const mostRecent = await screen.findByRole("button", {
      name: "16",
      pressed: true,
    });
    const older = screen.getByRole("button", { name: "14", pressed: false });
    expect(mostRecent).toBeInTheDocument();
    expect(older).toBeInTheDocument();

    expect(invoke).toHaveBeenCalledWith("log_parser", {
      folder: expect.stringContaining("database"),
      dates: ["2026-07-16"],
    });
  });

  it("keeps the day filter calendar collapsed until its toggle is clicked", async () => {
    await mockInvoke({ log_file_dates: ["2026-07-16", "2026-07-14"] });

    render(<App />);

    await userEvent.click(await screen.findByText("/logs/web74"));
    await userEvent.click(await screen.findByText("database"));

    const toggle = await screen.findByRole("button", {
      name: /2026-07-16/,
    });
    expect(
      screen.queryByRole("button", { name: "16" }),
    ).not.toBeInTheDocument();

    await userEvent.click(toggle);
    expect(
      await screen.findByRole("button", { name: "16" }),
    ).toBeInTheDocument();
  });
});
