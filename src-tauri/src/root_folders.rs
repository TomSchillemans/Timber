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

fn load_folders<R: tauri::Runtime>(app: &AppHandle<R>) -> Result<Vec<RootFolder>, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    Ok(store
        .get(FOLDERS_KEY)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default())
}

fn save_folders<R: tauri::Runtime>(
    app: &AppHandle<R>,
    folders: &[RootFolder],
) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    let value = serde_json::to_value(folders).map_err(|e| e.to_string())?;
    store.set(FOLDERS_KEY, value);
    store.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_root_folder(app: AppHandle, path: String) -> Result<Vec<RootFolder>, String> {
    let mut folders = load_folders(&app)?;
    insert_root_folder(&mut folders, path);
    save_folders(&app, &folders)?;
    Ok(folders)
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
}
