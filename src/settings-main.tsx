import React from "react";
import ReactDOM from "react-dom/client";
import { SettingsPanel } from "./components/SettingsPanel";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SettingsPanel />
  </React.StrictMode>,
);
