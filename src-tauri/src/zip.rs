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

pub fn zip_sources(
    sources: &[PathBuf],
    token: &CancellationToken,
) -> Result<(PathBuf, String), CommandError> {
    if sources.len() < 2 {
        return Err(CommandError::new("unsupported"));
    }
    let name = format!(
        "gokapi-{}.zip",
        chrono::Local::now().format("%Y%m%d-%H%M%S")
    );
    let destination = std::env::temp_dir().join(format!("gokapi-desktop-{}.zip", Uuid::new_v4()));
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o644);

    let result = (|| -> Result<(PathBuf, String), CommandError> {
        let common = sources[0].parent().map(|path| path.to_path_buf());
        let same_parent = common.is_some()
            && sources
                .iter()
                .all(|source| source.parent() == common.as_deref());
        let mut seen = std::collections::HashSet::new();
        for source in sources {
            let base = source
                .file_name()
                .ok_or_else(|| CommandError::new("unsupported"))?;
            if !seen.insert(base.to_os_string()) {
                return Err(CommandError::with_detail(
                    "unsupported",
                    "two selected items have the same name",
                ));
            }
        }

        let file = fs::File::create(&destination)?;
        let mut zip = zip::ZipWriter::new(file);
        for source in sources {
            let root = if same_parent {
                common.as_deref().unwrap()
            } else {
                source
                    .parent()
                    .ok_or_else(|| CommandError::new("unsupported"))?
            };
            add_entry(&mut zip, root, source, token, options)?;
        }
        zip.finish()
            .map_err(|error| CommandError::io(error.to_string()))?;
        if token.is_cancelled() {
            return Err(CommandError::new("cancelled"));
        }
        Ok((destination.clone(), name.clone()))
    })();

    if result.is_err() {
        let _ = fs::remove_file(&destination);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn archives_multiple_files_from_one_folder() {
        let directory = std::env::temp_dir().join(format!("gokapi-zip-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&directory).unwrap();
        let first = directory.join("a.txt");
        let second = directory.join("b.txt");
        fs::write(&first, b"alpha").unwrap();
        fs::write(&second, b"beta").unwrap();

        let token = CancellationToken::new();
        let (archive_path, name) = zip_sources(&[first, second], &token).unwrap();
        assert!(name.ends_with(".zip"));

        let mut archive = zip::ZipArchive::new(fs::File::open(&archive_path).unwrap()).unwrap();
        let names: Vec<String> = (0..archive.len())
            .map(|index| archive.by_index(index).unwrap().name().to_string())
            .collect();
        assert!(names.contains(&"a.txt".to_string()));
        assert!(names.contains(&"b.txt".to_string()));

        let _ = fs::remove_file(&archive_path);
        let _ = fs::remove_dir_all(&directory);
    }

    #[test]
    fn rejects_duplicate_top_level_names() {
        let base = std::env::temp_dir().join(format!("gokapi-zip-test-{}", Uuid::new_v4()));
        let first_dir = base.join("one");
        let second_dir = base.join("two");
        fs::create_dir_all(&first_dir).unwrap();
        fs::create_dir_all(&second_dir).unwrap();
        let first = first_dir.join("same.txt");
        let second = second_dir.join("same.txt");
        fs::write(&first, b"one").unwrap();
        fs::write(&second, b"two").unwrap();

        let token = CancellationToken::new();
        let error = zip_sources(&[first, second], &token).unwrap_err();
        assert_eq!(error.code, "unsupported");

        let _ = fs::remove_dir_all(&base);
    }
}
