use std::{env, path::PathBuf};

pub fn user_data_dir() -> PathBuf {
    let base = if cfg!(target_os = "windows") {
        env::var_os("APPDATA")
            .map(PathBuf::from)
            .or_else(|| {
                env::var_os("USERPROFILE")
                    .map(|home| PathBuf::from(home).join("AppData").join("Roaming"))
            })
            .unwrap_or_else(|| PathBuf::from("."))
    } else if cfg!(target_os = "macos") {
        home_dir()
            .map(|home| home.join("Library").join("Application Support"))
            .unwrap_or_else(|| PathBuf::from("."))
    } else {
        env::var_os("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .or_else(|| home_dir().map(|home| home.join(".config")))
            .unwrap_or_else(|| PathBuf::from("."))
    };

    let dir = base.join("WordScript");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

pub fn config_file_path() -> PathBuf {
    user_data_dir().join("config.json")
}

pub fn scratchpad_file_path() -> PathBuf {
    user_data_dir().join("scratchpad.json")
}

fn home_dir() -> Option<PathBuf> {
    env::var_os("HOME")
        .map(PathBuf::from)
        .or_else(|| env::var_os("USERPROFILE").map(PathBuf::from))
}
