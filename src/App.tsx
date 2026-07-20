import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { RootFolderList, type RootFolder } from "./components/RootFolderList";
import type { FolderNode } from "./components/FolderTree";
import { LogEntryList, type LogEntry } from "./components/LogEntryList";
import { DayFilterCalendar } from "./components/DayFilterCalendar";
import { ToastStack, type Toast } from "./components/ToastStack";
import { clampSidebarWidth } from "./lib/sidebarWidth";
import { folderName } from "./lib/folderName";
import {
  DATE_FORMAT_CHANGED_EVENT,
  DEFAULT_DATE_FORMAT_SETTINGS,
  type DateFormatSettings,
} from "./lib/dateFormatSettings";
import "./App.css";

const SIDEBAR_DEFAULT_WIDTH = 250;
const LOG_ENTRIES_UPDATED_EVENT = "log-entries-updated";
// Treat the user as "at the bottom" within this margin, so a near-bottom
// scroll position still keeps auto-scroll engaged.
const AUTO_SCROLL_THRESHOLD_PX = 80;
// Avoid a burst of separate notifications when several new lines land in
// the same background folder within a short window.
const NOTIFICATION_COOLDOWN_MS = 30_000;
const TOAST_AUTO_DISMISS_MS = 8_000;

interface LogEntriesUpdatedPayload {
  folder: string;
  entries: LogEntry[];
}

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
  // Folders currently being tailed, independent of which one is open —
  // switching to look at a different folder doesn't stop the others.
  const [liveTailingPaths, setLiveTailingPaths] = useState<string[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dateFormatSettings, setDateFormatSettings] =
    useState<DateFormatSettings>(DEFAULT_DATE_FORMAT_SETTINGS);
  const [error, setError] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const isResizing = useRef(false);
  const mainPaneRef = useRef<HTMLElement>(null);
  const isNearBottomRef = useRef(true);
  const lastNotifiedAtRef = useRef<Record<string, number>>({});
  // Set by jumpToFolder when the target folder's root isn't active yet, so
  // the folder_scanner effect can select it once that root's tree loads.
  const pendingJumpPathRef = useRef<string | null>(null);

  // Live-tailing only makes sense while looking at the most recent day (or
  // when the folder has no dated files at all) — new lines don't belong to
  // an older day you've deliberately filtered to.
  const isMostRecentDaySelected =
    availableDates.length === 0 ||
    (selectedDates.length === 1 && selectedDates[0] === availableDates[0]);
  const isLiveTailing =
    Boolean(selectedLogFolder) &&
    liveTailingPaths.includes(selectedLogFolder ?? "") &&
    isMostRecentDaySelected;

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
    isPermissionGranted().then((granted) => {
      if (!granted) {
        requestPermission().catch(() => {});
      }
    });
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
          if (pendingJumpPathRef.current) {
            setSelectedLogFolder(pendingJumpPathRef.current);
            pendingJumpPathRef.current = null;
          }
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

  useEffect(() => {
    // Turning the tail off itself, rather than just the day filter, so it
    // doesn't silently re-enable if the user filters back to the most
    // recent day later — re-enabling is always an explicit click.
    if (
      selectedLogFolder &&
      liveTailingPaths.includes(selectedLogFolder) &&
      !isMostRecentDaySelected
    ) {
      setLiveTailingPaths((prev) =>
        prev.filter((p) => p !== selectedLogFolder),
      );
      invoke("stop_watching", { folder: selectedLogFolder }).catch(() => {});
    }
  }, [selectedLogFolder, isMostRecentDaySelected, liveTailingPaths]);

  useEffect(() => {
    const unlisten = listen<LogEntriesUpdatedPayload>(
      LOG_ENTRIES_UPDATED_EVENT,
      (event) => {
        if (event.payload.folder === selectedLogFolder) {
          setLogEntries(event.payload.entries);
        } else {
          notifyBackgroundActivity(event.payload.folder);
        }
      },
    );
    return () => {
      unlisten.then((f) => f());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLogFolder, folders]);

  useEffect(() => {
    if (isNearBottomRef.current && mainPaneRef.current) {
      mainPaneRef.current.scrollTop = mainPaneRef.current.scrollHeight;
    }
  }, [logEntries]);

  function handleMainPaneScroll() {
    const el = mainPaneRef.current;
    if (!el) {
      return;
    }
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom < AUTO_SCROLL_THRESHOLD_PX;
  }

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

  function folderLabel(path: string): string {
    const root = folders.find(
      (f) => path === f.path || path.startsWith(`${f.path}/`),
    );
    const subLabel = folderName(path);
    if (!root) {
      return subLabel;
    }
    const rootLabel = root.displayName ?? folderName(root.path);
    return rootLabel === subLabel ? subLabel : `${rootLabel} / ${subLabel}`;
  }

  function notifyBackgroundActivity(folder: string) {
    const now = Date.now();
    const last = lastNotifiedAtRef.current[folder] ?? 0;
    if (now - last < NOTIFICATION_COOLDOWN_MS) {
      return;
    }
    lastNotifiedAtRef.current[folder] = now;

    const label = folderLabel(folder);
    sendNotification({ title: "Nieuwe logactiviteit", body: label });

    const id = `${folder}-${now}`;
    setToasts((prev) => [...prev, { id, folder, label }]);
    setTimeout(() => dismissToast(id), TOAST_AUTO_DISMISS_MS);
  }

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function jumpToFolder(path: string) {
    const root = folders.find(
      (f) => path === f.path || path.startsWith(`${f.path}/`),
    );
    if (!root) {
      return;
    }
    if (root.path === activeFolder) {
      setSelectedLogFolder(path);
    } else {
      pendingJumpPathRef.current = path;
      setActiveFolder(root.path);
    }
  }

  async function toggleLiveTail(path: string) {
    if (liveTailingPaths.includes(path)) {
      setLiveTailingPaths((prev) => prev.filter((p) => p !== path));
      invoke("stop_watching", { folder: path }).catch(() => {});
      return;
    }

    let dates: string[];
    if (path === selectedLogFolder) {
      if (!isMostRecentDaySelected) {
        return;
      }
      dates = selectedDates;
    } else {
      try {
        const datesForPath = await invoke<string[]>("log_file_dates", {
          folder: path,
        });
        dates = datesForPath.length > 0 ? [datesForPath[0]] : [];
      } catch (e) {
        setError(String(e));
        return;
      }
    }

    setLiveTailingPaths((prev) => [...prev, path]);
    invoke("watch_log_folder", { folder: path, dates }).catch((e) =>
      setError(String(e)),
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

  async function handleRemoveFolder(path: string) {
    try {
      const updated = await invoke<RootFolder[]>("remove_root_folder", {
        path,
      });
      setFolders(updated);

      const affectedTailedPaths = liveTailingPaths.filter(
        (p) => p === path || p.startsWith(`${path}/`),
      );
      if (affectedTailedPaths.length > 0) {
        setLiveTailingPaths((prev) =>
          prev.filter((p) => !affectedTailedPaths.includes(p)),
        );
        affectedTailedPaths.forEach((p) => {
          invoke("stop_watching", { folder: p }).catch(() => {});
        });
      }

      if (activeFolder === path) {
        setActiveFolder(null);
        setSelectedLogFolder(null);
      }
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleRenameFolder(path: string, displayName: string | null) {
    try {
      const updated = await invoke<RootFolder[]>("rename_root_folder", {
        path,
        displayName,
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
          onRemoveFolder={handleRemoveFolder}
          onRenameFolder={handleRenameFolder}
          liveTailingPaths={liveTailingPaths}
          onToggleLiveTail={toggleLiveTail}
        />
      </aside>

      <div
        className="sidebar-resizer"
        onMouseDown={handleResizeStart}
        role="separator"
        aria-orientation="vertical"
        aria-label="Sidebar breedte aanpassen"
      />

      <main
        className="main-pane"
        ref={mainPaneRef}
        onScroll={handleMainPaneScroll}
      >
        {error && (
          <p role="alert" className="alert">
            {error}
          </p>
        )}

        {selectedLogFolder ? (
          <div className="main-pane__active">
            <span className="main-pane__eyebrow">Geselecteerde map</span>
            <code className="main-pane__path">{selectedLogFolder}</code>
            <button
              type="button"
              className="live-tail-toggle"
              aria-pressed={isLiveTailing}
              disabled={!isMostRecentDaySelected}
              title={
                isMostRecentDaySelected
                  ? "Live volgen aan/uit"
                  : "Live volgen is alleen beschikbaar bij de meest recente dag"
              }
              onClick={() => toggleLiveTail(selectedLogFolder)}
            >
              <span
                className={
                  "live-tail-indicator" +
                  (isLiveTailing ? " live-tail-indicator--active" : "")
                }
                aria-hidden="true"
              />
              Live volgen
            </button>
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

      <ToastStack
        toasts={toasts}
        onJumpToFolder={(path) => {
          jumpToFolder(path);
          setToasts((prev) => prev.filter((t) => t.folder !== path));
        }}
        onDismiss={dismissToast}
      />
    </div>
  );
}

export default App;
