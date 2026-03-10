//! Config persistence at ~/.config/re/config.json.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub last_repo: Option<String>,
    pub recent_repos: Vec<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            last_repo: None,
            recent_repos: Vec::new(),
        }
    }
}

fn home_dir() -> String {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".into())
}

fn config_path() -> PathBuf {
    PathBuf::from(home_dir())
        .join(".config")
        .join("re")
        .join("config.json")
}

/// Returns the user's home directory (cross-platform).
pub fn get_home_dir() -> String {
    home_dir()
}

pub fn load_config() -> AppConfig {
    let path = config_path();
    match fs::read_to_string(&path) {
        Ok(contents) => serde_json::from_str(&contents).unwrap_or_default(),
        Err(_) => AppConfig::default(),
    }
}

pub fn save_config(config: &AppConfig) {
    let path = config_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(config) {
        let _ = fs::write(&path, json);
    }
}
