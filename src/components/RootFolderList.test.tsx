import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RootFolderList, type RootFolder } from "./RootFolderList";
import { makeFolderTree } from "../test/fixtures";

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

  it("nests the active folder's tree under its own item, not the others", () => {
    render(
      <RootFolderList
        folders={folders}
        activeFolder="/logs/web74"
        activeFolderTree={makeFolderTree()}
        onAddFolder={vi.fn()}
        onSelectFolder={vi.fn()}
        onSelectLogFolder={vi.fn()}
      />,
    );

    const web74Item = screen.getByText("/logs/web74").closest("li");
    const web84Item = screen.getByText("/logs/web84").closest("li");

    expect(web74Item).toHaveTextContent("blocking");
    expect(web84Item).not.toHaveTextContent("blocking");
  });

  it("shows a scanning placeholder for the active folder while its tree loads", () => {
    render(
      <RootFolderList
        folders={folders}
        activeFolder="/logs/web74"
        activeFolderTree={null}
        onAddFolder={vi.fn()}
        onSelectFolder={vi.fn()}
        onSelectLogFolder={vi.fn()}
      />,
    );

    expect(screen.getByText(/wordt gescand/i)).toBeInTheDocument();
  });

  it("shows an unavailable badge for a folder whose path no longer exists", () => {
    const mixedFolders: RootFolder[] = [
      { path: "/logs/web74", available: true },
      { path: "/logs/web84", available: false },
    ];
    render(
      <RootFolderList
        folders={mixedFolders}
        onAddFolder={vi.fn()}
        onSelectFolder={vi.fn()}
      />,
    );

    const availableItem = screen.getByText("/logs/web74").closest("li");
    const unavailableItem = screen.getByText("/logs/web84").closest("li");

    expect(unavailableItem).toHaveTextContent(/niet beschikbaar/i);
    expect(availableItem).not.toHaveTextContent(/niet beschikbaar/i);
  });

  it("removes a folder immediately on click, without a confirmation step", async () => {
    const onRemoveFolder = vi.fn();
    render(
      <RootFolderList
        folders={folders}
        onAddFolder={vi.fn()}
        onSelectFolder={vi.fn()}
        onRemoveFolder={onRemoveFolder}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /web84 verwijderen/i }),
    );

    expect(onRemoveFolder).toHaveBeenCalledWith("/logs/web84");
    expect(onRemoveFolder).toHaveBeenCalledTimes(1);
  });

  it("shows a custom display name instead of the folder's own name when set", () => {
    const namedFolders: RootFolder[] = [
      { path: "/logs/web74", available: true, displayName: "Productie" },
    ];
    render(
      <RootFolderList
        folders={namedFolders}
        onAddFolder={vi.fn()}
        onSelectFolder={vi.fn()}
      />,
    );

    expect(screen.getByText("Productie")).toBeInTheDocument();
    expect(screen.queryByText("web74")).not.toBeInTheDocument();
  });

  it("edits the display name inline and commits on Enter", async () => {
    const onRenameFolder = vi.fn();
    render(
      <RootFolderList
        folders={folders}
        onAddFolder={vi.fn()}
        onSelectFolder={vi.fn()}
        onRenameFolder={onRenameFolder}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /web74 hernoemen/i }),
    );
    const input = screen.getByDisplayValue("web74");
    await userEvent.clear(input);
    await userEvent.type(input, "Productie{Enter}");

    expect(onRenameFolder).toHaveBeenCalledWith("/logs/web74", "Productie");
  });

  it("clears the display name when the rename field is emptied", async () => {
    const onRenameFolder = vi.fn();
    const namedFolders: RootFolder[] = [
      { path: "/logs/web74", available: true, displayName: "Productie" },
    ];
    render(
      <RootFolderList
        folders={namedFolders}
        onAddFolder={vi.fn()}
        onSelectFolder={vi.fn()}
        onRenameFolder={onRenameFolder}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /productie hernoemen/i }),
    );
    const input = screen.getByDisplayValue("Productie");
    await userEvent.clear(input);
    await userEvent.type(input, "{Enter}");

    expect(onRenameFolder).toHaveBeenCalledWith("/logs/web74", null);
  });

  it("cancels the edit on Escape without committing the in-progress value", async () => {
    const onRenameFolder = vi.fn();
    render(
      <RootFolderList
        folders={folders}
        onAddFolder={vi.fn()}
        onSelectFolder={vi.fn()}
        onRenameFolder={onRenameFolder}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /web74 hernoemen/i }),
    );
    const input = screen.getByDisplayValue("web74");
    await userEvent.clear(input);
    await userEvent.type(input, "Onbedoelde naam{Escape}");

    expect(onRenameFolder).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /web74 hernoemen/i }),
    ).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Onbedoelde naam")).not.toBeInTheDocument();
  });
});
