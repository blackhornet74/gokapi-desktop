use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tokio_util::sync::CancellationToken;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub server_url: String,
    pub days: i64,
    pub downloads: i64,
    pub language: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            server_url: String::new(),
            days: 5,
            downloads: 0,
            language: "en".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: String,
    pub name: String,
    pub url: String,
    pub time: String,
    #[serde(default)]
    pub downloads: i64,
    #[serde(default)]
    pub last_download: Option<String>,
    #[serde(default)]
    pub expires_at: Option<String>,
}

pub struct AppState {
    pub data_dir: PathBuf,
    pub settings: Mutex<Settings>,
    pub history: Mutex<Vec<HistoryEntry>>,
    pub jobs: Mutex<HashMap<String, CancellationToken>>,
    pub quitting: AtomicBool,
}

const MAX_HISTORY: usize = 100;

fn read_json<T: for<'de> Deserialize<'de>>(path: &Path) -> Option<T> {
    let text = fs::read_to_string(path).ok()?;
    serde_json::from_str(&text).ok()
}

fn write_json<T: Serialize>(path: &Path, value: &T) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let serialized = serde_json::to_vec_pretty(value)
        .map_err(|error| std::io::Error::new(std::io::ErrorKind::InvalidData, error))?;
    let temporary = path.with_extension("tmp");
    fs::write(&temporary, serialized)?;
    fs::rename(&temporary, path)
}

fn settings_path(data_dir: &Path) -> PathBuf {
    data_dir.join("settings.json")
}

fn history_path(data_dir: &Path) -> PathBuf {
    data_dir.join("history.json")
}

impl AppState {
    pub fn new(data_dir: PathBuf) -> Self {
        let _ = fs::create_dir_all(&data_dir);
        let settings = read_json(&settings_path(&data_dir)).unwrap_or_default();
        let history = read_json::<Vec<HistoryEntry>>(&history_path(&data_dir)).unwrap_or_default();
        Self {
            data_dir,
            settings: Mutex::new(settings),
            history: Mutex::new(history),
            jobs: Mutex::new(HashMap::new()),
            quitting: AtomicBool::new(false),
        }
    }

    pub fn save_settings(&self) -> std::io::Result<()> {
        let settings = self.settings.lock().unwrap().clone();
        write_json(&settings_path(&self.data_dir), &settings)
    }

    pub fn snapshot_settings(&self) -> Settings {
        self.settings.lock().unwrap().clone()
    }

    pub fn snapshot_history(&self) -> Vec<HistoryEntry> {
        self.history.lock().unwrap().clone()
    }

    pub fn add_history(&self, entry: HistoryEntry) {
        let mut history = self.history.lock().unwrap();
        history.retain(|existing| existing.id != entry.id);
        history.insert(0, entry);
        history.truncate(MAX_HISTORY);
        if let Err(error) = write_json(&history_path(&self.data_dir), &*history) {
            eprintln!("could not persist history: {error}");
        }
    }

    pub fn replace_history(&self, entries: Vec<HistoryEntry>) {
        let mut history = self.history.lock().unwrap();
        *history = entries;
        if let Err(error) = write_json(&history_path(&self.data_dir), &*history) {
            eprintln!("could not persist history: {error}");
        }
    }
    pub fn remove_history(&self, ids: &[String]) -> Vec<HistoryEntry> {
        let mut history = self.history.lock().unwrap();
        history.retain(|entry| !ids.iter().any(|id| id == &entry.id));
        if let Err(error) = write_json(&history_path(&self.data_dir), &*history) {
            eprintln!("could not persist history: {error}");
        }
        history.clone()
    }
}
