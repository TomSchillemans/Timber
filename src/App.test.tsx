import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { RootFolder } from "./components/RootFolderList";
import type { FolderNode } from "./components/FolderTree";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

const folders: RootFolder[] = [{ path: "/logs/web74", available: true }];
const tree: FolderNode = {
  path: "/logs/web74",
  name: "web74",
  hasLogFiles: false,
  children: [
    {
      path: "/logs/web74/database",
      name: "database",
      hasLogFiles: true,
      children: [],
    },
  ],
};

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
      return Promise.reject(new Error(`unexpected command: ${cmd}`));
    });
  });

  it("scans and renders the tree after selecting a root folder", async () => {
    render(<App />);

    await userEvent.click(await screen.findByText("/logs/web74"));

    expect(await screen.findByText("database")).toBeInTheDocument();
  });
});
