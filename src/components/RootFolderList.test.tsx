import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RootFolderList, type RootFolder } from "./RootFolderList";

const folders: RootFolder[] = [
  { path: "/logs/web74", available: true },
  { path: "/logs/web84", available: true },
];

describe("RootFolderList", () => {
  it("renders the add-folder button", () => {
    render(
      <RootFolderList folders={[]} onAddFolder={vi.fn()} onSelectFolder={vi.fn()} />,
    );

    expect(
      screen.getByRole("button", { name: /map toevoegen/i }),
    ).toBeInTheDocument();
  });

  it("renders every folder passed in props", () => {
    render(
      <RootFolderList folders={folders} onAddFolder={vi.fn()} onSelectFolder={vi.fn()} />,
    );

    expect(screen.getByText("/logs/web74")).toBeInTheDocument();
    expect(screen.getByText("/logs/web84")).toBeInTheDocument();
  });

  it("calls onSelectFolder with the clicked folder's path", async () => {
    const onSelectFolder = vi.fn();
    render(
      <RootFolderList
        folders={folders}
        onAddFolder={vi.fn()}
        onSelectFolder={onSelectFolder}
      />,
    );

    await userEvent.click(screen.getByText("/logs/web84"));

    expect(onSelectFolder).toHaveBeenCalledWith("/logs/web84");
  });
});
