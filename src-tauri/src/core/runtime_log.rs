use std::collections::VecDeque;
use std::sync::{Mutex, OnceLock};

const MAX_RUNTIME_LOG_ENTRIES: usize = 400;

fn runtime_log_store() -> &'static Mutex<VecDeque<String>> {
    static STORE: OnceLock<Mutex<VecDeque<String>>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(VecDeque::with_capacity(MAX_RUNTIME_LOG_ENTRIES)))
}

pub fn record(message: String) {
    eprintln!("{message}");

    let Ok(mut entries) = runtime_log_store().lock() else {
        return;
    };

    entries.push_back(message);
    while entries.len() > MAX_RUNTIME_LOG_ENTRIES {
        entries.pop_front();
    }
}

#[tauri::command]
pub fn runtime_log_entries() -> Result<Vec<String>, String> {
    let entries = runtime_log_store()
        .lock()
        .map_err(|error| error.to_string())?;
    Ok(entries.iter().cloned().collect())
}

#[tauri::command]
pub fn clear_runtime_log_entries() -> Result<Vec<String>, String> {
    let mut entries = runtime_log_store()
        .lock()
        .map_err(|error| error.to_string())?;
    entries.clear();
    Ok(Vec::new())
}
