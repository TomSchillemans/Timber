use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "root_folders.json";
const FOLDERS_KEY: &str = "folders";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RootFolder {
    pub path: String,
    pub available: bool,
}

/// Adds `path` to `folders` unless it is already present.
/// Returns `true` if the folder was added, `false` if it was a duplicate.
///
/// Comparison is a plain string match, so it assumes `path` always arrives
/// as the canonical string the OS folder dialog returned.
fn insert_root_folder(folders: &mut Vec<RootFolder>, path: String) -> bool {
    if folders.iter().any(|f| f.path == path) {
        return false;
    }
    folders.push(RootFolder {
        path,
        available: true,
    });
    true
}

/// Turns the raw JSON value read from the store into a folder list,
/// defaulting to empty when absent or when it fails to deserialize.
fn resolve_stored_folders(raw: Option<serde_json::Value>) -> Vec<RootFolder> {
    raw.and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

fn stringify<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

fn load_folders<R: tauri::Runtime>(app: &AppHandle<R>) -> Result<Vec<RootFolder>, String> {
    let store = app.store(STORE_FILE).map_err(stringify)?;
    Ok(resolve_stored_folders(store.get(FOLDERS_KEY)))
}

fn save_folders<R: tauri::Runtime>(
    app: &AppHandle<R>,
    folders: &[RootFolder],
) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(stringify)?;
    let value = serde_json::to_value(folders).map_err(stringify)?;
    store.set(FOLDERS_KEY, value);
    store.save().map_err(stringify)
}

// Runs off the main thread (see `tauri::command(async)`): both commands do
// blocking store I/O, and list_root_folders runs on every app startup.
#[tauri::command(async)]
pub fn add_root_folder(app: AppHandle, path: String) -> Result<Vec<RootFolder>, String> {
    let mut folders = load_folders(&app)?;
    insert_root_folder(&mut folders, path);
    save_folders(&app, &folders)?;
    Ok(folders)
}

#[tauri::command(async)]
pub fn list_root_folders(app: AppHandle) -> Result<Vec<RootFolder>, String> {
    load_folders(&app)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_root_folder_appends_to_store() {
        let mut folders: Vec<RootFolder> = vec![];

        let added = insert_root_folder(&mut folders, "/logs/web74".to_string());

        assert!(added);
        assert_eq!(
            folders,
            vec![RootFolder {
                path: "/logs/web74".to_string(),
                available: true,
            }]
        );
    }

    #[test]
    fn test_add_root_folder_rejects_duplicate() {
        let mut folders = vec![RootFolder {
            path: "/logs/web74".to_string(),
            available: true,
        }];

        let added = insert_root_folder(&mut folders, "/logs/web74".to_string());

        assert!(!added);
        assert_eq!(folders.len(), 1);
    }

    #[test]
    fn test_list_root_folders_empty() {
        assert_eq!(resolve_stored_folders(None), Vec::<RootFolder>::new());
    }

    #[test]
    fn test_list_root_folders_returns_stored() {
        let stored = serde_json::json!([
            { "path": "/logs/web74", "available": true },
            { "path": "/logs/web84", "available": false }
        ]);

        let folders = resolve_stored_folders(Some(stored));

        assert_eq!(
            folders,
            vec![
                RootFolder {
                    path: "/logs/web74".to_string(),
                    available: true,
                },
                RootFolder {
                    path: "/logs/web84".to_string(),
                    available: false,
                },
            ]
        );
    }
}
