use crate::log_parser;
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::HashMap;
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

/// A folder's watch state plus the sequence number of the command that last
/// applied it. `watch_log_folder`/`stop_watching` are async Tauri commands
/// with no ordering guarantee across separate invocations, so the frontend
/// tags each call with a monotonically increasing `seq` (assigned
/// synchronously, in issuance order). A command only takes effect if its
/// `seq` is newer than what's already recorded for that folder — this makes
/// the outcome depend on issuance order rather than completion order, so a
/// stale call that resolves late can't undo a newer one.
#[derive(Default)]
struct FolderWatch {
    seq: u64,
    // Never read outside tests — held so that replacing/clearing it runs
    // `RecommendedWatcher`'s `Drop`, which unwatches the folder.
    #[cfg_attr(not(test), allow(dead_code))]
    watcher: Option<RecommendedWatcher>,
}

/// Holds the watch state for every folder that has been watched or stopped
/// at least once, keyed by folder path — multiple folders can be tailed at
/// once. Replacing or clearing the `watcher` for a path drops that path's
/// `RecommendedWatcher`, which unwatches it automatically; other folders'
/// watchers are untouched.
#[derive(Default)]
pub struct WatcherState(Mutex<HashMap<String, FolderWatch>>);

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
    seq: u64,
) -> Result<(), String> {
    let state = app.state::<WatcherState>();
    let mut watchers = state.0.lock().map_err(|_| "watcher lock poisoned")?;
    if watchers.get(&folder).is_some_and(|w| w.seq >= seq) {
        // A newer command for this folder already applied; this one arrived
        // late and must not override it.
        return Ok(());
    }

    let (tx, rx) = channel();
    let mut watcher = RecommendedWatcher::new(tx, notify::Config::default()).map_err(stringify)?;
    watcher
        .watch(Path::new(&folder), RecursiveMode::NonRecursive)
        .map_err(stringify)?;

    watchers.insert(
        folder.clone(),
        FolderWatch {
            seq,
            watcher: Some(watcher),
        },
    );
    drop(watchers);

    spawn_reparse_loop(app.clone(), PathBuf::from(folder), dates, rx);
    Ok(())
}

fn stop_watching_impl<R: tauri::Runtime>(
    app: AppHandle<R>,
    folder: String,
    seq: u64,
) -> Result<(), String> {
    let state = app.state::<WatcherState>();
    let mut watchers = state.0.lock().map_err(|_| "watcher lock poisoned")?;
    if watchers.get(&folder).is_some_and(|w| w.seq >= seq) {
        return Ok(());
    }
    // Recording the seq with no watcher (rather than removing the key)
    // ensures a stale watch_log_folder call issued before this stop can't
    // resurrect it once it arrives late.
    watchers.insert(folder, FolderWatch { seq, watcher: None });
    Ok(())
}

#[tauri::command(async)]
pub fn watch_log_folder(
    app: AppHandle,
    folder: String,
    dates: Option<Vec<String>>,
    seq: u64,
) -> Result<(), String> {
    watch_log_folder_impl(app, folder, dates, seq)
}

#[tauri::command(async)]
pub fn stop_watching(app: AppHandle, folder: String, seq: u64) -> Result<(), String> {
    stop_watching_impl(app, folder, seq)
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
            1,
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
    fn test_stop_watching_removes_only_that_folder() {
        let dir_a = tempdir().unwrap();
        let dir_b = tempdir().unwrap();
        let app = mock_app();
        let handle = app.handle().clone();
        let path_a = dir_a.path().to_string_lossy().into_owned();
        let path_b = dir_b.path().to_string_lossy().into_owned();

        watch_log_folder_impl(handle.clone(), path_a.clone(), None, 1).unwrap();
        watch_log_folder_impl(handle.clone(), path_b.clone(), None, 1).unwrap();
        assert_eq!(handle.state::<WatcherState>().0.lock().unwrap().len(), 2);

        stop_watching_impl(handle.clone(), path_a.clone(), 2).unwrap();

        let state = handle.state::<WatcherState>();
        let watchers = state.0.lock().unwrap();
        assert!(watchers.get(&path_a).unwrap().watcher.is_none());
        assert!(watchers.get(&path_b).unwrap().watcher.is_some());
    }

    #[test]
    fn test_stale_watch_after_newer_stop_is_ignored() {
        // Simulates watch_log_folder resolving after a later stop_watching
        // call for the same folder already applied — the seq guard must
        // keep the folder unwatched rather than letting the stale watch win.
        let dir = tempdir().unwrap();
        let app = mock_app();
        let handle = app.handle().clone();
        let path = dir.path().to_string_lossy().into_owned();

        watch_log_folder_impl(handle.clone(), path.clone(), None, 1).unwrap();
        stop_watching_impl(handle.clone(), path.clone(), 2).unwrap();
        watch_log_folder_impl(handle.clone(), path.clone(), None, 1).unwrap();

        let state = handle.state::<WatcherState>();
        let watchers = state.0.lock().unwrap();
        assert!(watchers.get(&path).unwrap().watcher.is_none());
    }

    #[test]
    fn test_stale_stop_after_newer_watch_is_ignored() {
        // Simulates stop_watching resolving after a later watch_log_folder
        // call for the same folder already applied — the seq guard must
        // keep the folder watched rather than letting the stale stop win.
        let dir = tempdir().unwrap();
        let app = mock_app();
        let handle = app.handle().clone();
        let path = dir.path().to_string_lossy().into_owned();

        watch_log_folder_impl(handle.clone(), path.clone(), None, 2).unwrap();
        stop_watching_impl(handle.clone(), path.clone(), 1).unwrap();

        let state = handle.state::<WatcherState>();
        let watchers = state.0.lock().unwrap();
        assert!(watchers.get(&path).unwrap().watcher.is_some());
    }

    #[test]
    fn test_watching_two_folders_at_once_both_emit_updates() {
        let dir_a = tempdir().unwrap();
        let dir_b = tempdir().unwrap();
        fs::write(dir_a.path().join("app"), "").unwrap();
        fs::write(dir_b.path().join("app"), "").unwrap();

        let app = mock_app();
        let handle = app.handle().clone();
        let (tx, rx) = std::sync::mpsc::channel::<LogEntriesUpdated>();
        let tx_b = tx.clone();
        handle.listen(LOG_ENTRIES_UPDATED_EVENT, move |event| {
            let payload: LogEntriesUpdated = serde_json::from_str(event.payload()).unwrap();
            let _ = tx_b.send(payload);
        });

        let path_a = dir_a.path().to_string_lossy().into_owned();
        let path_b = dir_b.path().to_string_lossy().into_owned();
        watch_log_folder_impl(handle.clone(), path_a.clone(), None, 1).unwrap();
        watch_log_folder_impl(handle.clone(), path_b.clone(), None, 1).unwrap();

        std::thread::sleep(Duration::from_millis(100));
        fs::write(dir_a.path().join("app"), "{\"message\": \"from a\"}\n").unwrap();
        fs::write(dir_b.path().join("app"), "{\"message\": \"from b\"}\n").unwrap();

        let mut seen_folders = Vec::new();
        for _ in 0..2 {
            match rx.recv_timeout(Duration::from_secs(5)) {
                Ok(payload) => seen_folders.push(payload.folder),
                Err(e) => panic!("expected an update from both folders: {e}"),
            }
        }
        seen_folders.sort();
        let mut expected = vec![path_a, path_b];
        expected.sort();
        assert_eq!(seen_folders, expected);
    }
}
