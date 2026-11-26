use std::fs;
use std::path::{Path, PathBuf};

use tokio_util::sync::CancellationToken;
use uuid::Uuid;
use zip::write::SimpleFileOptions;

use crate::error::CommandError;

fn cleanup_on_error(
    path: &Path,
    result: Result<PathBuf, CommandError>,
) -> Result<PathBuf, CommandError> {
    if result.is_err() {
        let _ = fs::remove_file(path);
    }
    result
}

fn add_entry(
    zip: &mut zip::ZipWriter<fs::File>,
    root: &Path,
    current: &Path,
    token: &CancellationToken,
    options: SimpleFileOptions,
) -> Result<(), CommandError> {
    if token.is_cancelled() {
        return Err(CommandError::new("cancelled"));
    }
    let relative = current.strip_prefix(root).unwrap_or(current);
    let name = relative.to_string_lossy().replace('\\', "/");
    let metadata = fs::symlink_metadata(current)
        .map_err(|error| CommandError::io(format!("{}: {error}", current.display())))?;

    if metadata.file_type().is_symlink() {
        return Err(CommandError::with_detail(
            "unsupported",
            format!("symlink not allowed: {}", current.display()),
        ));
    }

    if metadata.is_dir() {
        if !name.is_empty() {
            zip.add_directory(format!("{name}/"), options)
                .map_err(|error| CommandError::io(error.to_string()))?;
        }
        let mut entries: Vec<_> = fs::read_dir(current)
            .map_err(|error| CommandError::io(format!("{}: {error}", current.display())))?
            .filter_map(|entry| entry.ok())
            .map(|entry| entry.path())
            .collect();
        entries.sort();
        for entry in entries {
            add_entry(zip, root, &entry, token, options)?;
        }
        return Ok(());
    }

    zip.start_file(name, options)
        .map_err(|error| CommandError::io(error.to_string()))?;
    let mut file = fs::File::open(current)
        .map_err(|error| CommandError::io(format!("{}: {error}", current.display())))?;
    std::io::copy(&mut file, zip)
        .map_err(|error| CommandError::io(format!("{}: {error}", current.display())))?;
    Ok(())
}

pub fn zip_folder(source: &Path, token: &CancellationToken) -> Result<PathBuf, CommandError> {
    if token.is_cancelled() {
        return Err(CommandError::new("cancelled"));
    }
    let destination = std::env::temp_dir().join(format!("gokapi-desktop-{}.zip", Uuid::new_v4()));
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o644);

    let result = (|| -> Result<PathBuf, CommandError> {
        let file = fs::File::create(&destination)?;
        let mut zip = zip::ZipWriter::new(file);
        add_entry(&mut zip, source, source, token, options)?;
        zip.finish()
            .map_err(|error| CommandError::io(error.to_string()))?;
        if token.is_cancelled() {
            return Err(CommandError::new("cancelled"));
        }
        Ok(destination.clone())
    })();

    cleanup_on_error(&destination, result)
}

pub fn temp_paste_path(file_name: &str) -> PathBuf {
    std::env::temp_dir().join(file_name)
}
