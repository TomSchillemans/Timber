use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FolderNode {
    pub path: String,
    pub name: String,
    pub has_log_files: bool,
    pub children: Vec<FolderNode>,
}

/// OS-generated clutter that shows up in real directories but is never a
/// log file — excluded so these don't falsely mark a folder as "has logs".
const IGNORED_FILE_NAMES: &[&str] = &[".DS_Store", "Thumbs.db", "desktop.ini"];

fn is_ignored_file_name(name: &str) -> bool {
    IGNORED_FILE_NAMES.contains(&name)
}

/// Recursively scans `dir`, building a tree of subdirectories.
/// A directory that can't be read (missing, no permission) is treated as
/// empty rather than failing the whole scan. Uses `DirEntry::file_type()`
/// (which does not follow symlinks) rather than `Path::is_dir()`, so a
/// symlink cycle can't send this into unbounded recursion.
fn scan_directory(dir: &Path) -> FolderNode {
    let name = dir
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();

    let mut children = Vec::new();
    let mut has_log_files = false;

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            if file_type.is_dir() {
                children.push(scan_directory(&entry.path()));
            } else if file_type.is_file() && !has_log_files {
                let entry_name = entry.file_name();
                let entry_name = entry_name.to_string_lossy();
                if !is_ignored_file_name(&entry_name) {
                    has_log_files = true;
                }
            }
        }
    }

    FolderNode {
        path: dir.to_string_lossy().into_owned(),
        name,
        has_log_files,
        children,
    }
}

#[tauri::command(async)]
pub fn folder_scanner(root: String) -> FolderNode {
    scan_directory(Path::new(&root))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_scan_finds_nested_dirs_with_files() {
        let root = tempdir().unwrap();
        let web74 = root.path().join("web74");
        let blocking = web74.join("blocking");
        let database = blocking.join("database");
        fs::create_dir_all(&database).unwrap();
        fs::write(database.join("app.log"), "{}\n").unwrap();

        let tree = scan_directory(root.path());

        let web74_node = tree.children.iter().find(|n| n.name == "web74").unwrap();
        let blocking_node = web74_node
            .children
            .iter()
            .find(|n| n.name == "blocking")
            .unwrap();
        let database_node = blocking_node
            .children
            .iter()
            .find(|n| n.name == "database")
            .unwrap();

        assert!(database_node.has_log_files);
        assert!(!blocking_node.has_log_files);
        assert!(!web74_node.has_log_files);
    }

    #[test]
    #[cfg(unix)]
    fn test_scan_permission_denied_dir_does_not_panic() {
        use std::os::unix::fs::PermissionsExt;

        let root = tempdir().unwrap();
        let locked = root.path().join("locked");
        fs::create_dir(&locked).unwrap();
        fs::set_permissions(&locked, fs::Permissions::from_mode(0o000)).unwrap();

        let tree = scan_directory(root.path());

        // Restore permissions so the tempdir can clean itself up.
        fs::set_permissions(&locked, fs::Permissions::from_mode(0o700)).unwrap();

        let locked_node = tree.children.iter().find(|n| n.name == "locked").unwrap();
        assert!(!locked_node.has_log_files);
        assert!(locked_node.children.is_empty());
    }

    #[test]
    fn test_scan_ignores_os_junk_files() {
        let root = tempdir().unwrap();
        fs::write(root.path().join(".DS_Store"), b"").unwrap();

        let tree = scan_directory(root.path());

        assert!(!tree.has_log_files);
    }

    #[test]
    #[cfg(unix)]
    fn test_scan_follows_no_symlink_cycle() {
        use std::os::unix::fs::symlink;

        let root = tempdir().unwrap();
        let child = root.path().join("child");
        fs::create_dir(&child).unwrap();
        // Symlink back to the parent — a real-world pattern (e.g. deploy
        // dirs with a `current -> ..` link) that must not cause infinite
        // recursion.
        symlink(root.path(), child.join("back-to-root")).unwrap();

        let tree = scan_directory(root.path());

        let child_node = tree.children.iter().find(|n| n.name == "child").unwrap();
        // The symlink is not treated as a subdirectory to recurse into.
        assert!(child_node.children.is_empty());
    }

    #[test]
    fn test_scan_empty_dir_no_logs() {
        let root = tempdir().unwrap();

        let tree = scan_directory(root.path());

        assert!(!tree.has_log_files);
        assert!(tree.children.is_empty());
    }

    #[test]
    fn test_scan_nonexistent_dir_does_not_panic() {
        let tree = scan_directory(Path::new("/this/path/does/not/exist"));

        assert!(!tree.has_log_files);
        assert!(tree.children.is_empty());
    }
}
