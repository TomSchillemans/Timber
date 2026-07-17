import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LogEntryList, type LogEntry } from "./LogEntryList";

const entries: LogEntry[] = [
  {
    timestamp: "2026-07-17T10:00:00Z",
    level: "info",
    message: "started",
    extraFields: { userId: 42 },
  },
  {
    timestamp: null,
    level: null,
    message: "no timestamp or level",
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
});
