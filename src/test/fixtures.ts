import type { FolderNode } from "../components/FolderTree";

export function makeFolderTree(): FolderNode {
  return {
    path: "/logs/web74",
    name: "web74",
    hasLogFiles: false,
    children: [
      {
        path: "/logs/web74/blocking",
        name: "blocking",
        hasLogFiles: false,
        children: [
          {
            path: "/logs/web74/blocking/database",
            name: "database",
            hasLogFiles: true,
            children: [],
          },
        ],
      },
    ],
  };
}
