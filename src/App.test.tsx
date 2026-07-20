import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { RootFolder } from "./components/RootFolderList";
import { makeFolderTree } from "./test/fixtures";
import { DEFAULT_DATE_FORMAT_SETTINGS } from "./lib/dateFormatSettings";

const { listenHandlers } = vi.hoisted(() => ({
  listenHandlers: {} as Record<
    string,
    Array<(event: { payload: unknown }) => void>
  >,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(
    (event: string, handler: (event: { payload: unknown }) => void) => {
      (listenHandlers[event] ??= []).push(handler);
      return Promise.resolve(() => {
        listenHandlers[event] = (listenHandlers[event] ?? []).filter(
          (h) => h !== handler,
        );
      });
    },
  ),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: vi.fn(() => Promise.resolve(true)),
  requestPermission: vi.fn(() => Promise.resolve("granted")),
  sendNotification: vi.fn(),
}));

function emitTestEvent(event: string, payload: unknown) {
  (listenHandlers[event] ?? []).forEach((handler) => handler({ payload }));
}

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
    remove_root_folder: [],
    rename_root_folder: folders,
    watch_log_folder: undefined,
    stop_watching: undefined,
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
    Object.keys(listenHandlers).forEach((key) => delete listenHandlers[key]);
    vi.clearAllMocks();
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

  it("removing the active folder returns to the empty state", async () => {
    await mockInvoke({ remove_root_folder: [] });

    render(<App />);

    await userEvent.click(await screen.findByText("/logs/web74"));
    expect(await screen.findByText("database")).toBeInTheDocument();

    await userEvent.click(
      await screen.findByRole("button", { name: /web74 verwijderen/i }),
    );

    expect(
      await screen.findByText(/selecteer een map om te beginnen/i),
    ).toBeInTheDocument();
  });

  it("removing the active folder while a log folder is selected also clears the log view", async () => {
    await mockInvoke({ remove_root_folder: [] });

    render(<App />);

    await userEvent.click(await screen.findByText("/logs/web74"));
    await userEvent.click(await screen.findByText("database"));
    expect(await screen.findByText("database started")).toBeInTheDocument();

    await userEvent.click(
      await screen.findByRole("button", { name: /web74 verwijderen/i }),
    );

    expect(screen.queryByText("database started")).not.toBeInTheDocument();
    expect(
      await screen.findByText(/selecteer een map om te beginnen/i),
    ).toBeInTheDocument();
  });

  it("removing a root folder does not stop tailing a sibling whose name is a prefix (e.g. web7 vs web74)", async () => {
    await mockInvoke({
      list_root_folders: [
        { path: "/logs/web7", available: true },
        { path: "/logs/web74", available: true },
      ],
      remove_root_folder: [{ path: "/logs/web74", available: true }],
    });
    const { invoke } = await import("@tauri-apps/api/core");

    render(<App />);

    await userEvent.click(await screen.findByText("/logs/web74"));
    await userEvent.click(await screen.findByText("database"));
    await userEvent.click(
      await screen.findByRole("button", { name: /^live volgen$/i }),
    );
    expect(invoke).toHaveBeenCalledWith(
      "watch_log_folder",
      expect.objectContaining({
        folder: expect.stringContaining("database"),
        dates: [],
      }),
    );

    // Removing "/logs/web7" must not be treated as an ancestor of
    // "/logs/web74/..." just because the path string "web7" is a prefix
    // of "web74" — the folders are unrelated siblings.
    await userEvent.click(
      await screen.findByRole("button", { name: "web7 verwijderen" }),
    );

    const databaseRow = screen.getByText("database").closest("li");
    expect(
      databaseRow?.querySelector(".live-tail-indicator--active"),
    ).not.toBeNull();
    expect(invoke).not.toHaveBeenCalledWith(
      "stop_watching",
      expect.objectContaining({
        folder: expect.stringContaining("database"),
      }),
    );
  });

  it("does not watch automatically — live-tailing starts off until the toggle is clicked", async () => {
    const { invoke } = await import("@tauri-apps/api/core");

    render(<App />);

    await userEvent.click(await screen.findByText("/logs/web74"));
    await userEvent.click(await screen.findByText("database"));

    const toggle = await screen.findByRole("button", {
      name: /^live volgen$/i,
    });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(invoke).not.toHaveBeenCalledWith(
      "watch_log_folder",
      expect.anything(),
    );

    await userEvent.click(toggle);

    expect(invoke).toHaveBeenCalledWith(
      "watch_log_folder",
      expect.objectContaining({
        folder: expect.stringContaining("database"),
        dates: [],
      }),
    );
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  it("disables the toggle and turns tailing off when an older day is selected", async () => {
    await mockInvoke({ log_file_dates: ["2026-07-16", "2026-07-14"] });
    const { invoke } = await import("@tauri-apps/api/core");

    render(<App />);

    await userEvent.click(await screen.findByText("/logs/web74"));
    await userEvent.click(await screen.findByText("database"));

    const toggle = await screen.findByRole("button", {
      name: /^live volgen$/i,
    });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(
      await screen.findByRole("button", { name: /2026-07-16/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: "16" }));
    await userEvent.click(screen.getByRole("button", { name: "14" }));

    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toBeDisabled();
    expect(invoke).toHaveBeenCalledWith(
      "stop_watching",
      expect.objectContaining({
        folder: expect.stringContaining("database"),
      }),
    );
  });

  it("tags stop_watching with a higher seq than an in-flight watch_log_folder for the same folder", async () => {
    // Regression test: the day-filter-off effect used to call stop_watching
    // directly, racing an in-flight watch_log_folder for the same folder —
    // if the backend applied them out of issuance order, the watcher could
    // survive despite the UI showing tailing as off. The backend now
    // resolves this by seq (see log_watcher.rs), and the frontend's
    // responsibility is to always assign a strictly increasing seq in
    // issuance order — this test locks in that contract.
    await mockInvoke({ log_file_dates: ["2026-07-16", "2026-07-14"] });
    const { invoke } = await import("@tauri-apps/api/core");

    render(<App />);

    await userEvent.click(await screen.findByText("/logs/web74"));
    await userEvent.click(await screen.findByText("database"));

    const toggle = await screen.findByRole("button", {
      name: /^live volgen$/i,
    });
    await userEvent.click(toggle);

    await userEvent.click(
      await screen.findByRole("button", { name: /2026-07-16/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: "16" }));
    await userEvent.click(screen.getByRole("button", { name: "14" }));

    const watchCall = vi
      .mocked(invoke)
      .mock.calls.find(([command]) => command === "watch_log_folder");
    const stopCall = vi
      .mocked(invoke)
      .mock.calls.find(([command]) => command === "stop_watching");
    expect(watchCall).toBeDefined();
    expect(stopCall).toBeDefined();
    const watchSeq = (watchCall?.[1] as { seq: number }).seq;
    const stopSeq = (stopCall?.[1] as { seq: number }).seq;
    expect(stopSeq).toBeGreaterThan(watchSeq);
  });

  it("shows a live-tail dot next to the folder in the sidebar once enabled", async () => {
    render(<App />);

    await userEvent.click(await screen.findByText("/logs/web74"));
    await userEvent.click(await screen.findByText("database"));

    const databaseRow = screen.getByText("database").closest("li");
    expect(
      databaseRow?.querySelector(".live-tail-indicator--active"),
    ).toBeNull();

    await userEvent.click(
      await screen.findByRole("button", { name: /^live volgen$/i }),
    );

    expect(
      databaseRow?.querySelector(".live-tail-indicator--active"),
    ).not.toBeNull();
  });

  it("updates the log view when a log-entries-updated event arrives for the current folder", async () => {
    render(<App />);

    await userEvent.click(await screen.findByText("/logs/web74"));
    await userEvent.click(await screen.findByText("database"));
    expect(await screen.findByText("database started")).toBeInTheDocument();

    emitTestEvent("log-entries-updated", {
      folder: "/logs/web74/blocking/database",
      entries: [
        {
          timestamp: "2026-07-17T10:05:00Z",
          level: "info",
          node: null,
          message: "a new line arrived",
          extraFields: {},
        },
      ],
    });

    expect(await screen.findByText("a new line arrived")).toBeInTheDocument();
  });

  it("ignores a log-entries-updated event for a different folder", async () => {
    render(<App />);

    await userEvent.click(await screen.findByText("/logs/web74"));
    await userEvent.click(await screen.findByText("database"));
    expect(await screen.findByText("database started")).toBeInTheDocument();

    emitTestEvent("log-entries-updated", {
      folder: "/logs/web74/blocking/errors",
      entries: [
        {
          timestamp: "2026-07-17T10:05:00Z",
          level: "error",
          node: null,
          message: "should not appear",
          extraFields: {},
        },
      ],
    });

    expect(screen.queryByText("should not appear")).not.toBeInTheDocument();
    expect(screen.getByText("database started")).toBeInTheDocument();
  });

  it("keeps tailing a folder in the background after switching to a different one", async () => {
    const { invoke } = await import("@tauri-apps/api/core");

    render(<App />);

    await userEvent.click(await screen.findByText("/logs/web74"));
    await userEvent.click(await screen.findByText("database"));
    await userEvent.click(
      await screen.findByRole("button", { name: /^live volgen$/i }),
    );
    expect(invoke).toHaveBeenCalledWith(
      "watch_log_folder",
      expect.objectContaining({
        folder: expect.stringContaining("database"),
        dates: [],
      }),
    );

    await userEvent.click(await screen.findByText("errors"));

    const databaseRow = screen.getByText("database").closest("li");
    expect(
      databaseRow?.querySelector(".live-tail-indicator--active"),
    ).not.toBeNull();
    // stop_watching was never called for the database folder just because
    // we navigated away from it.
    expect(invoke).not.toHaveBeenCalledWith(
      "stop_watching",
      expect.objectContaining({
        folder: expect.stringContaining("database"),
      }),
    );
  });

  it("toggles live-tail on a folder from the sidebar without opening it", async () => {
    const { invoke } = await import("@tauri-apps/api/core");

    render(<App />);

    await userEvent.click(await screen.findByText("/logs/web74"));
    await userEvent.click(await screen.findByText("database"));

    await userEvent.click(
      await screen.findByRole("button", {
        name: /live volgen errors aanzetten/i,
      }),
    );

    expect(invoke).toHaveBeenCalledWith("log_file_dates", {
      folder: expect.stringContaining("errors"),
    });
    expect(invoke).toHaveBeenCalledWith(
      "watch_log_folder",
      expect.objectContaining({
        folder: expect.stringContaining("errors"),
        dates: [],
      }),
    );
    // The open folder (database) is untouched.
    expect(screen.getByText("database started")).toBeInTheDocument();
  });

  it("notifies (native + in-app) for a background folder's new entry, not the open one", async () => {
    const { sendNotification } = await import(
      "@tauri-apps/plugin-notification"
    );

    render(<App />);

    await userEvent.click(await screen.findByText("/logs/web74"));
    await userEvent.click(await screen.findByText("database"));
    await userEvent.click(
      await screen.findByRole("button", {
        name: /live volgen errors aanzetten/i,
      }),
    );

    emitTestEvent("log-entries-updated", {
      folder: "/logs/web74/blocking/database",
      entries: [
        {
          timestamp: "2026-07-17T10:05:00Z",
          level: "info",
          node: null,
          message: "open folder update",
          extraFields: {},
        },
      ],
    });
    expect(sendNotification).not.toHaveBeenCalled();

    emitTestEvent("log-entries-updated", {
      folder: "/logs/web74/blocking/errors",
      entries: [
        {
          timestamp: "2026-07-17T10:05:00Z",
          level: "error",
          node: null,
          message: "boom",
          extraFields: {},
        },
      ],
    });

    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining("errors") }),
    );
    expect(
      await screen.findByText(/nieuwe activiteit in.*errors/i),
    ).toBeInTheDocument();
  });

  it("does not send a second notification for the same folder within the cooldown window", async () => {
    const { sendNotification } = await import(
      "@tauri-apps/plugin-notification"
    );

    render(<App />);

    await userEvent.click(await screen.findByText("/logs/web74"));
    await userEvent.click(await screen.findByText("database"));
    await userEvent.click(
      await screen.findByRole("button", {
        name: /live volgen errors aanzetten/i,
      }),
    );

    const event = {
      folder: "/logs/web74/blocking/errors",
      entries: [
        {
          timestamp: "2026-07-17T10:05:00Z",
          level: "error",
          node: null,
          message: "first",
          extraFields: {},
        },
      ],
    };
    emitTestEvent("log-entries-updated", event);
    emitTestEvent("log-entries-updated", { ...event, entries: [] });

    expect(sendNotification).toHaveBeenCalledTimes(1);
  });

  it("navigates to the folder when a toast's action is clicked", async () => {
    render(<App />);

    await userEvent.click(await screen.findByText("/logs/web74"));
    await userEvent.click(await screen.findByText("database"));
    await userEvent.click(
      await screen.findByRole("button", {
        name: /live volgen errors aanzetten/i,
      }),
    );

    emitTestEvent("log-entries-updated", {
      folder: "/logs/web74/blocking/errors",
      entries: [
        {
          timestamp: "2026-07-17T10:05:00Z",
          level: "error",
          node: null,
          message: "boom",
          extraFields: {},
        },
      ],
    });

    await userEvent.click(
      await screen.findByRole("button", { name: /ga naar map/i }),
    );

    expect(
      await screen.findByText("/logs/web74/blocking/errors"),
    ).toBeInTheDocument();
  });
});
