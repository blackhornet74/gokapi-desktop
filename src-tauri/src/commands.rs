use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use tokio_util::sync::CancellationToken;

use crate::credentials;
use crate::error::CommandError;
use crate::gokapi::{self, UploadOptions};
use crate::state::{AppState, HistoryEntry, Settings};
use crate::zip;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bootstrap {
    settings: Settings,
    key_present: bool,
    key_source: Option<&'static str>,
    history: Vec<HistoryEntry>,
    version: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadResult {
    entry: HistoryEntry,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PickedImage {
    path: String,
    name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkDeleteResult {
    history: Vec<HistoryEntry>,
    failed: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    history: Vec<HistoryEntry>,
    logs_available: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadJob {
    id: String,
    path: String,
    name: String,
    is_folder: bool,
    temporary: bool,
    options: UploadOptions,
}

fn validated(mut settings: Settings) -> Result<Settings, CommandError> {
    let server = gokapi::normalize_server(&settings.server_url)?;
    settings.server_url = server.to_string();
    if !(0..=100_000).contains(&settings.days) || !(0..=100_000).contains(&settings.downloads) {
        return Err(CommandError::new("unsupported"));
    }
    settings.language = match settings.language.as_str() {
        "it" => "it".to_string(),
        _ => "en".to_string(),
    };
    Ok(settings)
}

#[tauri::command]
pub fn bootstrap(app: AppHandle, state: State<'_, AppState>) -> Bootstrap {
    let (key_present, key_source) = credentials::status(&state);
    Bootstrap {
        settings: state.snapshot_settings(),
        key_present,
        key_source: key_source.map(|source| source.as_str()),
        history: state.snapshot_history(),
        version: app.package_info().version.to_string(),
    }
}

#[tauri::command]
pub fn save_settings(state: State<'_, AppState>, settings: Settings) -> Result<(), CommandError> {
    let settings = validated(settings)?;
    {
        let mut current = state.settings.lock().unwrap();
        *current = settings;
    }
    state
        .save_settings()
        .map_err(|error| CommandError::io(error.to_string()))
}

#[tauri::command]
pub async fn verify_server(
    server_url: String,
    api_key: String,
) -> Result<gokapi::ServerInfo, CommandError> {
    let server = gokapi::normalize_server(&server_url)?;
    let key = api_key.trim();
    if key.is_empty() {
        return Err(CommandError::new("unauthorized"));
    }
    gokapi::probe(&server, key).await
}

#[tauri::command]
pub async fn save_api_key(
    state: State<'_, AppState>,
    api_key: String,
    allow_file_fallback: bool,
) -> Result<(), CommandError> {
    let key = api_key.trim().to_string();
    if key.is_empty() {
        return Err(CommandError::new("unauthorized"));
    }
    let key_for_blocking = key.clone();
    let saved =
        tauri::async_runtime::spawn_blocking(move || credentials::save_keyring(&key_for_blocking))
            .await
            .map_err(|error| CommandError::io(error.to_string()))?;
    match saved {
        Ok(()) => {
            credentials::delete_file(&state);
            Ok(())
        }
        Err(detail) => {
            if allow_file_fallback {
                credentials::save_file(&state, &key)
                    .map_err(|error| CommandError::io(error.to_string()))
            } else {
                Err(CommandError::with_detail("keyring_unavailable", detail))
            }
        }
    }
}

#[tauri::command]
pub async fn upload_file(
    app: AppHandle,
    state: State<'_, AppState>,
    job: UploadJob,
) -> Result<UploadResult, CommandError> {
    let settings = state.snapshot_settings();
    let server = gokapi::normalize_server(&settings.server_url)?;
    let key = credentials::load(&state).ok_or_else(|| CommandError::new("unauthorized"))?;

    let token = CancellationToken::new();
    state
        .jobs
        .lock()
        .unwrap()
        .insert(job.id.clone(), token.clone());

    let mut cleanup: Vec<PathBuf> = Vec::new();
    let is_folder = job.is_folder || std::path::Path::new(&job.path).is_dir();
    let outcome = async {
        let (path, name) = if is_folder {
            let source = PathBuf::from(&job.path);
            let base = source
                .file_name()
                .and_then(|name| name.to_str())
                .map(|name| name.to_string())
                .ok_or_else(|| CommandError::new("unsupported"))?;
            let zip_token = token.clone();
            let zip_path =
                tauri::async_runtime::spawn_blocking(move || zip::zip_folder(&source, &zip_token))
                    .await
                    .map_err(|error| CommandError::io(error.to_string()))??;
            (zip_path, format!("{base}.zip"))
        } else {
            (PathBuf::from(&job.path), job.name.clone())
        };

        if is_folder || job.temporary {
            cleanup.push(path.clone());
        }

        gokapi::upload_path(
            &app,
            gokapi::UploadRequest {
                server,
                key,
                path,
                display_name: name,
                options: job.options.clone(),
                job_id: job.id.clone(),
                token,
            },
        )
        .await
    }
    .await;

    state.jobs.lock().unwrap().remove(&job.id);
    for path in cleanup {
        let _ = std::fs::remove_file(path);
    }

    let entry = outcome?;
    state.add_history(entry.clone());
    Ok(UploadResult { entry })
}

#[tauri::command]
pub fn cancel_upload(state: State<'_, AppState>, id: String) {
    if let Some(token) = state.jobs.lock().unwrap().get(&id) {
        token.cancel();
    }
}

#[tauri::command]
pub async fn delete_remote(
    state: State<'_, AppState>,
    id: String,
) -> Result<Vec<HistoryEntry>, CommandError> {
    let settings = state.snapshot_settings();
    let server = gokapi::normalize_server(&settings.server_url)?;
    let key = credentials::load(&state).ok_or_else(|| CommandError::new("unauthorized"))?;
    gokapi::delete_file(&server, &key, &id).await?;
    Ok(state.remove_history(&[id]))
}

#[tauri::command]
pub async fn delete_remote_many(
    state: State<'_, AppState>,
    ids: Vec<String>,
) -> Result<BulkDeleteResult, CommandError> {
    let settings = state.snapshot_settings();
    let server = gokapi::normalize_server(&settings.server_url)?;
    let key = credentials::load(&state).ok_or_else(|| CommandError::new("unauthorized"))?;
    let names: std::collections::HashMap<String, String> = state
        .snapshot_history()
        .into_iter()
        .map(|entry| (entry.id, entry.name))
        .collect();

    let mut deleted = Vec::new();
    let mut failed = Vec::new();
    for id in &ids {
        match gokapi::delete_file(&server, &key, id).await {
            Ok(()) => deleted.push(id.clone()),
            Err(_) => failed.push(names.get(id).cloned().unwrap_or_else(|| id.clone())),
        }
    }

    Ok(BulkDeleteResult {
        history: state.remove_history(&deleted),
        failed,
    })
}

#[tauri::command]
pub fn remove_history(state: State<'_, AppState>, ids: Vec<String>) -> Vec<HistoryEntry> {
    state.remove_history(&ids)
}

#[tauri::command]
pub async fn sync_history(state: State<'_, AppState>) -> Result<SyncResult, CommandError> {
    let settings = state.snapshot_settings();
    let server = gokapi::normalize_server(&settings.server_url)?;
    let key = credentials::load(&state).ok_or_else(|| CommandError::new("unauthorized"))?;
    let result = gokapi::list_history(&server, &key).await?;
    state.replace_history(result.entries.clone());
    Ok(SyncResult {
        history: result.entries,
        logs_available: result.logs_available,
    })
}

#[tauri::command]
pub async fn paste_image() -> Result<Option<PickedImage>, CommandError> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut clipboard = arboard::Clipboard::new()
            .map_err(|error| CommandError::with_detail("unsupported", error.to_string()))?;
        let image = match clipboard.get_image() {
            Ok(image) => image,
            Err(_) => return Ok(None),
        };
        let rgba = image::RgbaImage::from_raw(
            image.width as u32,
            image.height as u32,
            image.bytes.into_owned(),
        )
        .ok_or_else(|| CommandError::new("unsupported"))?;
        let name = format!(
            "clipboard-{}.png",
            chrono::Local::now().format("%Y%m%d-%H%M%S")
        );
        let path = zip::temp_paste_path(&name);
        rgba.save_with_format(&path, image::ImageFormat::Png)
            .map_err(|error| CommandError::io(error.to_string()))?;
        Ok(Some(PickedImage {
            path: path.to_string_lossy().to_string(),
            name,
        }))
    })
    .await
    .map_err(|error| CommandError::io(error.to_string()))?
}

#[tauri::command]
pub fn open_portal(state: State<'_, AppState>, url: String) -> Result<(), CommandError> {
    let requested = gokapi::normalize_server(&url)?;
    let settings = state.snapshot_settings();
    let saved = gokapi::normalize_server(&settings.server_url)?;
    if requested != saved {
        return Err(CommandError::new("invalid_url"));
    }
    opener::open(requested.as_str()).map_err(|error| CommandError::io(error.to_string()))
}

#[tauri::command]
pub async fn prepare_archive(
    paths: Vec<String>,
    name: Option<String>,
) -> Result<PickedImage, CommandError> {
    if paths.len() < 2 {
        return Err(CommandError::new("unsupported"));
    }
    let sources: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();
    let display_name = zip::sanitize_archive_name(name.as_deref());
    let token = CancellationToken::new();
    let (path, name) = tauri::async_runtime::spawn_blocking(move || {
        zip::zip_sources(&sources, &token, &display_name)
    })
    .await
    .map_err(|error| CommandError::io(error.to_string()))??;
    Ok(PickedImage {
        path: path.to_string_lossy().to_string(),
        name,
    })
}
