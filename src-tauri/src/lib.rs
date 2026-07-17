mod folder_scanner;
mod log_parser;
mod root_folders;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            root_folders::add_root_folder,
            root_folders::list_root_folders,
            folder_scanner::folder_scanner,
            log_parser::log_parser
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
