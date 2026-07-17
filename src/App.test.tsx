import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { RootFolder } from "./components/RootFolderList";
import { makeFolderTree } from "./test/fixtures";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
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

describe("App", () => {
  beforeEach(async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "list_root_folders") {
        return Promise.resolve(folders);
      }
      if (cmd === "folder_scanner") {
        return Promise.resolve(tree);
      }
      if (cmd === "log_parser") {
        return Promise.resolve(logEntries);
      }
      if (cmd === "log_file_dates") {
        return Promise.resolve([]);
      }
      return Promise.reject(new Error(`unexpected command: ${cmd}`));
    });
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
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "list_root_folders") {
        return Promise.resolve(folders);
      }
      if (cmd === "folder_scanner") {
        return Promise.resolve(tree);
      }
      if (cmd === "log_parser") {
        return Promise.resolve(logEntries);
      }
      if (cmd === "log_file_dates") {
        return Promise.resolve(["2026-07-16", "2026-07-14"]);
      }
      return Promise.reject(new Error(`unexpected command: ${cmd}`));
    });

    render(<App />);

    await userEvent.click(await screen.findByText("/logs/web74"));
    await userEvent.click(await screen.findByText("database"));

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
});
