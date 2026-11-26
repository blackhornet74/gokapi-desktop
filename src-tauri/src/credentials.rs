use std::fs;
use std::path::PathBuf;

use keyring::Entry;

use crate::state::AppState;

pub const SERVICE: &str = "io.github.blackhornet74.gokapi-desktop";
const ACCOUNT: &str = "api-key";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeySource {
    Keyring,
    File,
}

impl KeySource {
    pub fn as_str(self) -> &'static str {
        match self {
            KeySource::Keyring => "keyring",
            KeySource::File => "file",
        }
    }
}

fn file_path(state: &AppState) -> PathBuf {
    state.data_dir.join("api-key")
}

fn keyring_entry() -> Result<Entry, String> {
    Entry::new(SERVICE, ACCOUNT).map_err(|error| error.to_string())
}

pub fn load_keyring() -> Option<String> {
    let entry = keyring_entry().ok()?;
    match entry.get_password() {
        Ok(key) if !key.trim().is_empty() => Some(key),
        _ => None,
    }
}

pub fn load_file(state: &AppState) -> Option<String> {
    fs::read_to_string(file_path(state))
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

pub fn status(state: &AppState) -> (bool, Option<KeySource>) {
    if load_keyring().is_some() {
        return (true, Some(KeySource::Keyring));
    }
    if load_file(state).is_some() {
        return (true, Some(KeySource::File));
    }
    (false, None)
}

pub fn load(state: &AppState) -> Option<String> {
    load_keyring().or_else(|| load_file(state))
}

pub fn save_keyring(key: &str) -> Result<(), String> {
    keyring_entry()?
        .set_password(key)
        .map_err(|error| error.to_string())
}

pub fn save_file(state: &AppState, key: &str) -> std::io::Result<()> {
    let path = file_path(state);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    #[cfg(unix)]
    {
        use std::io::Write;
        use std::os::unix::fs::OpenOptionsExt;
        let mut file = fs::OpenOptions::new()
            .create(true)
            .truncate(true)
            .write(true)
            .mode(0o600)
            .open(&path)?;
        file.write_all(key.as_bytes())?;
    }
    #[cfg(not(unix))]
    {
        fs::write(&path, key)?;
    }
    Ok(())
}

pub fn delete_file(state: &AppState) {
    let _ = fs::remove_file(file_path(state));
}

pub fn delete_all(state: &AppState) {
    if let Ok(entry) = keyring_entry() {
        let _ = entry.delete_credential();
    }
    delete_file(state);
}
