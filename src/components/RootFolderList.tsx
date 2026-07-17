import { FolderTree, type FolderNode } from "./FolderTree";

export interface RootFolder {
  path: string;
  available: boolean;
}

interface RootFolderListProps {
  folders: RootFolder[];
  activeFolder?: string | null;
  activeFolderTree?: FolderNode | null;
  selectedLogFolder?: string | null;
  onAddFolder: () => void;
  onSelectFolder: (path: string) => void;
  onSelectLogFolder?: (path: string) => void;
}

function folderName(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path;
}

export function RootFolderList({
  folders,
  activeFolder,
  activeFolderTree,
  selectedLogFolder,
  onAddFolder,
  onSelectFolder,
  onSelectLogFolder,
}: RootFolderListProps) {
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
            return (
              <li key={folder.path} className="folder-list__item">
                <button
                  className={
                    "folder-list__button" +
                    (isActive ? " folder-list__button--active" : "")
                  }
                  onClick={() => onSelectFolder(folder.path)}
                  title={folder.path}
                >
                  <span className="folder-list__name">
                    {folderName(folder.path)}
                  </span>
                  <span className="folder-list__path">{folder.path}</span>
                </button>
                {isActive &&
                  (activeFolderTree ? (
                    activeFolderTree.children.length > 0 && (
                      <ul className="folder-tree folder-tree--nested">
                        {activeFolderTree.children.map((child) => (
                          <FolderTree
                            key={child.path}
                            node={child}
                            selectedPath={selectedLogFolder}
                            onSelectFolder={onSelectLogFolder ?? (() => {})}
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
