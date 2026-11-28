import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { enable as enableAutostart, disable as disableAutostart } from "@tauri-apps/plugin-autostart";
import { relaunch } from "@tauri-apps/plugin-process";
import { check as checkUpdate } from "@tauri-apps/plugin-updater";

import * as api from "./api";
import { translate } from "./i18n";
import { filterActivePaths } from "./dedupe";
import { suggestArchiveName } from "./archive";
import type {
  Bootstrap,
  HistoryEntry,
  Language,
  ProgressEvent,
  Settings,
  UpdateStatus,
  UploadOptions,
} from "./types";
import Wizard from "./components/Wizard";
import SettingsDialog from "./components/SettingsDialog";
import DropZone from "./components/DropZone";
import UploadQueue, { type QueueItem } from "./components/UploadQueue";
import HistoryList from "./components/HistoryList";
import UpdateBanner from "./components/UpdateBanner";
import ArchiveDialog from "./components/ArchiveDialog";

type AvailableUpdate = NonNullable<Awaited<ReturnType<typeof checkUpdate>>>;

type UploadCandidate = {
  path: string;
  name: string;
  isFolder?: boolean;
  temporary?: boolean;
};

type ArchivePrompt = {
  items: UploadCandidate[];
  options: UploadOptions;
  suggestedName: string;
};

export default function App() {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [wizard, setWizard] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [update, setUpdate] = useState<UpdateStatus>({ kind: "idle" });
  const [days, setDays] = useState(5);
  const [downloads, setDownloads] = useState(0);
  const [password, setPassword] = useState("");
  const [archivePrompt, setArchivePrompt] = useState<ArchivePrompt | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [logsAvailable, setLogsAvailable] = useState(true);
  const [syncWarning, setSyncWarning] = useState(false);

  const queueRef = useRef<QueueItem[]>([]);
  const runningRef = useRef(false);
  const cancelledRef = useRef(false);
  const currentRef = useRef<{ key: string; uploadId: string } | null>(null);
  const availableRef = useRef<AvailableUpdate | null>(null);

  const language: Language = boot?.settings.language === "it" ? "it" : "en";
  const refreshSeconds = boot?.settings.refreshSeconds ?? 60;
  const t = useCallback(
    (key: string, values?: Record<string, string | number>) => translate(language, key, values),
    [language],
  );

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const refreshHistory = useCallback(
    async (manual = false) => {
      if (!api.isDesktop) return;
      setSyncing(true);
      try {
        const result = await api.syncHistory();
        setHistory(result.history);
        setLogsAvailable(result.logsAvailable);
        setSyncWarning(false);
      } catch (error) {
        const code = api.errorCode(error);
        if (code === "unauthorized" || code === "forbidden") {
          setSyncWarning(true);
          if (manual) showToast(t("syncWarning"));
        } else if (manual) {
          showToast(t(`errors.${code}`));
        }
      } finally {
        setSyncing(false);
      }
    },
    [showToast, t],
  );

  const load = useCallback(async () => {
    try {
      const data = await api.bootstrap();
      setBoot(data);
      setHistory(data.history);
      setDays(data.settings.days);
      setDownloads(data.settings.downloads);
      setWizard(!data.keyPresent || !data.settings.serverUrl);
      setFatal(null);
    } catch {
      setFatal("unknown");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!boot?.keyPresent || !boot.settings.serverUrl) return;
    void refreshHistory(false);
  }, [boot, refreshHistory]);

  useEffect(() => {
    if (!boot?.keyPresent || !boot.settings.serverUrl || !api.isDesktop) return;
    if (refreshSeconds <= 0) return;
    const timer = window.setInterval(() => {
      void refreshHistory(false);
    }, refreshSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [boot, refreshHistory, refreshSeconds]);

  useEffect(() => {
    if (!api.isDesktop) return;
    const unlisten = listen<ProgressEvent>("upload-progress", (event) => {
      const { id, sent, total } = event.payload;
      queueRef.current = queueRef.current.map((item) =>
        item.key === id ? { ...item, sent, total } : item,
      );
      setQueue([...queueRef.current]);
    });
    return () => {
      void unlisten.then((off) => off());
    };
  }, []);

  const patch = useCallback((key: string, values: Partial<QueueItem>) => {
    queueRef.current = queueRef.current.map((item) =>
      item.key === key ? { ...item, ...values } : item,
    );
    setQueue([...queueRef.current]);
  }, []);

  const notify = useCallback(async (count: number) => {
    if (!api.isDesktop) return;
    try {
      let granted = await isPermissionGranted();
      if (!granted) granted = (await requestPermission()) === "granted";
      if (granted) {
        await sendNotification({
          title: translate(language, "notifyDoneTitle"),
          body: translate(language, "notifyDoneBody", { count }),
        });
      }
    } catch {
      /* notifications are optional */
    }
  }, [language]);

  const runQueue = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    cancelledRef.current = false;
    const links: string[] = [];
    for (;;) {
      if (cancelledRef.current) break;
      const next = queueRef.current.find((item) => item.status === "queued");
      if (!next) break;
      patch(next.key, { status: "uploading", sent: 0 });
      currentRef.current = { key: next.key, uploadId: next.key };
      try {
        const result = await api.uploadFile({
          id: next.key,
          path: next.path,
          name: next.name,
          isFolder: next.isFolder,
          temporary: Boolean(next.temporary),
          options: next.options,
        });
        patch(next.key, { status: "done", sent: next.size ?? 0 });
        links.push(result.entry.url);
        setHistory((current) => [result.entry, ...current]);
      } catch (error) {
        const code = api.errorCode(error);
        patch(next.key, {
          status: code === "cancelled" ? "cancelled" : "failed",
          error: code,
        });
      }
    }
    runningRef.current = false;
    currentRef.current = null;
    if (links.length) {
      try {
        await api.copyText(links.join("\n"));
        showToast(t("copied") + (links.length > 1 ? ` (${links.length})` : ""));
      } catch (error) {
        showToast(t(`errors.${api.errorCode(error)}`));
      }
      void notify(links.length);
      void refreshHistory(false);
    }
  }, [notify, patch, refreshHistory, showToast, t]);

  const enqueue = useCallback(
    (items: UploadCandidate[], options: UploadOptions) => {
      if (!boot) return;
      const unique = items.filter(
        (item, index) => items.findIndex((candidate) => candidate.path === item.path) === index,
      );
      const allowed = new Set(filterActivePaths(queueRef.current, unique.map((item) => item.path)));
      const accepted = unique.filter((item) => allowed.has(item.path));
      if (!accepted.length) return;
      const created: QueueItem[] = accepted.map((item) => ({
        key: crypto.randomUUID(),
        path: item.path,
        name: item.name,
        isFolder: Boolean(item.isFolder),
        temporary: Boolean(item.temporary),
        status: "queued",
        options,
        sent: 0,
        size: undefined,
      }));
      queueRef.current = [...queueRef.current, ...created];
      setQueue([...queueRef.current]);
      void runQueue();
    },
    [boot, runQueue],
  );

  const requestUpload = useCallback(
    (items: UploadCandidate[], options: UploadOptions) => {
      const unique = items.filter(
        (item, index) => items.findIndex((candidate) => candidate.path === item.path) === index,
      );
      const allowed = new Set(filterActivePaths(queueRef.current, unique.map((item) => item.path)));
      const fresh = unique.filter((item) => allowed.has(item.path));
      if (!fresh.length) return;
      if (fresh.length === 1) {
        enqueue(fresh, options);
        setPassword("");
        return;
      }
      setArchivePrompt({
        items: fresh,
        options,
        suggestedName: suggestArchiveName(fresh.map((item) => item.path)),
      });
    },
    [enqueue],
  );


  const currentOptions = (): UploadOptions => ({ days, downloads, password });

  const pickFiles = useCallback(async () => {
    if (!api.isDesktop) return;
    const selection = await openDialog({ multiple: true, directory: false, title: t("chooseFiles") });
    if (!selection) return;
    const paths = Array.isArray(selection) ? selection : [selection];
    requestUpload(
      paths.map((path) => ({ path, name: path.split(/[\\/]/).pop() || path })),
      currentOptions(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestUpload, days, downloads, password, t]);

  const pickFolder = useCallback(async () => {
    if (!api.isDesktop) return;
    const selection = await openDialog({ multiple: false, directory: true, title: t("chooseFolder") });
    if (!selection || Array.isArray(selection)) return;
    requestUpload(
      [{ path: selection, name: selection.split(/[\\/]/).filter(Boolean).pop() || selection, isFolder: true }],
      currentOptions(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestUpload, days, downloads, password, t]);

  useEffect(() => {
    if (!api.isDesktop) return;
    const unlisten = listen("tray-upload", () => {
      void pickFiles();
    });
    return () => {
      void unlisten.then((off) => off());
    };
  }, [pickFiles]);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const image = await api.pasteImage();
      if (!image) {
        showToast(t("pasteEmpty"));
        return;
      }
      requestUpload([{ path: image.path, name: image.name, temporary: true }], currentOptions());
    } catch {
      showToast(t("pasteEmpty"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestUpload, days, downloads, password, showToast, t]);

  const cancelAll = useCallback(() => {
    cancelledRef.current = true;
    queueRef.current = queueRef.current.map((item) =>
      item.status === "queued" ? { ...item, status: "cancelled" } : item,
    );
    setQueue([...queueRef.current]);
    if (currentRef.current) {
      void api.cancelUpload(currentRef.current.uploadId);
    }
  }, []);

  const clearFinished = useCallback(() => {
    queueRef.current = queueRef.current.filter(
      (item) => item.status === "queued" || item.status === "uploading",
    );
    setQueue([...queueRef.current]);
  }, []);

  const copyLink = useCallback(
    async (url: string) => {
      try {
        await api.copyText(url);
        showToast(t("copied"));
      } catch (error) {
        showToast(t(`errors.${api.errorCode(error)}`));
      }
    },
    [showToast, t],
  );

  const deleteRemote = useCallback(
    async (entry: HistoryEntry) => {
      if (!(await window.confirm(t("deleteConfirm", { name: entry.name })))) return;
      try {
        setHistory(await api.deleteRemote(entry.id));
        showToast(t("deletedFromServer"));
      } catch (error) {
        showToast(t(`errors.${api.errorCode(error)}`));
      }
    },
    [showToast, t],
  );


  const deleteSelected = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return;
      if (!(await window.confirm(t("bulkDeleteConfirm", { count: ids.length })))) return;
      try {
        const result = await api.deleteRemoteMany(ids);
        setHistory(result.history);
        void refreshHistory(false);
        if (result.failed.length) {
          showToast(
            t("bulkDeletePartial", {
              deleted: ids.length - result.failed.length,
              failed: result.failed.length,
            }),
          );
        } else {
          showToast(t("bulkDeleted", { count: ids.length }));
        }
      } catch (error) {
        showToast(t(`errors.${api.errorCode(error)}`));
      }
    },
    [refreshHistory, showToast, t],
  );

  const chooseZip = useCallback(
    async (name: string) => {
      if (!archivePrompt) return;
      setArchiveBusy(true);
      try {
        const archive = await api.prepareArchive(
          archivePrompt.items.map((item) => item.path),
          name,
        );
        enqueue([{ path: archive.path, name: archive.name, temporary: true }], archivePrompt.options);
        setPassword("");
        setArchivePrompt(null);
      } catch (error) {
        showToast(t(`errors.${api.errorCode(error)}`));
      } finally {
        setArchiveBusy(false);
      }
    },
    [archivePrompt, enqueue, showToast, t],
  );

  const chooseSeparate = useCallback(() => {
    if (!archivePrompt) return;
    enqueue(archivePrompt.items, archivePrompt.options);
    setPassword("");
    setArchivePrompt(null);
  }, [archivePrompt, enqueue]);

  const cancelArchive = useCallback(() => {
    if (!archiveBusy) setArchivePrompt(null);
  }, [archiveBusy]);

  const checkForUpdates = useCallback(
    async (manual: boolean) => {
      setUpdate({ kind: "checking" });
      try {
        const found = await checkUpdate();
        if (found) {
          availableRef.current = found;
          setUpdate({ kind: "available", version: found.version, notes: found.body ?? undefined });
        } else {
          availableRef.current = null;
          setUpdate({ kind: "idle" });
          if (manual) showToast(t("upToDate"));
        }
      } catch (error) {
        setUpdate({ kind: "idle" });
        if (manual) showToast(String(error));
      }
    },
    [showToast, t],
  );

  const installUpdate = useCallback(async () => {
    if (!api.isDesktop) return;
    const found = availableRef.current;
    if (!found) return;
    try {
      setUpdate({ kind: "downloading", version: found.version });
      await found.downloadAndInstall();
      setUpdate({ kind: "ready", version: found.version });
      await relaunch();
    } catch {
      setUpdate({ kind: "error", message: t("updateFailed") });
    }
  }, [t]);

  useEffect(() => {
    if (!boot || !api.isDesktop) return;
    const timer = window.setTimeout(() => {
      void checkForUpdates(false);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [boot, checkForUpdates]);

  const applySettings = useCallback(
    async (next: Settings, newKey: string, autostart: boolean) => {
      await api.saveSettings(next);
      if (newKey.trim()) {
        try {
          await api.saveApiKey(newKey.trim(), false);
        } catch (error) {
          if (api.errorCode(error) === "keyring_unavailable") {
            if (
              !(await window.confirm(
                `${t("keyringFallbackTitle")}\n\n${t("keyringFallbackBody")}`,
              ))
            ) {
              throw error;
            }
            await api.saveApiKey(newKey.trim(), true);
          } else {
            throw error;
          }
        }
      }
      if (api.isDesktop) {
        if (autostart) await enableAutostart();
        else await disableAutostart();
      }
      await load();
    },
    [load, t],
  );

  if (fatal) {
    return (
      <main className="center">
        <div className="wizard">
          <h1>{t("appName")}</h1>
          <p className="muted">{t("errors.unknown")}</p>
          <button className="primary" onClick={() => void load()}>
            {t("retry")}
          </button>
        </div>
      </main>
    );
  }

  if (!boot) {
    return (
      <main className="center">
        <p className="muted">{t("loading")}</p>
      </main>
    );
  }

  if (wizard) {
    return (
      <Wizard
        initialLanguage={language}
        onFinished={async () => {
          setWizard(false);
          await load();
        }}
      />
    );
  }

  const serverHost = (() => {
    try {
      return new URL(boot.settings.serverUrl).host;
    } catch {
      return boot.settings.serverUrl;
    }
  })();

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ↑
          </span>
          <div>
            <h1 className="wordmark">{t("appName")}</h1>
            <p className="server">{serverHost}</p>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="link" onClick={() => void api.openPortal(boot.settings.serverUrl)}>
            {t("openPortal")}
          </button>
          <button className="link" onClick={() => setSettingsOpen(true)}>
            {t("settings")}
          </button>
        </div>
      </header>

      <UpdateBanner
        status={update}
        t={t}
        onInstall={() => void installUpdate()}
        onDismiss={() => setUpdate({ kind: "idle" })}
      />

      <div className="desk">
        <section className="compose">
          <div className="compose-head">
            <h2>{t("composeTitle")}</h2>
          </div>
          <div className="options">
            <label>
              {t("days")}
              <input
                type="number"
                min={0}
                max={100000}
                value={days}
                placeholder={t("daysUnit")}
                onChange={(event) => setDays(Math.max(0, Number(event.target.value) || 0))}
              />
            </label>
            <label>
              {t("downloads")}
              <input
                type="number"
                min={0}
                max={100000}
                value={downloads}
                placeholder={t("zeroUnlimited")}
                onChange={(event) => setDownloads(Math.max(0, Number(event.target.value) || 0))}
              />
            </label>
            <label className="grow">
              {t("password")}
              <input
                type="password"
                value={password}
                placeholder={t("optional")}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          </div>
          <DropZone
            title={t("dropTitle")}
            hint={t("dropHint")}
            onDrop={(paths) =>
              requestUpload(
                paths.map((path) => ({ path, name: path.split(/[\\/]/).pop() || path })),
                currentOptions(),
              )
            }
          />
          <div className="actions">
            <button className="primary" onClick={() => void pickFiles()}>
              {t("chooseFiles")}
            </button>
            <button onClick={() => void pickFolder()}>{t("chooseFolder")}</button>
            <button className="link" onClick={() => void pasteFromClipboard()}>
              {t("pasteImage")}
            </button>
          </div>
        </section>

        <div className="side">
          <UploadQueue
            items={queue}
            t={t}
            onCancelAll={cancelAll}
            onClearFinished={clearFinished}
          />
        </div>
      </div>

      <HistoryList
        entries={history}
        t={t}
        onCopy={(entry) => void copyLink(entry.url)}
        onDelete={(entry) => void deleteRemote(entry)}
        onBulkDelete={(ids) => void deleteSelected(ids)}
        onRefresh={() => void refreshHistory(true)}
        syncing={syncing}
        logsAvailable={logsAvailable}
        syncWarning={syncWarning}
      />

      <footer className="footer">
        <span>{t("version", { version: boot.version })}</span>
        <span>
          {boot.keyPresent
            ? t("keyPresent", {
                source:
                  boot.keySource === "file" ? t("sourceFile") : t("sourceKeyring"),
              })
            : t("keyMissing")}
        </span>
      </footer>

      {settingsOpen && (
        <SettingsDialog
          boot={boot}
          t={t}
          onClose={() => setSettingsOpen(false)}
          onSave={async (settings, key, autostart, checkNow) => {
            await applySettings(settings, key, autostart);
            setSettingsOpen(false);
            if (checkNow) void checkForUpdates(true);
          }}
        />
      )}

      {archivePrompt && (
        <ArchiveDialog
          names={archivePrompt.items.map((item) => item.name)}
          suggestedName={archivePrompt.suggestedName}
          busy={archiveBusy}
          t={t}
          onZip={(name) => void chooseZip(name)}
          onSeparate={chooseSeparate}
          onCancel={cancelArchive}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
