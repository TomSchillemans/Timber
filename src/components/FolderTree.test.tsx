import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FolderTree } from "./FolderTree";
import { makeFolderTree } from "../test/fixtures";

const tree = makeFolderTree();

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

  it("marks a node with log files as selectable, and one without as not", () => {
    render(<FolderTree node={tree} onSelectFolder={vi.fn()} />);

    expect(screen.getByText("database").closest("button")).toHaveClass(
      "folder-tree__label--selectable",
    );
    expect(screen.getByText("blocking").closest("button")).not.toHaveClass(
      "folder-tree__label--selectable",
    );
  });

  it("highlights the currently selected log folder", () => {
    render(
      <FolderTree
        node={tree}
        selectedPath="/logs/web74/blocking/database"
        onSelectFolder={vi.fn()}
      />,
    );

    expect(screen.getByText("database").closest("button")).toHaveClass(
      "folder-tree__label--selected",
    );
    expect(screen.getByText("blocking").closest("button")).not.toHaveClass(
      "folder-tree__label--selected",
    );
  });
});
