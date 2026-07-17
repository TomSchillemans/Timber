import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FolderTree, type FolderNode } from "./FolderTree";

const tree: FolderNode = {
  path: "/logs/web74",
  name: "web74",
  hasLogFiles: false,
  children: [
    {
      path: "/logs/web74/blocking",
      name: "blocking",
      hasLogFiles: false,
      children: [
        {
          path: "/logs/web74/blocking/database",
          name: "database",
          hasLogFiles: true,
          children: [],
        },
      ],
    },
  ],
};

describe("FolderTree", () => {
  it("renders the root and all descendants expanded by default", () => {
    render(<FolderTree node={tree} onSelectFolder={vi.fn()} />);

    expect(screen.getByText("web74")).toBeInTheDocument();
    expect(screen.getByText("blocking")).toBeInTheDocument();
    expect(screen.getByText("database")).toBeInTheDocument();
  });

  it("collapses a node's children on click", async () => {
    render(<FolderTree node={tree} onSelectFolder={vi.fn()} />);

    await userEvent.click(screen.getByText("blocking"));

    expect(screen.queryByText("database")).not.toBeInTheDocument();
  });

  it("re-expands a collapsed node on a second click", async () => {
    render(<FolderTree node={tree} onSelectFolder={vi.fn()} />);

    await userEvent.click(screen.getByText("blocking"));
    expect(screen.queryByText("database")).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("blocking"));
    expect(screen.getByText("database")).toBeInTheDocument();
  });

  it("calls onSelectFolder when clicking a node with log files", async () => {
    const onSelectFolder = vi.fn();
    render(<FolderTree node={tree} onSelectFolder={onSelectFolder} />);

    await userEvent.click(screen.getByText("database"));

    expect(onSelectFolder).toHaveBeenCalledWith("/logs/web74/blocking/database");
  });

  it("does not call onSelectFolder when clicking a node without log files", async () => {
    const onSelectFolder = vi.fn();
    render(<FolderTree node={tree} onSelectFolder={onSelectFolder} />);

    await userEvent.click(screen.getByText("web74"));

    expect(onSelectFolder).not.toHaveBeenCalled();
  });
});
