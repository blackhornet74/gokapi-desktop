use std::collections::HashMap;
use std::path::PathBuf;
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
    #[serde(rename = "UploadDate", default)]
    upload_date: i64,
    #[serde(rename = "ExpireAt", default)]
    expire_at: i64,
    #[serde(rename = "DownloadCount", default)]
    download_count: i64,
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
    let code = if error.is_timeout() {
        "timeout"
    } else {
        "network"
    };
    CommandError::with_detail(code, error.to_string())
}

pub struct UploadRequest {
    pub server: Url,
    pub key: String,
    pub path: PathBuf,
    pub display_name: String,
    pub options: UploadOptions,
    pub job_id: String,
    pub token: CancellationToken,
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
    request: UploadRequest,
) -> Result<HistoryEntry, CommandError> {
    let UploadRequest {
        server,
        key,
        path,
        display_name,
        options,
        job_id,
        token,
    } = request;
    let info = probe(&server, &key).await?;
    if info.e2e {
        return Err(CommandError::new("e2e_required"));
    }

    let metadata = tokio::fs::metadata(&path)
        .await
        .map_err(|error| CommandError::io(format!("{}: {error}", path.display())))?;
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
    let file = tokio::fs::File::open(&path)
        .await
        .map_err(|error| CommandError::io(format!("{}: {error}", path.display())))?;

    let sent = Arc::new(AtomicU64::new(0));
    let last_emit = Arc::new(std::sync::Mutex::new(
        Instant::now() - Duration::from_secs(1),
    ));
    let progress_app = app.clone();
    let progress_id = job_id.clone();
    let stream = tokio_util::io::ReaderStream::new(file).map(move |item| {
        if let Ok(chunk) = &item {
            let current =
                sent.fetch_add(chunk.len() as u64, Ordering::Relaxed) + chunk.len() as u64;
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
        .file_name(display_name.clone())
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
    let url = Url::parse(&parsed.file.url_download).map_err(|_| {
        CommandError::with_detail("invalid_response", parsed.file.url_download.clone())
    })?;
    if !same_origin(&server, &url) {
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
        name: display_name,
        url: url.to_string(),
        time: iso_timestamp(parsed.file.upload_date).unwrap_or_else(|| {
            chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
        }),
        downloads: parsed.file.download_count,
        last_download: None,
        expires_at: iso_timestamp(parsed.file.expire_at),
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

#[derive(Deserialize)]
struct ListedFile {
    #[serde(rename = "Id")]
    id: String,
    #[serde(rename = "Name")]
    name: String,
    #[serde(rename = "UrlDownload")]
    url: String,
    #[serde(rename = "UploadDate", default)]
    upload_date: i64,
    #[serde(rename = "ExpireAt", default)]
    expire_at: i64,
    #[serde(rename = "DownloadCount", default)]
    downloads: i64,
}

#[derive(Deserialize)]
struct LogsResponse {
    #[serde(rename = "logEntries")]
    entries: String,
}

pub struct ServerHistory {
    pub entries: Vec<HistoryEntry>,
    pub logs_available: bool,
}

fn iso_timestamp(seconds: i64) -> Option<String> {
    if seconds <= 0 {
        return None;
    }
    chrono::DateTime::<chrono::Utc>::from_timestamp(seconds, 0)
        .map(|date| date.to_rfc3339_opts(chrono::SecondsFormat::Secs, true))
}

pub async fn list_history(server: &Url, key: &str) -> Result<ServerHistory, CommandError> {
    let endpoint = server
        .join("api/files/list")
        .map_err(|_| CommandError::new("invalid_url"))?;
    let response = client(Duration::from_secs(30))?
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
    let files: Vec<ListedFile> = serde_json::from_str(&body)?;

    let (downloads, logs_available) = match fetch_last_downloads(server, key).await {
        Ok(map) => (map, true),
        Err(_) => (HashMap::new(), false),
    };

    let mut entries = Vec::new();
    for file in files {
        let Ok(url) = Url::parse(&file.url) else {
            continue;
        };
        if !same_origin(server, &url) {
            continue;
        }
        entries.push(HistoryEntry {
            id: file.id.clone(),
            name: file.name,
            url: url.to_string(),
            time: iso_timestamp(file.upload_date).unwrap_or_else(|| {
                chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
            }),
            downloads: file.downloads,
            last_download: downloads
                .get(&file.id)
                .and_then(|seconds| iso_timestamp(*seconds)),
            expires_at: iso_timestamp(file.expire_at),
        });
    }
    entries.sort_by(|left, right| right.time.cmp(&left.time));
    Ok(ServerHistory {
        entries,
        logs_available,
    })
}

async fn fetch_last_downloads(
    server: &Url,
    key: &str,
) -> Result<HashMap<String, i64>, CommandError> {
    let endpoint = server
        .join("api/logs/get?timestamp=0")
        .map_err(|_| CommandError::new("invalid_url"))?;
    let response = client(Duration::from_secs(30))?
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
    let parsed: LogsResponse = serde_json::from_str(&body)?;
    Ok(parse_last_downloads(&parsed.entries))
}

fn parse_last_downloads(logs: &str) -> HashMap<String, i64> {
    let mut result: HashMap<String, i64> = HashMap::new();
    for line in logs.lines() {
        let Some((stamp, rest)) = line.split_once("   [download] ") else {
            continue;
        };
        let Ok(date) =
            chrono::NaiveDateTime::parse_from_str(stamp.trim(), "%a, %d %b %Y %H:%M:%S UTC")
        else {
            continue;
        };
        let Some(position) = rest.rfind(", ID ") else {
            continue;
        };
        let tail = &rest[position + 5..];
        let Some(end) = tail.find(',') else {
            continue;
        };
        let id = tail[..end].trim();
        if id.is_empty() {
            continue;
        }
        let seconds = date.and_utc().timestamp();
        result
            .entry(id.to_string())
            .and_modify(|current| {
                if seconds > *current {
                    *current = seconds;
                }
            })
            .or_insert(seconds);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_host_without_trailing_slash() {
        let url = normalize_server("https://files.example.com").unwrap();
        assert_eq!(url.as_str(), "https://files.example.com/");
        let nested = normalize_server("https://example.com/gokapi").unwrap();
        assert_eq!(nested.as_str(), "https://example.com/gokapi/");
    }

    #[test]
    fn rejects_invalid_server_urls() {
        for value in [
            "",
            "files.example.com",
            "ftp://files.example.com",
            "https://user:secret@files.example.com",
            "https://files.example.com/?token=1",
            "https://files.example.com/#fragment",
        ] {
            assert_eq!(
                normalize_server(value).unwrap_err().code,
                "invalid_url",
                "accepted {value}"
            );
        }
    }

    #[test]
    fn accepts_only_same_origin_download_links() {
        let server = normalize_server("https://files.example.com").unwrap();
        let same = Url::parse("https://files.example.com/d?id=abc").unwrap();
        let other_host = Url::parse("https://evil.example.net/d?id=abc").unwrap();
        let other_port = Url::parse("https://files.example.com:8443/d?id=abc").unwrap();
        assert!(same_origin(&server, &same));
        assert!(!same_origin(&server, &other_host));
        assert!(!same_origin(&server, &other_port));
    }

    #[test]
    fn parses_the_last_download_for_each_file() {
        let logs =
            "Fri, 27 Nov 2026 10:00:00 UTC   [download] first.zip, ID abc123, Useragent one\n\
Sat, 28 Nov 2026 09:30:00 UTC   [download] first.zip, ID abc123, Useragent two\n\
Fri, 27 Nov 2026 12:00:00 UTC   [download] second.zip, ID def456, Useragent three\n\
Fri, 27 Nov 2026 12:00:00 UTC   [upload] third.zip, ID ghi789, uploaded by someone\n";
        let parsed = parse_last_downloads(logs);
        let latest = chrono::NaiveDate::from_ymd_opt(2026, 11, 28)
            .unwrap()
            .and_hms_opt(9, 30, 0)
            .unwrap()
            .and_utc()
            .timestamp();
        let other = chrono::NaiveDate::from_ymd_opt(2026, 11, 27)
            .unwrap()
            .and_hms_opt(12, 0, 0)
            .unwrap()
            .and_utc()
            .timestamp();
        assert_eq!(parsed.get("abc123"), Some(&latest));
        assert_eq!(parsed.get("def456"), Some(&other));
        assert!(!parsed.contains_key("ghi789"));
    }
}
