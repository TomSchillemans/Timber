export interface RootFolder {
  path: string;
  available: boolean;
}

interface RootFolderListProps {
  folders: RootFolder[];
  onAddFolder: () => void;
  onSelectFolder: (path: string) => void;
}

export function RootFolderList({
  folders,
  onAddFolder,
  onSelectFolder,
}: RootFolderListProps) {
  return (
    <div>
      <button onClick={onAddFolder}>Map toevoegen</button>
      <ul>
        {folders.map((folder) => (
          <li key={folder.path}>
            <button onClick={() => onSelectFolder(folder.path)}>
              {folder.path}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
