import { useState } from "react";

export interface FolderNode {
  path: string;
  name: string;
  hasLogFiles: boolean;
  children: FolderNode[];
}

interface FolderTreeProps {
  node: FolderNode;
  onSelectFolder: (path: string) => void;
}

export function FolderTree({ node, onSelectFolder }: FolderTreeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  function handleClick() {
    if (hasChildren) {
      setExpanded((prev) => !prev);
    }
    if (node.hasLogFiles) {
      onSelectFolder(node.path);
    }
  }

  return (
    <li className="folder-tree__node">
      <button className="folder-tree__label" onClick={handleClick}>
        {hasChildren && (
          <span className="folder-tree__chevron" aria-hidden="true">
            {expanded ? "▾" : "▸"}
          </span>
        )}
        {node.name}
      </button>
      {expanded && hasChildren && (
        <ul className="folder-tree__children">
          {node.children.map((child) => (
            <FolderTree
              key={child.path}
              node={child}
              onSelectFolder={onSelectFolder}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
