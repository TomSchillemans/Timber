export interface RootFolder {
  path: string;
  available: boolean;
}

interface RootFolderListProps {
  folders: RootFolder[];
  activeFolder?: string | null;
  onAddFolder: () => void;
  onSelectFolder: (path: string) => void;
}

function folderName(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path;
}

export function RootFolderList({
  folders,
  activeFolder,
  onAddFolder,
  onSelectFolder,
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
          {folders.map((folder) => (
            <li key={folder.path} className="folder-list__item">
              <button
                className={
                  "folder-list__button" +
                  (folder.path === activeFolder
                    ? " folder-list__button--active"
                    : "")
                }
                onClick={() => onSelectFolder(folder.path)}
                title={folder.path}
              >
                <span className="folder-list__name">
                  {folderName(folder.path)}
                </span>
                <span className="folder-list__path">{folder.path}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
