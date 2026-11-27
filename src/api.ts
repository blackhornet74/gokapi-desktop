import { invoke } from "@tauri-apps/api/core";
import { writeText as tauriWriteText } from "@tauri-apps/plugin-clipboard-manager";
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

export const isDesktop =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let mockSettings: Settings = {
  serverUrl: "https://files.example.com",
  days: 5,
  downloads: 0,
  language: "en",
};

let mockHistory: HistoryEntry[] = [
  {
    id: "h1",
    name: "handbook-2026.pdf",
    url: "https://files.example.com/d?id=h1",
    time: new Date(Date.now() - 1000 * 60 * 38).toISOString(),
  },
  {
    id: "h2",
    name: "rack-photos.zip",
    url: "https://files.example.com/d?id=h2",
    time: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
];

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export function isCommandError(value: unknown): value is CommandError {
  return typeof value === "object" && value !== null && typeof (value as CommandError).code === "string";
}

export function errorCode(value: unknown): string {
  return isCommandError(value) ? value.code : "unknown";
}

export async function copyText(text: string): Promise<void> {
  if (!isDesktop) {
    await navigator.clipboard.writeText(text);
    return;
  }
  try {
    await tauriWriteText(text);
  } catch {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      throw { code: "clipboard" };
    }
  }
}

export async function bootstrap(): Promise<Bootstrap> {
  if (isDesktop) return invoke<Bootstrap>("bootstrap");
  const wizard = window.location.search.includes("wizard");
  return {
    settings: wizard ? { ...mockSettings, serverUrl: "" } : mockSettings,
    keyPresent: !wizard,
    keySource: wizard ? null : "keyring",
    history: wizard ? [] : [...mockHistory],
    version: "0.1.0",
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  if (isDesktop) return invoke<void>("save_settings", { settings });
  mockSettings = settings;
}

export async function verifyServer(serverUrl: string, apiKey: string): Promise<ServerInfo> {
  if (isDesktop) return invoke<ServerInfo>("verify_server", { serverUrl, apiKey });
  await wait(300);
  return { maxFileSizeMb: 2048, maxChunkSizeMb: 45, e2e: false };
}

export async function saveApiKey(apiKey: string, allowFileFallback: boolean): Promise<void> {
  if (isDesktop) return invoke<void>("save_api_key", { apiKey, allowFileFallback });
}

export async function uploadFile(job: UploadJob): Promise<UploadResult> {
  if (isDesktop) return invoke<UploadResult>("upload_file", { job });
  await wait(700);
  const entry: HistoryEntry = {
    id: crypto.randomUUID().slice(0, 12),
    name: job.isFolder ? `${job.name}.zip` : job.name,
    url: `https://files.example.com/d?id=${crypto.randomUUID().slice(0, 8)}`,
    time: new Date().toISOString(),
  };
  mockHistory = [entry, ...mockHistory];
  return { entry };
}

export async function cancelUpload(id: string): Promise<void> {
  if (isDesktop) return invoke<void>("cancel_upload", { id });
}

export async function deleteRemote(id: string): Promise<HistoryEntry[]> {
  if (isDesktop) return invoke<HistoryEntry[]>("delete_remote", { id });
  mockHistory = mockHistory.filter((entry) => entry.id !== id);
  return [...mockHistory];
}

export async function removeHistory(ids: string[]): Promise<HistoryEntry[]> {
  if (isDesktop) return invoke<HistoryEntry[]>("remove_history", { ids });
  mockHistory = mockHistory.filter((entry) => !ids.includes(entry.id));
  return [...mockHistory];
}

export async function pasteImage(): Promise<PickedImage | null> {
  if (isDesktop) return invoke<PickedImage | null>("paste_image");
  return { path: "/tmp/clipboard-demo.png", name: "clipboard-demo.png" };
}

export async function openPortal(url: string): Promise<void> {
  if (isDesktop) return invoke<void>("open_portal", { url });
  window.open(url, "_blank", "noopener");
}
