import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { RootFolderList, type RootFolder } from "./components/RootFolderList";
import type { FolderNode } from "./components/FolderTree";
import { LogEntryList, type LogEntry } from "./components/LogEntryList";
import { clampSidebarWidth } from "./lib/sidebarWidth";
import "./App.css";

const SIDEBAR_DEFAULT_WIDTH = 250;

function App() {
  const [folders, setFolders] = useState<RootFolder[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [folderTree, setFolderTree] = useState<FolderNode | null>(null);
  const [selectedLogFolder, setSelectedLogFolder] = useState<string | null>(
    null,
  );
  const [logEntries, setLogEntries] = useState<LogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const isResizing = useRef(false);

  useEffect(() => {
    invoke<RootFolder[]>("list_root_folders")
      .then(setFolders)
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!activeFolder) {
      setFolderTree(null);
      return;
    }
    let cancelled = false;
    setSelectedLogFolder(null);
    invoke<FolderNode>("folder_scanner", { root: activeFolder })
      .then((tree) => {
        if (!cancelled) {
          setFolderTree(tree);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeFolder]);

  useEffect(() => {
    if (!selectedLogFolder) {
      setLogEntries(null);
      return;
    }
    let cancelled = false;
    invoke<LogEntry[]>("log_parser", { folder: selectedLogFolder })
      .then((entries) => {
        if (!cancelled) {
          setLogEntries(entries);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedLogFolder]);

  const handleResizeMove = useCallback((event: MouseEvent) => {
    if (!isResizing.current) {
      return;
    }
    setSidebarWidth(clampSidebarWidth(event.clientX));
  }, []);

  const handleResizeEnd = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener("mousemove", handleResizeMove);
    document.removeEventListener("mouseup", handleResizeEnd);
  }, [handleResizeMove]);

  const handleResizeStart = useCallback(() => {
    isResizing.current = true;
    document.addEventListener("mousemove", handleResizeMove);
    document.addEventListener("mouseup", handleResizeEnd);
  }, [handleResizeMove, handleResizeEnd]);

  async function handleAddFolder() {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected !== "string") {
      return;
    }
    try {
      const updated = await invoke<RootFolder[]>("add_root_folder", {
        path: selected,
      });
      setFolders(updated);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" style={{ width: sidebarWidth }}>
        <div className="sidebar__brand">
          <span className="sidebar__brand-mark">::</span>
          TIMBER
        </div>
        <RootFolderList
          folders={folders}
          activeFolder={activeFolder}
          activeFolderTree={folderTree}
          selectedLogFolder={selectedLogFolder}
          onAddFolder={handleAddFolder}
          onSelectFolder={setActiveFolder}
          onSelectLogFolder={setSelectedLogFolder}
        />
      </aside>

      <div
        className="sidebar-resizer"
        onMouseDown={handleResizeStart}
        role="separator"
        aria-orientation="vertical"
        aria-label="Sidebar breedte aanpassen"
      />

      <main className="main-pane">
        {error && (
          <p role="alert" className="alert">
            {error}
          </p>
        )}

        {selectedLogFolder ? (
          <div className="main-pane__active">
            <span className="main-pane__eyebrow">Geselecteerde map</span>
            <code className="main-pane__path">{selectedLogFolder}</code>
            {logEntries ? (
              <LogEntryList entries={logEntries} />
            ) : (
              <p className="main-pane__hint">Logs worden geladen...</p>
            )}
          </div>
        ) : (
          <div className="main-pane__empty">
            <span className="main-pane__empty-glyph" aria-hidden="true">
              ~/
            </span>
            <p>
              {activeFolder
                ? "Selecteer een submap met logs in de zijbalk."
                : "Selecteer een map om te beginnen."}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
