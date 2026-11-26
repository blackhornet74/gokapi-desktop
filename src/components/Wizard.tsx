import { useState } from "react";
import { enable as enableAutostart, disable as disableAutostart } from "@tauri-apps/plugin-autostart";

import * as api from "../api";
import { formatBytes, translate } from "../i18n";
import type { Language, ServerInfo } from "../types";

interface Props {
  initialLanguage: Language;
  onFinished: () => Promise<void>;
}

export default function Wizard({ initialLanguage, onFinished }: Props) {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [step, setStep] = useState<1 | 2>(1);
  const [serverUrl, setServerUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState(5);
  const [downloads, setDownloads] = useState(0);
  const [autostart, setAutostart] = useState(false);

  const t = (key: string, values?: Record<string, string | number>) =>
    translate(language, key, values);

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.verifyServer(serverUrl, apiKey);
      setInfo(result);
      if (!result.e2e) setStep(2);
    } catch (failure) {
      setError(t(`errors.${api.errorCode(failure)}`));
      setInfo(null);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!apiKey.trim()) {
      setError(t("errors.unauthorized"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.saveSettings({ serverUrl, days, downloads, language });
      try {
        await api.saveApiKey(apiKey.trim(), false);
      } catch (failure) {
        if (api.errorCode(failure) === "keyring_unavailable") {
          const accepted = window.confirm(
            `${t("keyringFallbackTitle")}\n\n${t("keyringFallbackBody")}`,
          );
          if (!accepted) throw failure;
          await api.saveApiKey(apiKey.trim(), true);
        } else {
          throw failure;
        }
      }
      if (autostart) await enableAutostart();
      else await disableAutostart();
      await onFinished();
    } catch (failure) {
      setError(t(`errors.${api.errorCode(failure)}`));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="center">
      <div className="card wizard">
        <div className="wizard-head">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              ↑
            </span>
            <div>
              <h1>{t("wizardTitle")}</h1>
              <p className="muted small">{t("tagline")}</p>
            </div>
          </div>
          <select
            aria-label={t("language")}
            value={language}
            onChange={(event) => setLanguage(event.target.value === "it" ? "it" : "en")}
          >
            <option value="en">English</option>
            <option value="it">Italiano</option>
          </select>
        </div>

        {step === 1 ? (
          <>
            <p className="muted">{t("wizardIntro")}</p>
            <label>
              {t("serverUrl")}
              <input
                type="url"
                placeholder={t("serverUrlHint")}
                value={serverUrl}
                onChange={(event) => setServerUrl(event.target.value)}
                autoFocus
              />
            </label>
            <label>
              {t("apiKey")}
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
              <span className="hint">{t("apiKeyHint")}</span>
            </label>

            {info && (
              <div className={`notice ${info.e2e ? "warn" : "ok"}`}>
                <strong>{t("verified")}</strong>
                <div>{t("serverLimits", { size: formatBytes(info.maxFileSizeMb * 1024 * 1024) })}</div>
                {info.e2e && <div>{t("e2eWarning")}</div>}
              </div>
            )}
            {error && <div className="notice error">{error}</div>}

            <div className="row">
              <button onClick={() => void verify()} disabled={busy || !serverUrl || !apiKey}>
                {busy ? t("verifying") : t("verify")}
              </button>
              <button
                className="primary"
                onClick={() => setStep(2)}
                disabled={busy || !serverUrl || !apiKey || Boolean(info?.e2e)}
              >
                {t("continue")}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>{t("defaultsTitle")}</h2>
            <p className="muted">{t("defaultsHint")}</p>
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
            {error && <div className="notice error">{error}</div>}
            <div className="row">
              <button onClick={() => setStep(1)} disabled={busy}>
                {t("back")}
              </button>
              <button className="primary" onClick={() => void finish()} disabled={busy}>
                {busy ? t("loading") : t("finish")}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
