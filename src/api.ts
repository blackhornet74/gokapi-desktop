import { invoke } from "@tauri-apps/api/core";
import type {
  Bootstrap,
  CommandError,
  HistoryEntry,
  PickedImage,
  ServerInfo,
  Settings,
  UploadJob,
  UploadResult,
} from "./types";

export function isCommandError(value: unknown): value is CommandError {
  return typeof value === "object" && value !== null && typeof (value as CommandError).code === "string";
}

export function errorCode(value: unknown): string {
  return isCommandError(value) ? value.code : "unknown";
}

export const bootstrap = () => invoke<Bootstrap>("bootstrap");

export const saveSettings = (settings: Settings) => invoke<void>("save_settings", { settings });

export const verifyServer = (serverUrl: string, apiKey: string) =>
  invoke<ServerInfo>("verify_server", { serverUrl, apiKey });

export const saveApiKey = (apiKey: string, allowFileFallback: boolean) =>
  invoke<void>("save_api_key", { apiKey, allowFileFallback });

export const uploadFile = (job: UploadJob) => invoke<UploadResult>("upload_file", { job });

export const cancelUpload = (id: string) => invoke<void>("cancel_upload", { id });

export const deleteRemote = (id: string) => invoke<HistoryEntry[]>("delete_remote", { id });

export const removeHistory = (ids: string[]) => invoke<HistoryEntry[]>("remove_history", { ids });

export const pasteImage = () => invoke<PickedImage | null>("paste_image");

export const openPortal = (url: string) => invoke<void>("open_portal", { url });
