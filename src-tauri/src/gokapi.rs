use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use futures_util::StreamExt;
use reqwest::multipart::{Form, Part};
use reqwest::Body;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio_util::sync::CancellationToken;
use url::Url;

use crate::error::CommandError;
use crate::state::HistoryEntry;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadOptions {
    pub days: i64,
    pub downloads: i64,
    pub password: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerInfo {
    pub max_file_size_mb: i64,
    pub max_chunk_size_mb: i64,
    pub e2e: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Progress {
    id: String,
    sent: u64,
    total: u64,
}

#[derive(Deserialize)]
struct ConfigInfo {
    #[serde(rename = "MaxFilesize")]
    max_file_size: i64,
    #[serde(rename = "MaxChunksize")]
    max_chunk_size: i64,
    #[serde(rename = "EndToEndEncryptionEnabled")]
    e2e: bool,
}

#[derive(Deserialize)]
struct AddResponse {
    #[serde(rename = "Result")]
    result: String,
    #[serde(rename = "FileInfo")]
    file: FileInfo,
}

#[derive(Deserialize)]
struct FileInfo {
    #[serde(rename = "Id")]
    id: String,
    #[serde(rename = "UrlDownload")]
    url_download: String,
}

pub fn normalize_server(input: &str) -> Result<Url, CommandError> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err(CommandError::new("invalid_url"));
    }
    let mut url = Url::parse(trimmed).map_err(|_| CommandError::new("invalid_url"))?;
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
        return Err(CommandError::new("invalid_url"));
    }
    if !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(CommandError::new("invalid_url"));
    }
    let path = url.path().trim_end_matches('/');
    url.set_path(&if path.is_empty() {
        "/".to_string()
    } else {
        format!("{path}/")
    });
    Ok(url)
}

fn client(timeout: Duration) -> Result<reqwest::Client, CommandError> {
    reqwest::Client::builder()
        .timeout(timeout)
        .user_agent(concat!("gokapi-desktop/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|error| CommandError::with_detail("network", error.to_string()))
}

fn map_status(status: reqwest::StatusCode, body: &str) -> CommandError {
    let detail = if body.trim().is_empty() {
        None
    } else {
        Some(body.chars().take(300).collect::<String>())
    };
    let code = match status.as_u16() {
        401 => "unauthorized",
        403 => "forbidden",
        404 => "not_found",
        413 => "file_too_large",
        408 | 504 => "timeout",
        500..=599 => "server",
        _ => "server",
    };
    CommandError {
        code: code.to_string(),
        detail,
    }
}

fn map_reqwest(error: reqwest::Error) -> CommandError {
    if error.is_timeout() {
        CommandError::with_detail("timeout", error.to_string())
    } else if error.is_connect() || error.is_request() || error.is_body() {
        CommandError::with_detail("network", error.to_string())
    } else {
        CommandError::with_detail("network", error.to_string())
    }
}

fn same_origin(base: &Url, candidate: &Url) -> bool {
    let host = |value: &Url| value.host_str().map(|host| host.to_ascii_lowercase());
    base.scheme() == candidate.scheme()
        && host(base) == host(candidate)
        && base.port_or_known_default() == candidate.port_or_known_default()
}

pub async fn probe(server: &Url, key: &str) -> Result<ServerInfo, CommandError> {
    let endpoint = server
        .join("api/info/config")
        .map_err(|_| CommandError::new("invalid_url"))?;
    let response = client(Duration::from_secs(20))?
        .get(endpoint)
        .header("apikey", key)
        .send()
        .await
        .map_err(map_reqwest)?;
    let status = response.status();
    let body = response.text().await.map_err(map_reqwest)?;
    if !status.is_success() {
        return Err(map_status(status, &body));
    }
    let info: ConfigInfo = serde_json::from_str(&body)?;
    Ok(ServerInfo {
        max_file_size_mb: info.max_file_size,
        max_chunk_size_mb: info.max_chunk_size,
        e2e: info.e2e,
    })
}

pub async fn upload_path(
    app: &AppHandle,
    server: &Url,
    key: &str,
    path: &Path,
    display_name: &str,
    options: &UploadOptions,
    job_id: &str,
    token: CancellationToken,
) -> Result<HistoryEntry, CommandError> {
    let info = probe(server, key).await?;
    if info.e2e {
        return Err(CommandError::new("e2e_required"));
    }

    let metadata = tokio::fs::metadata(path).await.map_err(|error| {
        CommandError::io(format!("{}: {error}", path.display()))
    })?;
    let total = metadata.len();
    let limit = info.max_file_size_mb.max(0) as u64 * 1024 * 1024;
    if limit > 0 && total > limit {
        return Err(CommandError::with_detail(
            "file_too_large",
            format!("{total} > {limit}"),
        ));
    }

    let endpoint = server
        .join("api/files/add")
        .map_err(|_| CommandError::new("invalid_url"))?;
    let file = tokio::fs::File::open(path)
        .await
        .map_err(|error| CommandError::io(format!("{}: {error}", path.display())))?;

    let sent = Arc::new(AtomicU64::new(0));
    let last_emit = Arc::new(std::sync::Mutex::new(Instant::now() - Duration::from_secs(1)));
    let progress_app = app.clone();
    let progress_id = job_id.to_string();
    let stream = tokio_util::io::ReaderStream::new(file).map(move |item| {
        if let Ok(chunk) = &item {
            let current = sent.fetch_add(chunk.len() as u64, Ordering::Relaxed) + chunk.len() as u64;
            let mut last = last_emit.lock().unwrap();
            if last.elapsed() >= Duration::from_millis(120) || current >= total {
                *last = Instant::now();
                let _ = progress_app.emit(
                    "upload-progress",
                    Progress {
                        id: progress_id.clone(),
                        sent: current,
                        total,
                    },
                );
            }
        }
        item
    });

    let part = Part::stream_with_length(Body::wrap_stream(stream), total)
        .file_name(display_name.to_string())
        .mime_str("application/octet-stream")
        .map_err(|error| CommandError::with_detail("network", error.to_string()))?;
    let form = Form::new()
        .part("file", part)
        .text("expiryDays", options.days.to_string())
        .text("allowedDownloads", options.downloads.to_string())
        .text("password", options.password.clone());

    let request = client(Duration::from_secs(1800))?
        .post(endpoint)
        .header("apikey", key)
        .multipart(form);

    let response = tokio::select! {
        biased;
        _ = token.cancelled() => return Err(CommandError::new("cancelled")),
        result = request.send() => result.map_err(map_reqwest)?,
    };

    let status = response.status();
    let body = tokio::select! {
        biased;
        _ = token.cancelled() => return Err(CommandError::new("cancelled")),
        result = response.text() => result.map_err(map_reqwest)?,
    };
    if !status.is_success() {
        return Err(map_status(status, &body));
    }

    let parsed: AddResponse = serde_json::from_str(&body)?;
    if parsed.result != "OK" {
        return Err(CommandError::with_detail("server", body));
    }
    let url = Url::parse(&parsed.file.url_download)
        .map_err(|_| CommandError::with_detail("invalid_response", parsed.file.url_download.clone()))?;
    if !same_origin(server, &url) {
        return Err(CommandError::with_detail(
            "invalid_response",
            "download URL points to another origin",
        ));
    }
    if parsed.file.id.trim().is_empty() {
        return Err(CommandError::new("invalid_response"));
    }

    Ok(HistoryEntry {
        id: parsed.file.id,
        name: display_name.to_string(),
        url: url.to_string(),
        time: chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true),
    })
}

pub async fn delete_file(server: &Url, key: &str, id: &str) -> Result<(), CommandError> {
    let endpoint = server
        .join("api/files/delete")
        .map_err(|_| CommandError::new("invalid_url"))?;
    let response = client(Duration::from_secs(60))?
        .delete(endpoint)
        .header("apikey", key)
        .header("id", id)
        .send()
        .await
        .map_err(map_reqwest)?;
    let status = response.status();
    let body = response.text().await.map_err(map_reqwest)?;

    if status.as_u16() == 404 {
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&body) {
            if value.get("ErrorCode").and_then(|code| code.as_i64()) == Some(5) {
                return Ok(());
            }
        }
        return Err(CommandError::new("not_found"));
    }
    if !status.is_success() {
        return Err(map_status(status, &body));
    }
    Ok(())
}
