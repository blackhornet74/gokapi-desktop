export type Language = "en" | "it";

export interface Settings {
  serverUrl: string;
  days: number;
  downloads: number;
  language: Language;
}

export interface HistoryEntry {
  id: string;
  name: string;
  url: string;
  time: string;
  downloads?: number;
  lastDownload?: string | null;
  expiresAt?: string | null;
}

export interface SyncResult {
  history: HistoryEntry[];
  logsAvailable: boolean;
}

export interface Bootstrap {
  settings: Settings;
  keyPresent: boolean;
  keySource: "keyring" | "file" | null;
  history: HistoryEntry[];
  version: string;
}

export interface ServerInfo {
  maxFileSizeMb: number;
  maxChunkSizeMb: number;
  e2e: boolean;
}

export interface UploadOptions {
  days: number;
  downloads: number;
  password: string;
}

export interface UploadJob {
  id: string;
  path: string;
  name: string;
  isFolder: boolean;
  temporary: boolean;
  options: UploadOptions;
}

export interface UploadResult {
  entry: HistoryEntry;
}

export interface ProgressEvent {
  id: string;
  sent: number;
  total: number;
}

export interface PickedImage {
  path: string;
  name: string;
}

export interface CommandError {
  code: string;
  detail?: string | null;
}

export type UpdateStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available"; version: string; notes?: string }
  | { kind: "downloading"; version: string }
  | { kind: "ready"; version: string }
  | { kind: "error"; message: string };

export interface BulkDeleteResult {
  history: HistoryEntry[];
  failed: string[];
}
