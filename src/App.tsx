import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { RootFolderList, type RootFolder } from "./components/RootFolderList";
import "./App.css";

function App() {
  const [folders, setFolders] = useState<RootFolder[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<RootFolder[]>("list_root_folders")
      .then(setFolders)
      .catch((e) => setError(String(e)));
  }, []);

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
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__brand-mark">::</span>
          TIMBER
        </div>
        <RootFolderList
          folders={folders}
          activeFolder={activeFolder}
          onAddFolder={handleAddFolder}
          onSelectFolder={setActiveFolder}
        />
      </aside>

      <main className="main-pane">
        {error && (
          <p role="alert" className="alert">
            {error}
          </p>
        )}

        {activeFolder ? (
          <div className="main-pane__active">
            <span className="main-pane__eyebrow">Actieve map</span>
            <code className="main-pane__path">{activeFolder}</code>
            <p className="main-pane__hint">
              Submap-navigatie en logweergave volgen in een latere fase.
            </p>
          </div>
        ) : (
          <div className="main-pane__empty">
            <span className="main-pane__empty-glyph" aria-hidden="true">
              ~/
            </span>
            <p>Selecteer een map om te beginnen.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
