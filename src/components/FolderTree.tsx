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
  onSelectFolder: (path: string) => void;
}

export function FolderTree({
  node,
  selectedPath,
  onSelectFolder,
}: FolderTreeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = node.path === selectedPath;

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
      <button className={labelClassName} onClick={handleClick}>
        <span className="folder-tree__icon" aria-hidden="true">
          {hasChildren ? (expanded ? "▾" : "▸") : " "}
        </span>
        <span className="folder-tree__glyph" aria-hidden="true">
          {node.hasLogFiles ? "●" : "○"}
        </span>
        <span className="folder-tree__name">{node.name}</span>
      </button>
      {expanded && hasChildren && (
        <ul className="folder-tree__children">
          {node.children.map((child) => (
            <FolderTree
              key={child.path}
              node={child}
              selectedPath={selectedPath}
              onSelectFolder={onSelectFolder}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
