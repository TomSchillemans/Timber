import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { RootFolderList, type RootFolder } from "./components/RootFolderList";
import type { FolderNode } from "./components/FolderTree";
import { LogEntryList, type LogEntry } from "./components/LogEntryList";
import { DayFilterCalendar } from "./components/DayFilterCalendar";
import { clampSidebarWidth } from "./lib/sidebarWidth";
import {
  DATE_FORMAT_CHANGED_EVENT,
  DEFAULT_DATE_FORMAT_SETTINGS,
  type DateFormatSettings,
} from "./lib/dateFormatSettings";
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
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [isDayFilterOpen, setIsDayFilterOpen] = useState(false);
  const [dateFormatSettings, setDateFormatSettings] =
    useState<DateFormatSettings>(DEFAULT_DATE_FORMAT_SETTINGS);
  const [error, setError] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const isResizing = useRef(false);

  useEffect(() => {
    invoke<RootFolder[]>("list_root_folders")
      .then(setFolders)
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    invoke<DateFormatSettings>("get_date_format_settings")
      .then(setDateFormatSettings)
      .catch((e) => setError(String(e)));

    // The settings window emits this after every change so the main
    // window's log view updates without needing a restart.
    const unlisten = listen<DateFormatSettings>(
      DATE_FORMAT_CHANGED_EVENT,
      (event) => setDateFormatSettings(event.payload),
    );
    return () => {
      unlisten.then((f) => f());
    };
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
    setIsDayFilterOpen(false);
    if (!selectedLogFolder) {
      setAvailableDates([]);
      setSelectedDates([]);
      return;
    }
    let cancelled = false;
    invoke<string[]>("log_file_dates", { folder: selectedLogFolder })
      .then((dates) => {
        if (cancelled) {
          return;
        }
        setAvailableDates(dates);
        // Default to the most recent day only — loading every day by
        // default is slow and noisy on daily-rotated logs; widening to
        // more days is an explicit user action via the filter.
        setSelectedDates(dates.length > 0 ? [dates[0]] : []);
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

  useEffect(() => {
    if (!selectedLogFolder) {
      setLogEntries(null);
      return;
    }
    // No days selected while days exist: show nothing rather than
    // silently falling back to "all days" (an empty filter list is
    // treated by the backend as "no filter").
    if (availableDates.length > 0 && selectedDates.length === 0) {
      setLogEntries([]);
      return;
    }
    let cancelled = false;
    invoke<LogEntry[]>("log_parser", {
      folder: selectedLogFolder,
      dates: selectedDates,
    })
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
  }, [selectedLogFolder, selectedDates, availableDates.length]);

  function dayFilterSummary(): string {
    if (selectedDates.length === 0) {
      return "Geen dagen geselecteerd";
    }
    if (selectedDates.length === 1) {
      return selectedDates[0];
    }
    return `${selectedDates.length} dagen`;
  }

  function toggleDate(date: string) {
    setSelectedDates((prev) =>
      prev.includes(date)
        ? prev.filter((d) => d !== date)
        : [...prev, date],
    );
  }

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
            {availableDates.length > 0 && (
              <div className="day-filter-toggle">
                <button
                  type="button"
                  className="day-filter-toggle__button"
                  aria-expanded={isDayFilterOpen}
                  onClick={() => setIsDayFilterOpen((open) => !open)}
                >
                  <span aria-hidden="true">▤</span> {dayFilterSummary()}
                </button>
                {isDayFilterOpen && (
                  <DayFilterCalendar
                    availableDates={availableDates}
                    selectedDates={selectedDates}
                    onToggleDate={toggleDate}
                    onSelectDates={setSelectedDates}
                  />
                )}
              </div>
            )}
            {logEntries ? (
              <LogEntryList
                key={selectedLogFolder}
                entries={logEntries}
                dateFormatSettings={dateFormatSettings}
              />
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
