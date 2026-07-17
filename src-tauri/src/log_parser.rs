use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    pub timestamp: Option<String>,
    pub level: Option<String>,
    pub message: String,
    pub extra_fields: serde_json::Value,
}

const TIMESTAMP_KEYS: &[&str] = &["timestamp", "time", "ts", "@timestamp"];
const LEVEL_KEYS: &[&str] = &["level", "lvl", "severity"];
const MESSAGE_KEYS: &[&str] = &["message", "msg"];

fn take_string_field(value: &mut serde_json::Map<String, serde_json::Value>, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(serde_json::Value::String(s)) = value.remove(*key) {
            return Some(s);
        }
    }
    None
}

/// Parses one JSON-per-line entry. Returns `None` if the line is not valid
/// JSON, isn't a JSON object, or has no message field — such lines are
/// skipped rather than failing the whole file.
fn parse_line(line: &str) -> Option<LogEntry> {
    let value: serde_json::Value = serde_json::from_str(line).ok()?;
    let serde_json::Value::Object(mut map) = value else {
        return None;
    };

    let message = take_string_field(&mut map, MESSAGE_KEYS)?;
    let timestamp = take_string_field(&mut map, TIMESTAMP_KEYS);
    let level = take_string_field(&mut map, LEVEL_KEYS);

    Some(LogEntry {
        timestamp,
        level,
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

#[tauri::command(async)]
pub fn log_parser(path: String) -> Vec<LogEntry> {
    parse_log_file(Path::new(&path))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;

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
        let file = write_log_file(
            "{\"message\": \"first\"}\nnot json at all\n{\"message\": \"third\"}\n",
        );

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
    fn test_parse_extra_fields_preserved_in_detail() {
        let file = write_log_file(
            "{\"message\": \"m\", \"userId\": 42, \"request\": {\"path\": \"/x\"}}\n",
        );

        let entries = parse_log_file(file.path());

        assert_eq!(entries[0].extra_fields["userId"], 42);
        assert_eq!(entries[0].extra_fields["request"]["path"], "/x");
        // Fields lifted into named struct fields aren't duplicated here.
        assert!(entries[0].extra_fields.get("message").is_none());
    }
}
