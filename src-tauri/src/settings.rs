use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "settings.json";
const DATE_FORMAT_KEY: &str = "dateFormat";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DateFormatMode {
    /// Derive date/time conventions from the OS locale (via
    /// `Intl.DateTimeFormat` with no explicit locale on the frontend) rather
    /// than a fixed format — this is the default.
    System,
    Custom,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MonthStyle {
    Numeric,
    Short,
    Long,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum HourCycle {
    #[serde(rename = "h23")]
    H23,
    #[serde(rename = "h12")]
    H12,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DateFormatSettings {
    pub mode: DateFormatMode,
    pub month_style: MonthStyle,
    pub hour_cycle: HourCycle,
    pub show_seconds: bool,
}

impl Default for DateFormatSettings {
    fn default() -> Self {
        Self {
            mode: DateFormatMode::System,
            month_style: MonthStyle::Short,
            hour_cycle: HourCycle::H23,
            show_seconds: true,
        }
    }
}

fn stringify<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

/// Turns the raw JSON value read from the store into settings, defaulting
/// when absent or when it fails to deserialize (e.g. an older/incompatible
/// stored shape) rather than surfacing an error to the user.
fn resolve_stored_settings(raw: Option<serde_json::Value>) -> DateFormatSettings {
    raw.and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

#[tauri::command(async)]
pub fn get_date_format_settings(app: AppHandle) -> Result<DateFormatSettings, String> {
    let store = app.store(STORE_FILE).map_err(stringify)?;
    Ok(resolve_stored_settings(store.get(DATE_FORMAT_KEY)))
}

#[tauri::command(async)]
pub fn save_date_format_settings(
    app: AppHandle,
    settings: DateFormatSettings,
) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(stringify)?;
    let value = serde_json::to_value(settings).map_err(stringify)?;
    store.set(DATE_FORMAT_KEY, value);
    store.save().map_err(stringify)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_stored_settings_defaults_when_absent() {
        assert_eq!(resolve_stored_settings(None), DateFormatSettings::default());
    }

    #[test]
    fn test_resolve_stored_settings_defaults_on_invalid_shape() {
        let invalid = serde_json::json!({ "mode": "not-a-real-mode" });

        assert_eq!(
            resolve_stored_settings(Some(invalid)),
            DateFormatSettings::default()
        );
    }

    #[test]
    fn test_resolve_stored_settings_returns_stored_custom_settings() {
        let stored = serde_json::json!({
            "mode": "custom",
            "monthStyle": "long",
            "hourCycle": "h12",
            "showSeconds": false
        });

        let settings = resolve_stored_settings(Some(stored));

        assert_eq!(
            settings,
            DateFormatSettings {
                mode: DateFormatMode::Custom,
                month_style: MonthStyle::Long,
                hour_cycle: HourCycle::H12,
                show_seconds: false,
            }
        );
    }

    #[test]
    fn test_default_settings_use_system_mode() {
        assert_eq!(DateFormatSettings::default().mode, DateFormatMode::System);
    }
}
