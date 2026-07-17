mod folder_scanner;
mod log_parser;
mod log_watcher;
mod root_folders;
mod settings;

use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

const SETTINGS_WINDOW_LABEL: &str = "settings";
const OPEN_SETTINGS_MENU_ID: &str = "open_settings";

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Shows and focuses the settings window if it's already open, rather than
/// creating a second one — matches how native macOS Preferences windows
/// behave when reopened from the app menu.
fn open_or_focus_settings_window<R: tauri::Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(SETTINGS_WINDOW_LABEL) {
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }

    let _ = WebviewWindowBuilder::new(
        app,
        SETTINGS_WINDOW_LABEL,
        WebviewUrl::App("settings.html".into()),
    )
    .title("Instellingen")
    .inner_size(360.0, 340.0)
    .resizable(false)
    .build();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(log_watcher::WatcherState::default())
        .setup(|app| {
            let settings_item = MenuItemBuilder::with_id(OPEN_SETTINGS_MENU_ID, "Instellingen…")
                .accelerator("CmdOrCtrl+,")
                .build(app)?;

            // macOS convention: the app's own menu holds About, Settings,
            // Services, Hide/Quit — in that order, ahead of Edit/Window.
            let app_menu = SubmenuBuilder::new(app, "Timber")
                .item(&PredefinedMenuItem::about(app, Some("Over Timber"), None)?)
                .separator()
                .item(&settings_item)
                .separator()
                .item(&PredefinedMenuItem::services(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::hide(app, None)?)
                .item(&PredefinedMenuItem::hide_others(app, None)?)
                .item(&PredefinedMenuItem::show_all(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::quit(app, None)?)
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .item(&PredefinedMenuItem::undo(app, None)?)
                .item(&PredefinedMenuItem::redo(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::cut(app, None)?)
                .item(&PredefinedMenuItem::copy(app, None)?)
                .item(&PredefinedMenuItem::paste(app, None)?)
                .item(&PredefinedMenuItem::select_all(app, None)?)
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_menu)
                .item(&edit_menu)
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(move |app, event| {
                if event.id().as_ref() == OPEN_SETTINGS_MENU_ID {
                    open_or_focus_settings_window(app);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            root_folders::add_root_folder,
            root_folders::list_root_folders,
            root_folders::remove_root_folder,
            root_folders::rename_root_folder,
            folder_scanner::folder_scanner,
            log_parser::log_parser,
            log_parser::log_file_dates,
            log_watcher::watch_log_folder,
            log_watcher::stop_watching,
            settings::get_date_format_settings,
            settings::save_date_format_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_store_plugin_registered() {
        // A store-plugin Builder must construct and build without panicking,
        // matching how `run()` registers it on the Tauri app builder.
        let _plugin = tauri_plugin_store::Builder::default().build::<tauri::Wry>();
    }
}
