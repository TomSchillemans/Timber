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

/// Recursively scans `dir`, building a tree of subdirectories.
/// A directory that can't be read (missing, no permission) is treated as
/// empty rather than failing the whole scan.
fn scan_directory(dir: &Path) -> FolderNode {
    let name = dir
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let mut children = Vec::new();
    let mut has_log_files = false;

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                children.push(scan_directory(&path));
            } else if path.is_file() {
                has_log_files = true;
            }
        }
    }

    FolderNode {
        path: dir.to_string_lossy().to_string(),
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
