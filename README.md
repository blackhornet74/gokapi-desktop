# Gokapi Desktop

A small cross-platform desktop client for [Gokapi](https://github.com/Forceu/Gokapi), the self-hosted file sharing server.

Gokapi Desktop creates expiring download links without opening the web interface: drop files or folders, set expiry and download limits, and copy the link. It runs on Windows, Linux and macOS (Apple Silicon).

## Features

- Upload multiple files and whole folders (folders are zipped locally before uploading)`n- When selecting several files, choose a single ZIP archive (with an editable name) or separate shares
- Paste an image from the clipboard
- Expiry, download limit and optional password per upload
- Upload queue with progress and cancellation
- Local history of links, with copy, remove and delete-from-server actions
- Tray icon, native notifications, optional autostart
- English and Italian interface
- Automatic updates signed with a minisign key

## Requirements

- Gokapi **2.2 or newer** with the API enabled
- An API key with the **Upload** permission; add **Delete** to remove files from the app

End-to-end encrypted uploads (Gokapi encryption level 3) are **not supported** by the API. Use the official [Gokapi CLI](https://github.com/Forceu/Gokapi) for those uploads.

## Install

Download the installer for your platform from [Releases](https://github.com/blackhornet74/gokapi-desktop/releases):

| Platform | Package |
| --- | --- |
| Windows 10/11 x64 | `.exe` (per-user NSIS installer) |
| Windows 10/11 ARM64 | `.exe` (per-user NSIS installer) |
| Linux x64 / ARM64 | `.AppImage` (automatic updates) or `.deb` (manual updates) |
| macOS 12+ Apple Silicon | `.dmg` |

The builds are **not signed** with an OS code-signing certificate:

- **Windows:** SmartScreen may show a warning on first run. Choose “More info” → “Run anyway” only if you downloaded the file from this repository.
- **macOS:** Gatekeeper blocks the first launch. Right-click the app → **Open**, or run `xattr -dr com.apple.quarantine "/Applications/Gokapi Desktop.app"`. Install the app in `~/Applications` or `/Applications` to allow updates.

## First run

1. Open the app; the setup wizard appears.
2. Enter the server URL (for example `https://files.example.com`) and an API key created in Gokapi under **API**.
3. Optionally verify the connection: the wizard shows the server upload limit.
4. Choose default expiry and download limit (5 days and unlimited by default), language and autostart.

The API key is stored in the operating-system credential store (Windows Credential Manager, macOS Keychain, Secret Service on Linux). If no keyring is available, the app asks before falling back to a `0600` file in its data directory.

## Updates

The app checks for updates at startup and every 24 hours. Updates are downloaded from GitHub Releases and verified with the embedded minisign public key. If an update fails, the current version keeps working; reinstall a previous release manually to roll back.

### Signing key rotation

The update signing key is a maintainer secret. If it is rotated:

1. Generate a new key pair with `npm run tauri signer generate -- -w ~/.tauri/gokapi-desktop.key`.
2. Update `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`.
3. Replace the `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` repository secrets.
4. Publish a release signed with the new key. Users on older versions must install that release manually once, because their embedded public key no longer matches.

## Development

Prerequisites: Node.js 22+, Rust stable, platform build dependencies for Tauri (WebView2 on Windows, `libwebkit2gtk-4.1-dev` and `libayatana-appindicator3-dev` on Linux, Xcode command line tools on macOS).

```sh
npm install
npm run tauri dev
```

Frontend only:

```sh
npm run dev
npm test
npm run build
```

Rust checks:

```sh
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

## Release

Push a tag such as `v0.1.0`. The release workflow builds all targets, signs the update artifacts, creates a **draft** release and uploads `latest.json`. Review the draft and publish it manually.

Required repository secrets:

- `TAURI_SIGNING_PRIVATE_KEY` — contents of the minisign private key
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — key password

## Data and privacy

Settings and link history are stored as JSON in the app data directory. The API key is kept in the system credential store and never is written to the repository or sent anywhere except the configured Gokapi server. The app has no telemetry.

## License

MIT. See [LICENSE](LICENSE).
