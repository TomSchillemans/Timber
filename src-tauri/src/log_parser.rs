use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    pub timestamp: Option<String>,
    pub level: Option<String>,
    pub node: Option<String>,
    pub message: String,
    pub extra_fields: serde_json::Value,
}

// Field-name aliases across log formats seen in practice (plain
// timestamp/level/message as well as Monolog's datetime/level_name).
const TIMESTAMP_KEYS: &[&str] = &["timestamp", "time", "ts", "@timestamp", "datetime"];
const LEVEL_KEYS: &[&str] = &["level", "lvl", "severity", "level_name"];
const MESSAGE_KEYS: &[&str] = &["message", "msg"];
// Node/server identifiers are sometimes nested under a Monolog-style
// "extra"/"context" bag rather than at the top level (e.g. `extra.databasenaam`).
const NODE_KEYS: &[&str] = &["node", "hostname", "server", "databasenaam"];
const NESTED_CONTEXT_KEYS: &[&str] = &["extra", "context"];

/// Copies (does not remove) a string field so it can be surfaced as a named
/// LogEntry field while the full original object still ends up in
/// extra_fields — the detail view shows the complete original entry, not
/// just what's "left over" after named fields are lifted out.
fn peek_string_field(
    value: &serde_json::Map<String, serde_json::Value>,
    keys: &[&str],
) -> Option<String> {
    for key in keys {
        if let Some(serde_json::Value::String(s)) = value.get(*key) {
            return Some(s.clone());
        }
    }
    None
}

/// Looks for a node/server identifier, first at the top level, then inside
/// any nested "extra"/"context" object.
fn find_node_field(map: &serde_json::Map<String, serde_json::Value>) -> Option<String> {
    for key in NODE_KEYS {
        if let Some(serde_json::Value::String(s)) = map.get(*key) {
            return Some(s.clone());
        }
    }
    for context_key in NESTED_CONTEXT_KEYS {
        if let Some(serde_json::Value::Object(nested)) = map.get(*context_key) {
            for key in NODE_KEYS {
                if let Some(serde_json::Value::String(s)) = nested.get(*key) {
                    return Some(s.clone());
                }
            }
        }
    }
    None
}

/// Parses one JSON-per-line entry. Returns `None` if the line is not valid
/// JSON, isn't a JSON object, or has no message field — such lines are
/// skipped rather than failing the whole file.
fn parse_line(line: &str) -> Option<LogEntry> {
    let value: serde_json::Value = serde_json::from_str(line).ok()?;
    let serde_json::Value::Object(map) = value else {
        return None;
    };

    let message = peek_string_field(&map, MESSAGE_KEYS)?;
    let timestamp = peek_string_field(&map, TIMESTAMP_KEYS);
    let level = peek_string_field(&map, LEVEL_KEYS);
    let node = find_node_field(&map);

    Some(LogEntry {
        timestamp,
        level,
        node,
        message,
        extra_fields: serde_json::Value::Object(map),
    })
}

/// Reads `path` and parses each non-empty line as a JSON log entry.
/// Lines that aren't valid/parsable are skipped; the rest of the file is
/// still parsed. Returns an empty list for an empty or all-invalid file.
fn parse_log_file(path: &Path) -> Vec<LogEntry> {
    let Ok(contents) = fs::read_to_string(path) else {
        return Vec::new();
    };
    contents
        .lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(parse_line)
        .collect()
}

/// Lists the direct (non-ignored) files in `dir`, skipping subdirectories —
/// those are already represented as separate nodes in the folder tree.
fn list_log_files(dir: &Path) -> Vec<std::path::PathBuf> {
    let mut files = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            if !file_type.is_file() {
                continue;
            }
            let name = entry.file_name();
            if crate::folder_scanner::is_ignored_file_name(&name.to_string_lossy()) {
                continue;
            }
            files.push(entry.path());
        }
    }
    files
}

/// Extracts a trailing `YYYY-MM-DD` date from a daily-rotated log file name
/// such as `elements--2026-07-16`. Returns `None` if the name has no such
/// suffix — such files are undated and are always included regardless of
/// any day filter, rather than silently dropped.
fn extract_date_from_filename(name: &str) -> Option<String> {
    let candidate = name.rsplit("--").next()?;
    let bytes = candidate.as_bytes();
    let is_digit = |b: u8| b.is_ascii_digit();
    let valid = bytes.len() == 10
        && bytes[0..4].iter().all(|&b| is_digit(b))
        && bytes[4] == b'-'
        && bytes[5..7].iter().all(|&b| is_digit(b))
        && bytes[7] == b'-'
        && bytes[8..10].iter().all(|&b| is_digit(b));
    valid.then(|| candidate.to_string())
}

/// Parses every log file directly inside `folder` (not recursively — a
/// subfolder is its own separate selection in the tree), concatenates their
/// entries, and sorts by timestamp (entries without one sort first, in
/// their original read order) so a multi-file folder reads chronologically
/// rather than in filesystem-dependent read_dir order.
///
/// When `dates` is `Some`, only files whose name carries one of those dates
/// are parsed — files with no parseable date are always included, since an
/// unrecognized naming pattern should never silently hide log data.
pub(crate) fn parse_log_folder(folder: &Path, dates: Option<&[String]>) -> Vec<LogEntry> {
    let files = list_log_files(folder);
    let filtered_files: Vec<_> = match dates {
        None => files,
        Some([]) => files,
        Some(dates) => files
            .into_iter()
            .filter(|file| {
                let name = file.file_name().unwrap_or_default().to_string_lossy();
                match extract_date_from_filename(&name) {
                    Some(date) => dates.iter().any(|d| d == &date),
                    None => true,
                }
            })
            .collect(),
    };

    let mut entries: Vec<LogEntry> = filtered_files
        .iter()
        .flat_map(|file| parse_log_file(file))
        .collect();
    entries.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));
    entries
}

#[tauri::command(async)]
pub fn log_parser(folder: String, dates: Option<Vec<String>>) -> Vec<LogEntry> {
    parse_log_folder(Path::new(&folder), dates.as_deref())
}

/// Lists the distinct dates found in daily-rotated log file names directly
/// inside `folder`, most recent first. Files with no parseable date do not
/// contribute a date but are still always shown by `log_parser`.
#[tauri::command(async)]
pub fn log_file_dates(folder: String) -> Vec<String> {
    let mut dates: Vec<String> = list_log_files(Path::new(&folder))
        .iter()
        .filter_map(|file| {
            let name = file.file_name()?.to_string_lossy().into_owned();
            extract_date_from_filename(&name)
        })
        .collect();
    dates.sort();
    dates.dedup();
    dates.reverse();
    dates
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::{tempdir, NamedTempFile};

    fn write_log_file(contents: &str) -> NamedTempFile {
        let file = NamedTempFile::new().unwrap();
        fs::write(file.path(), contents).unwrap();
        file
    }

    #[test]
    fn test_parse_valid_lines() {
        let file = write_log_file(
            "{\"message\": \"started\", \"level\": \"info\"}\n{\"message\": \"stopped\", \"level\": \"info\"}\n",
        );

        let entries = parse_log_file(file.path());

        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].message, "started");
        assert_eq!(entries[1].message, "stopped");
    }

    #[test]
    fn test_parse_skips_malformed_line() {
        let file =
            write_log_file("{\"message\": \"first\"}\nnot json at all\n{\"message\": \"third\"}\n");

        let entries = parse_log_file(file.path());

        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].message, "first");
        assert_eq!(entries[1].message, "third");
    }

    #[test]
    fn test_parse_missing_optional_fields() {
        let file = write_log_file("{\"message\": \"no timestamp or level\"}\n");

        let entries = parse_log_file(file.path());

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].message, "no timestamp or level");
        assert_eq!(entries[0].timestamp, None);
        assert_eq!(entries[0].level, None);
    }

    #[test]
    fn test_parse_empty_file() {
        let file = write_log_file("");

        let entries = parse_log_file(file.path());

        assert!(entries.is_empty());
    }

    #[test]
    fn test_parse_extra_fields_contains_the_full_original_entry() {
        let file = write_log_file(
            "{\"message\": \"m\", \"userId\": 42, \"request\": {\"path\": \"/x\"}}\n",
        );

        let entries = parse_log_file(file.path());

        assert_eq!(entries[0].extra_fields["userId"], 42);
        assert_eq!(entries[0].extra_fields["request"]["path"], "/x");
        // extra_fields keeps the complete original entry (including fields
        // also lifted into named struct fields), so the detail view never
        // shows only a subset of what the log line actually contained.
        assert_eq!(entries[0].extra_fields["message"], "m");
    }

    #[test]
    fn test_parse_folder_aggregates_all_files() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a"), "{\"message\": \"from a\"}\n").unwrap();
        fs::write(dir.path().join("b"), "{\"message\": \"from b\"}\n").unwrap();

        let mut entries = parse_log_folder(dir.path(), None);
        entries.sort_by(|a, b| a.message.cmp(&b.message));

        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].message, "from a");
        assert_eq!(entries[1].message, "from b");
    }

    #[test]
    fn test_parse_folder_ignores_os_junk_files() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join(".DS_Store"), b"not json").unwrap();
        fs::write(dir.path().join("app"), "{\"message\": \"real\"}\n").unwrap();

        let entries = parse_log_folder(dir.path(), None);

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].message, "real");
    }

    #[test]
    fn test_parse_folder_skips_subdirectories() {
        let dir = tempdir().unwrap();
        fs::create_dir(dir.path().join("nested")).unwrap();
        fs::write(
            dir.path().join("nested").join("app"),
            "{\"message\": \"nested\"}\n",
        )
        .unwrap();

        let entries = parse_log_folder(dir.path(), None);

        assert!(entries.is_empty());
    }

    #[test]
    fn test_parse_empty_folder() {
        let dir = tempdir().unwrap();

        let entries = parse_log_folder(dir.path(), None);

        assert!(entries.is_empty());
    }

    #[test]
    fn test_parse_monolog_style_entry() {
        // Real-world shape (Monolog): datetime/level_name instead of
        // timestamp/level, node identifier nested under "extra".
        let file = write_log_file(&format!(
            "{}\n",
            serde_json::json!({
                "message": "DIAS | Originele error:{ \"Area\": \"Overig\", \"Hint\": \"Internal Server Error\" }",
                "context": {},
                "level_name": "CRITICAL",
                "channel": "Elements",
                "datetime": "2026-07-14T09:58:15.476491+02:00",
                "extra": {
                    "coreversion": "19.8.0",
                    "databasenaam": "web02",
                    "id": "6a55ec1774141"
                }
            })
        ));

        let entries = parse_log_file(file.path());

        assert_eq!(entries.len(), 1);
        assert_eq!(
            entries[0].timestamp.as_deref(),
            Some("2026-07-14T09:58:15.476491+02:00")
        );
        assert_eq!(entries[0].level.as_deref(), Some("CRITICAL"));
        assert_eq!(entries[0].node.as_deref(), Some("web02"));
        assert!(entries[0].message.contains("Internal Server Error"));
        // "extra" (incl. databasenaam) stays fully visible in the detail
        // view even though databasenaam was also promoted to `node`.
        assert_eq!(entries[0].extra_fields["extra"]["databasenaam"], "web02");
        assert_eq!(entries[0].extra_fields["channel"], "Elements");
    }

    #[test]
    fn test_extract_date_from_filename() {
        assert_eq!(
            extract_date_from_filename("elements--2026-07-16"),
            Some("2026-07-16".to_string())
        );
        assert_eq!(extract_date_from_filename("elements"), None);
        assert_eq!(extract_date_from_filename("elements--not-a-date"), None);
    }

    #[test]
    fn test_log_file_dates_lists_distinct_dates_most_recent_first() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("elements--2026-07-14"), "").unwrap();
        fs::write(dir.path().join("elements--2026-07-16"), "").unwrap();
        fs::write(dir.path().join("errors--2026-07-16"), "").unwrap();
        fs::write(dir.path().join("undated"), "").unwrap();

        let dates = log_file_dates(dir.path().to_string_lossy().into_owned());

        assert_eq!(dates, vec!["2026-07-16", "2026-07-14"]);
    }

    #[test]
    fn test_parse_folder_filters_by_date() {
        let dir = tempdir().unwrap();
        fs::write(
            dir.path().join("elements--2026-07-14"),
            "{\"message\": \"day14\"}\n",
        )
        .unwrap();
        fs::write(
            dir.path().join("elements--2026-07-16"),
            "{\"message\": \"day16\"}\n",
        )
        .unwrap();

        let entries = parse_log_folder(dir.path(), Some(&["2026-07-16".to_string()]));

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].message, "day16");
    }

    #[test]
    fn test_parse_folder_date_filter_always_includes_undated_files() {
        let dir = tempdir().unwrap();
        fs::write(
            dir.path().join("elements--2026-07-14"),
            "{\"message\": \"day14\"}\n",
        )
        .unwrap();
        fs::write(dir.path().join("undated"), "{\"message\": \"no date\"}\n").unwrap();

        let mut entries = parse_log_folder(dir.path(), Some(&["2026-07-16".to_string()]));
        entries.sort_by(|a, b| a.message.cmp(&b.message));

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].message, "no date");
    }
}
