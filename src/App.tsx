import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { RootFolderList, type RootFolder } from "./components/RootFolderList";
import "./App.css";

function App() {
  const [folders, setFolders] = useState<RootFolder[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);

  useEffect(() => {
    invoke<RootFolder[]>("list_root_folders").then(setFolders);
  }, []);

  async function handleAddFolder() {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected !== "string") {
      return;
    }
    const updated = await invoke<RootFolder[]>("add_root_folder", {
      path: selected,
    });
    setFolders(updated);
  }

  return (
    <main className="container">
      <h1>Timber</h1>
      <RootFolderList
        folders={folders}
        onAddFolder={handleAddFolder}
        onSelectFolder={setActiveFolder}
      />
      {activeFolder && <p>Actieve map: {activeFolder}</p>}
    </main>
  );
}

export default App;
