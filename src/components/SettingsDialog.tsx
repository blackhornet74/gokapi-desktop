import { useEffect, useState } from "react";
import { isEnabled } from "@tauri-apps/plugin-autostart";

import * as api from "../api";
import type { Bootstrap, Language, Settings } from "../types";

interface Props {
  boot: Bootstrap;
  t: (key: string, values?: Record<string, string | number>) => string;
  onClose: () => void;
  onSave: (
    settings: Settings,
    key: string,
    autostart: boolean,
    checkNow: boolean,
  ) => Promise<void>;
}

export default function SettingsDialog({ boot, t, onClose, onSave }: Props) {
  const [serverUrl, setServerUrl] = useState(boot.settings.serverUrl);
  const [days, setDays] = useState(boot.settings.days);
  const [downloads, setDownloads] = useState(boot.settings.downloads);
  const [language, setLanguage] = useState<Language>(
    boot.settings.language === "it" ? "it" : "en",
  );
  const [refreshSeconds, setRefreshSeconds] = useState(boot.settings.refreshSeconds ?? 60);
  const [apiKey, setApiKey] = useState("");
  const [autostart, setAutostart] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!api.isDesktop) return;
    void isEnabled()
      .then(setAutostart)
      .catch(() => setAutostart(false));
  }, []);

  async function save(checkNow: boolean) {
    setBusy(true);
    setError(null);
    try {
      await onSave(
        {
          serverUrl,
          days: Math.max(0, days),
          downloads: Math.max(0, downloads),
          language,
          refreshSeconds,
        },
        apiKey,
        autostart,
        checkNow,
      );
      setApiKey("");
      if (!checkNow) onClose();
    } catch (failure) {
      setError(t(`errors.${api.errorCode(failure)}`));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="panel-head">
          <h2>{t("settings")}</h2>
          <button className="small" onClick={onClose} disabled={busy}>
            {t("close")}
          </button>
        </div>

        <h3>{t("connection")}</h3>
        <label>
          {t("serverUrl")}
          <input
            type="url"
            value={serverUrl}
            onChange={(event) => setServerUrl(event.target.value)}
          />
        </label>
        <label>
          {t("replaceKey")}
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={boot.keyPresent ? "••••••••" : t("keyMissing")}
          />
          <span className="hint">
            {boot.keyPresent
              ? t("keyPresent", {
                  source: boot.keySource === "file" ? t("sourceFile") : t("sourceKeyring"),
                })
              : t("keyMissing")}
          </span>
        </label>

        <h3>{t("defaultsTitle")}</h3>
        <div className="grid two">
          <label>
            {t("days")}
            <input
              type="number"
              min={0}
              max={100000}
              value={days}
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
              onChange={(event) => setDownloads(Math.max(0, Number(event.target.value) || 0))}
            />
          </label>
        </div>

        <label>
          {t("language")}
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value === "it" ? "it" : "en")}
          >
            <option value="en">English</option>
            <option value="it">Italiano</option>
          </select>
        </label>

        <label>
          {t("refreshInterval")}
          <select
            value={refreshSeconds}
            onChange={(event) => setRefreshSeconds(Number(event.target.value) || 0)}
          >
            <option value={30}>30 s</option>
            <option value={60}>1 min</option>
            <option value={300}>5 min</option>
            <option value={900}>15 min</option>
            <option value={1800}>30 min</option>
            <option value={0}>{t("refreshManual")}</option>
          </select>
          <span className="hint">{t("refreshIntervalHint")}</span>
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={autostart}
            onChange={(event) => setAutostart(event.target.checked)}
          />
          <span>
            <strong>{t("autostart")}</strong>
            <span className="hint">{t("autostartHint")}</span>
          </span>
        </label>

        <h3>{t("updates")}</h3>
        <p className="muted small">{t("version", { version: boot.version })}</p>

        {error && <div className="notice error">{error}</div>}

        <div className="row end">
          <button onClick={() => void save(true)} disabled={busy}>
            {busy ? t("checking") : t("checkUpdates")}
          </button>
          <button className="primary" onClick={() => void save(false)} disabled={busy}>
            {busy ? t("loading") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
