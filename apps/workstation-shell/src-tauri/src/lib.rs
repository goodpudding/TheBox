use keyring::Entry;
use std::process::Command;
use tauri::Manager;
use tauri_plugin_autostart::MacosLauncher;

const SERVICE: &str = "org.discoverburien.thebox.workstation";
const USER: &str = "session-token";

fn entry() -> Result<Entry, String> {
    Entry::new(SERVICE, USER).map_err(|e| e.to_string())
}

#[tauri::command]
fn store_session_token(token: String) -> Result<(), String> {
    entry()?.set_password(&token).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_session_token() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(err.to_string()),
    }
}

#[tauri::command]
fn clear_session_token() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(err.to_string()),
    }
}

#[tauri::command]
fn launch_executable(path: String) -> Result<(), String> {
    // Detach. Do not keep a Child handle to kill on logout — prints/spooler
    // jobs must keep running after the member leaves the desk.
    Command::new(&path)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_webview_data(window: tauri::WebviewWindow) -> Result<(), String> {
    window
        .clear_all_browsing_data()
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let site = std::env::var("THE_BOX_URL")
        .unwrap_or_else(|_| "http://localhost:3000/workstation".into());

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .setup(move |app| {
            if let Some(window) = app.get_webview_window("main") {
                let js = format!(
                    "window.location.replace({})",
                    serde_json::to_string(&site).unwrap_or_else(|_| "\"/\"".into())
                );
                let _ = window.eval(&js);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            store_session_token,
            get_session_token,
            clear_session_token,
            launch_executable,
            clear_webview_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running The Box workstation");
}
