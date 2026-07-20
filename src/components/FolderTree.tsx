import { useState } from "react";

export interface FolderNode {
  path: string;
  name: string;
  hasLogFiles: boolean;
  children: FolderNode[];
}

interface FolderTreeProps {
  node: FolderNode;
  selectedPath?: string | null;
  liveTailingPaths?: string[];
  onSelectFolder: (path: string) => void;
  onToggleLiveTail?: (path: string) => void;
  pendingTogglePaths?: Set<string>;
}

export function FolderTree({
  node,
  selectedPath,
  liveTailingPaths,
  onSelectFolder,
  onToggleLiveTail,
  pendingTogglePaths,
}: FolderTreeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = node.path === selectedPath;
  const isTailing = Boolean(liveTailingPaths?.includes(node.path));
  const isPending = Boolean(pendingTogglePaths?.has(node.path));

  function handleClick() {
    if (hasChildren) {
      setExpanded((prev) => !prev);
    }
    if (node.hasLogFiles) {
      onSelectFolder(node.path);
    }
  }

  const labelClassName = [
    "folder-tree__label",
    node.hasLogFiles && "folder-tree__label--selectable",
    isSelected && "folder-tree__label--selected",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li className="folder-tree__node">
      <div className="folder-tree__row">
        <button className={labelClassName} onClick={handleClick}>
          <span className="folder-tree__icon" aria-hidden="true">
            {hasChildren ? (expanded ? "▾" : "▸") : " "}
          </span>
          <span className="folder-tree__glyph" aria-hidden="true">
            {node.hasLogFiles ? "●" : "○"}
          </span>
          <span className="folder-tree__name">{node.name}</span>
        </button>
        {node.hasLogFiles && onToggleLiveTail && (
          <button
            type="button"
            className="folder-tree__live-tail-toggle"
            aria-pressed={isTailing}
            disabled={isPending}
            aria-label={`Live volgen ${node.name} ${
              isTailing ? "uitzetten" : "aanzetten"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleLiveTail(node.path);
            }}
          >
            <span
              className={
                "live-tail-indicator" +
                (isTailing ? " live-tail-indicator--active" : "")
              }
              aria-hidden="true"
            />
          </button>
        )}
      </div>
      {expanded && hasChildren && (
        <ul className="folder-tree__children">
          {node.children.map((child) => (
            <FolderTree
              key={child.path}
              node={child}
              selectedPath={selectedPath}
              liveTailingPaths={liveTailingPaths}
              onSelectFolder={onSelectFolder}
              onToggleLiveTail={onToggleLiveTail}
              pendingTogglePaths={pendingTogglePaths}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
