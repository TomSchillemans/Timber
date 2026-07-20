import { useRef, useState } from "react";
import { FolderTree, type FolderNode } from "./FolderTree";
import { folderName } from "../lib/folderName";

export interface RootFolder {
  path: string;
  available: boolean;
  displayName?: string | null;
}

interface RootFolderListProps {
  folders: RootFolder[];
  activeFolder?: string | null;
  activeFolderTree?: FolderNode | null;
  selectedLogFolder?: string | null;
  onAddFolder: () => void;
  onSelectFolder: (path: string) => void;
  onSelectLogFolder?: (path: string) => void;
  onRemoveFolder?: (path: string) => void;
  onRenameFolder?: (path: string, displayName: string | null) => void;
  liveTailingPaths?: string[];
  onToggleLiveTail?: (path: string) => void;
}

export function RootFolderList({
  folders,
  activeFolder,
  activeFolderTree,
  selectedLogFolder,
  onAddFolder,
  onSelectFolder,
  onSelectLogFolder,
  onRemoveFolder,
  onRenameFolder,
  liveTailingPaths,
  onToggleLiveTail,
}: RootFolderListProps) {
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  // Mirrors `editingPath`, but as a ref so the guards below always see the
  // latest value even when read from a handler created in the same render
  // (React state is a stable snapshot per render, so comparing against the
  // `editingPath` *state* variable inside such a handler can never detect
  // a commit/cancel that already happened moments earlier in that same
  // render's closures). Needed because removing a focused input from the
  // DOM (Enter/Escape swaps it back out for the button) can make the
  // browser fire a trailing `blur`, which would otherwise re-run
  // `commitEdit` a second time - or, worse, override an Escape-cancel with
  // a stale commit.
  const activeEditRef = useRef<string | null>(null);

  function startEditing(folder: RootFolder) {
    activeEditRef.current = folder.path;
    setEditingPath(folder.path);
    setEditValue(folder.displayName ?? folderName(folder.path));
  }

  function cancelEdit(path: string) {
    if (activeEditRef.current !== path) {
      return;
    }
    activeEditRef.current = null;
    setEditingPath(null);
  }

  function commitEdit(path: string) {
    if (activeEditRef.current !== path) {
      return;
    }
    activeEditRef.current = null;
    setEditingPath(null);
    onRenameFolder?.(path, editValue.trim() || null);
  }

  return (
    <div className="folder-panel">
      <button className="add-folder-btn" onClick={onAddFolder}>
        <span className="add-folder-btn__glyph" aria-hidden="true">
          +
        </span>
        Map toevoegen
      </button>

      {folders.length === 0 ? (
        <p className="folder-list__empty">Nog geen mappen toegevoegd.</p>
      ) : (
        <ul className="folder-list">
          {folders.map((folder) => {
            const isActive = folder.path === activeFolder;
            const label = folder.displayName ?? folderName(folder.path);
            const isEditing = editingPath === folder.path;

            return (
              <li key={folder.path} className="folder-list__item">
                <div className="folder-list__row">
                  {isEditing ? (
                    <input
                      className="folder-list__name-input"
                      value={editValue}
                      autoFocus
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          commitEdit(folder.path);
                        } else if (e.key === "Escape") {
                          cancelEdit(folder.path);
                        }
                      }}
                      onBlur={() => commitEdit(folder.path)}
                    />
                  ) : (
                    <button
                      className={
                        "folder-list__button" +
                        (isActive ? " folder-list__button--active" : "")
                      }
                      onClick={() =>
                        folder.available && onSelectFolder(folder.path)
                      }
                      disabled={!folder.available}
                      title={
                        folder.available
                          ? folder.path
                          : `${folder.path} (niet beschikbaar)`
                      }
                    >
                      <span className="folder-list__name">{label}</span>
                      <span className="folder-list__path">{folder.path}</span>
                      {!folder.available && (
                        <span className="folder-list__badge">
                          niet beschikbaar
                        </span>
                      )}
                    </button>
                  )}
                  {onRenameFolder && !isEditing && (
                    <button
                      type="button"
                      className="folder-list__action"
                      aria-label={`${label} hernoemen`}
                      onClick={() => startEditing(folder)}
                    >
                      ✎
                    </button>
                  )}
                  {onRemoveFolder && (
                    <button
                      type="button"
                      className="folder-list__action"
                      aria-label={`${label} verwijderen`}
                      onClick={() => onRemoveFolder(folder.path)}
                    >
                      ×
                    </button>
                  )}
                </div>
                {isActive &&
                  (activeFolderTree ? (
                    activeFolderTree.children.length > 0 && (
                      <ul className="folder-tree folder-tree--nested">
                        {activeFolderTree.children.map((child) => (
                          <FolderTree
                            key={child.path}
                            node={child}
                            selectedPath={selectedLogFolder}
                            liveTailingPaths={liveTailingPaths}
                            onSelectFolder={onSelectLogFolder ?? (() => {})}
                            onToggleLiveTail={onToggleLiveTail}
                          />
                        ))}
                      </ul>
                    )
                  ) : (
                    <p className="folder-list__scanning">Wordt gescand...</p>
                  ))}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
