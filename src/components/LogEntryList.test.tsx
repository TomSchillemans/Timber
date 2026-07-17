import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LogEntryList, type LogEntry } from "./LogEntryList";

const entries: LogEntry[] = [
  {
    timestamp: "2026-07-17T10:00:00Z",
    level: "info",
    node: "web02",
    message: "started",
    extraFields: { userId: 42 },
  },
  {
    timestamp: null,
    level: null,
    node: null,
    message: "no timestamp or level",
    extraFields: {},
  },
  {
    timestamp: "2026-07-17T10:05:00Z",
    level: "CRITICAL",
    node: "web02",
    message: "something broke",
    extraFields: {},
  },
];

describe("LogEntryList", () => {
  it("renders timestamp, level and message for each entry", () => {
    render(<LogEntryList entries={entries} />);

    expect(screen.getByText("2026-07-17T10:00:00Z")).toBeInTheDocument();
    expect(screen.getByText("info")).toBeInTheDocument();
    expect(screen.getByText("started")).toBeInTheDocument();
  });

  it("shows a placeholder instead of crashing when timestamp/level are missing", () => {
    render(<LogEntryList entries={entries} />);

    expect(screen.getByText("no timestamp or level")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("shows an empty state when there are no entries", () => {
    render(<LogEntryList entries={[]} />);

    expect(screen.getByText(/geen logregels/i)).toBeInTheDocument();
  });

  it("shows the detail view with extra fields when a row is clicked", async () => {
    render(<LogEntryList entries={entries} />);

    await userEvent.click(screen.getByText("started"));

    expect(screen.getByText(/"userId": 42/)).toBeInTheDocument();
  });

  it("hides the detail view again on a second click", async () => {
    render(<LogEntryList entries={entries} />);

    await userEvent.click(screen.getByText("started"));
    expect(screen.getByText(/"userId": 42/)).toBeInTheDocument();

    await userEvent.click(screen.getByText("started"));
    expect(screen.queryByText(/"userId": 42/)).not.toBeInTheDocument();
  });

  it("renders the node when present", () => {
    render(<LogEntryList entries={entries} />);

    expect(screen.getAllByText("web02").length).toBe(2);
  });

  it("marks a critical/error-level entry so it visually stands out", () => {
    render(<LogEntryList entries={entries} />);

    const criticalRow = screen.getByText("something broke").closest("button");
    const infoRow = screen.getByText("started").closest("button");

    expect(criticalRow).toHaveClass("log-entry-list__row--severe");
    expect(infoRow).not.toHaveClass("log-entry-list__row--severe");
  });
});
