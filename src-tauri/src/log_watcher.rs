use crate::log_parser;
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::mpsc::channel;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

const LOG_ENTRIES_UPDATED_EVENT: &str = "log-entries-updated";
/// Coalesces a burst of filesystem events (e.g. a logger writing several
/// lines in quick succession) into a single reparse, instead of reparsing
/// once per write.
const DEBOUNCE: Duration = Duration::from_millis(250);

#[derive(Debug, Clone, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct LogEntriesUpdated {
    folder: String,
    entries: Vec<log_parser::LogEntry>,
}

/// Holds the currently active watcher, if any. Only one folder is watched
/// at a time — starting a new watch (or explicitly stopping) drops the
/// previous `RecommendedWatcher`, which unwatches its path automatically.
#[derive(Default)]
pub struct WatcherState(Mutex<Option<RecommendedWatcher>>);

fn stringify<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

fn spawn_reparse_loop<R: tauri::Runtime>(
    app: AppHandle<R>,
    folder: PathBuf,
    dates: Option<Vec<String>>,
    rx: std::sync::mpsc::Receiver<notify::Result<notify::Event>>,
) {
    std::thread::spawn(move || {
        // Blocks until the first event; the watcher's Drop (on
        // stop/replace) closes the channel, which ends this loop.
        while rx.recv().is_ok() {
            // Drain any further events in the debounce window so a burst
            // of writes triggers one reparse, not one per event.
            while rx.recv_timeout(DEBOUNCE).is_ok() {}

            let entries = log_parser::parse_log_folder(&folder, dates.as_deref());
            let _ = app.emit(
                LOG_ENTRIES_UPDATED_EVENT,
                LogEntriesUpdated {
                    folder: folder.to_string_lossy().into_owned(),
                    entries,
                },
            );
        }
    });
}

fn watch_log_folder_impl<R: tauri::Runtime>(
    app: AppHandle<R>,
    folder: String,
    dates: Option<Vec<String>>,
) -> Result<(), String> {
    let (tx, rx) = channel();
    let mut watcher = RecommendedWatcher::new(tx, notify::Config::default()).map_err(stringify)?;
    watcher
        .watch(Path::new(&folder), RecursiveMode::NonRecursive)
        .map_err(stringify)?;

    let state = app.state::<WatcherState>();
    *state.0.lock().map_err(|_| "watcher lock poisoned")? = Some(watcher);

    spawn_reparse_loop(app.clone(), PathBuf::from(folder), dates, rx);
    Ok(())
}

fn stop_watching_impl<R: tauri::Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let state = app.state::<WatcherState>();
    *state.0.lock().map_err(|_| "watcher lock poisoned")? = None;
    Ok(())
}

#[tauri::command(async)]
pub fn watch_log_folder(
    app: AppHandle,
    folder: String,
    dates: Option<Vec<String>>,
) -> Result<(), String> {
    watch_log_folder_impl(app, folder, dates)
}

#[tauri::command(async)]
pub fn stop_watching(app: AppHandle) -> Result<(), String> {
    stop_watching_impl(app)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::mpsc::RecvTimeoutError;
    use std::time::Duration;
    use tauri::test::{mock_builder, mock_context, noop_assets};
    use tauri::Listener;
    use tempfile::tempdir;

    fn mock_app() -> tauri::App<tauri::test::MockRuntime> {
        mock_builder()
            .manage(WatcherState::default())
            .build(mock_context(noop_assets()))
            .unwrap()
    }

    #[test]
    fn test_watch_log_folder_emits_updated_entries_on_change() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("app"), "{\"message\": \"first\"}\n").unwrap();

        let app = mock_app();
        let handle = app.handle().clone();
        let (tx, rx) = std::sync::mpsc::channel::<LogEntriesUpdated>();
        handle.listen(LOG_ENTRIES_UPDATED_EVENT, move |event| {
            let payload: LogEntriesUpdated = serde_json::from_str(event.payload()).unwrap();
            let _ = tx.send(payload);
        });

        watch_log_folder_impl(
            handle.clone(),
            dir.path().to_string_lossy().into_owned(),
            None,
        )
        .unwrap();

        // Give the watcher a moment to start before writing, since the
        // underlying OS watch registration isn't guaranteed synchronous.
        std::thread::sleep(Duration::from_millis(100));
        fs::write(
            dir.path().join("app"),
            "{\"message\": \"first\"}\n{\"message\": \"second\"}\n",
        )
        .unwrap();

        let received = match rx.recv_timeout(Duration::from_secs(5)) {
            Ok(payload) => payload,
            Err(RecvTimeoutError::Timeout) => panic!("no log-entries-updated event received"),
            Err(e) => panic!("channel error: {e}"),
        };

        assert_eq!(received.entries.len(), 2);
        assert_eq!(received.entries[1].message, "second");
    }

    #[test]
    fn test_stop_watching_clears_state() {
        let dir = tempdir().unwrap();
        let app = mock_app();
        let handle = app.handle().clone();

        watch_log_folder_impl(
            handle.clone(),
            dir.path().to_string_lossy().into_owned(),
            None,
        )
        .unwrap();
        assert!(handle.state::<WatcherState>().0.lock().unwrap().is_some());

        stop_watching_impl(handle.clone()).unwrap();

        assert!(handle.state::<WatcherState>().0.lock().unwrap().is_none());
    }
}
