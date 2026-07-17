use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "root_folders.json";
const FOLDERS_KEY: &str = "folders";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RootFolder {
    pub path: String,
    pub available: bool,
    /// User-chosen label shown in the UI instead of the folder's actual
    /// name — purely cosmetic, never renames anything on disk. `None` means
    /// no custom name was set; the UI falls back to the folder's own name.
    /// Not required to be unique: it's a label, not an identifier — `path`
    /// remains the real key.
    #[serde(default)]
    pub display_name: Option<String>,
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
        display_name: None,
    });
    true
}

/// Removes the folder matching `path`, if any. Returns `true` if a folder
/// was removed, `false` if no entry matched.
fn remove_root_folder_entry(folders: &mut Vec<RootFolder>, path: &str) -> bool {
    let original_len = folders.len();
    folders.retain(|f| f.path != path);
    folders.len() != original_len
}

/// Sets (or clears, when `display_name` is `None`/empty) the display name
/// for the folder matching `path`. Returns `true` if a matching folder was
/// found, `false` otherwise.
fn set_display_name(folders: &mut [RootFolder], path: &str, display_name: Option<String>) -> bool {
    let Some(folder) = folders.iter_mut().find(|f| f.path == path) else {
        return false;
    };
    folder.display_name = display_name
        .map(|name| name.trim().to_string())
        .filter(|name| !name.is_empty());
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

/// Recomputes `available` for each folder based on whether its path still
/// exists as a directory. Unavailable folders stay in the list (rather
/// than being dropped) so the user can still see and manage them.
fn recompute_availability(folders: &mut [RootFolder]) {
    for folder in folders.iter_mut() {
        folder.available = Path::new(&folder.path).is_dir();
    }
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
    let mut folders = load_folders(&app)?;
    recompute_availability(&mut folders);
    Ok(folders)
}

#[tauri::command(async)]
pub fn remove_root_folder(app: AppHandle, path: String) -> Result<Vec<RootFolder>, String> {
    let mut folders = load_folders(&app)?;
    remove_root_folder_entry(&mut folders, &path);
    save_folders(&app, &folders)?;
    Ok(folders)
}

#[tauri::command(async)]
pub fn rename_root_folder(
    app: AppHandle,
    path: String,
    display_name: Option<String>,
) -> Result<Vec<RootFolder>, String> {
    let mut folders = load_folders(&app)?;
    set_display_name(&mut folders, &path, display_name);
    save_folders(&app, &folders)?;
    Ok(folders)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

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
                display_name: None,
            }]
        );
    }

    #[test]
    fn test_add_root_folder_rejects_duplicate() {
        let mut folders = vec![RootFolder {
            path: "/logs/web74".to_string(),
            available: true,
            display_name: None,
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
                    display_name: None,
                },
                RootFolder {
                    path: "/logs/web84".to_string(),
                    available: false,
                    display_name: None,
                },
            ]
        );
    }

    #[test]
    fn test_list_marks_missing_path_unavailable() {
        let mut folders = vec![RootFolder {
            path: "/this/path/does/not/exist".to_string(),
            available: true,
            display_name: None,
        }];

        recompute_availability(&mut folders);

        assert!(!folders[0].available);
    }

    #[test]
    fn test_list_marks_existing_path_available() {
        let root = tempdir().unwrap();
        let mut folders = vec![RootFolder {
            path: root.path().to_string_lossy().into_owned(),
            available: false,
            display_name: None,
        }];

        recompute_availability(&mut folders);

        assert!(folders[0].available);
    }

    #[test]
    fn test_remove_root_folder_entry_removes_matching_path() {
        let mut folders = vec![
            RootFolder {
                path: "/logs/web74".to_string(),
                available: true,
                display_name: None,
            },
            RootFolder {
                path: "/logs/web84".to_string(),
                available: true,
                display_name: None,
            },
        ];

        let removed = remove_root_folder_entry(&mut folders, "/logs/web74");

        assert!(removed);
        assert_eq!(folders.len(), 1);
        assert_eq!(folders[0].path, "/logs/web84");
    }

    #[test]
    fn test_remove_root_folder_entry_no_match_is_a_no_op() {
        let mut folders = vec![RootFolder {
            path: "/logs/web74".to_string(),
            available: true,
            display_name: None,
        }];

        let removed = remove_root_folder_entry(&mut folders, "/logs/does-not-exist");

        assert!(!removed);
        assert_eq!(folders.len(), 1);
    }

    #[test]
    fn test_set_display_name_updates_matching_folder() {
        let mut folders = vec![RootFolder {
            path: "/logs/web74".to_string(),
            available: true,
            display_name: None,
        }];

        let found = set_display_name(&mut folders, "/logs/web74", Some("Web74".to_string()));

        assert!(found);
        assert_eq!(folders[0].display_name, Some("Web74".to_string()));
    }

    #[test]
    fn test_set_display_name_trims_surrounding_whitespace() {
        let mut folders = vec![RootFolder {
            path: "/logs/web74".to_string(),
            available: true,
            display_name: None,
        }];

        set_display_name(&mut folders, "/logs/web74", Some("  Web74  ".to_string()));

        assert_eq!(folders[0].display_name, Some("Web74".to_string()));
    }

    #[test]
    fn test_set_display_name_clears_on_none() {
        let mut folders = vec![RootFolder {
            path: "/logs/web74".to_string(),
            available: true,
            display_name: Some("Web74".to_string()),
        }];

        set_display_name(&mut folders, "/logs/web74", None);

        assert_eq!(folders[0].display_name, None);
    }

    #[test]
    fn test_set_display_name_clears_on_blank_string() {
        let mut folders = vec![RootFolder {
            path: "/logs/web74".to_string(),
            available: true,
            display_name: Some("Web74".to_string()),
        }];

        set_display_name(&mut folders, "/logs/web74", Some("   ".to_string()));

        assert_eq!(folders[0].display_name, None);
    }

    #[test]
    fn test_set_display_name_no_match_returns_false() {
        let mut folders = vec![RootFolder {
            path: "/logs/web74".to_string(),
            available: true,
            display_name: None,
        }];

        let found = set_display_name(
            &mut folders,
            "/logs/does-not-exist",
            Some("Name".to_string()),
        );

        assert!(!found);
    }

    #[test]
    fn test_resolve_stored_folders_defaults_missing_display_name_to_none() {
        let stored = serde_json::json!([{ "path": "/logs/web74", "available": true }]);

        let folders = resolve_stored_folders(Some(stored));

        assert_eq!(folders[0].display_name, None);
    }
}
