import { useEffect, useRef, useState } from "react";

import { pruneSelection, toggleSelection } from "../dedupe";
import { expiryState } from "../expiry";
import type { HistoryEntry } from "../types";

interface Props {
  entries: HistoryEntry[];
  t: (key: string, values?: Record<string, string | number>) => string;
  onCopy: (entry: HistoryEntry) => void;
  onDelete: (entry: HistoryEntry) => void;
  onBulkDelete: (ids: string[]) => void;
  onRefresh: () => void;
  syncing: boolean;
  logsAvailable: boolean;
  syncWarning: boolean;
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function HistoryList({
  entries,
  t,
  onCopy,
  onDelete,
  onBulkDelete,
  onRefresh,
  syncing,
  logsAvailable,
  syncWarning,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectAll = useRef<HTMLInputElement>(null);
  const ids = entries.map((entry) => entry.id);
  const allSelected = entries.length > 0 && selected.size === entries.length;

  useEffect(() => {
    setSelected((current) => pruneSelection(current, entries.map((entry) => entry.id)));
  }, [entries]);

  useEffect(() => {
    if (selectAll.current) {
      selectAll.current.indeterminate = selected.size > 0 && !allSelected;
    }
  }, [selected, allSelected]);

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(ids));
  const selectedIds = [...selected];

  return (
    <section className="ledger-panel history-panel">
      <div className="panel-head">
        <h2>{t("historyTitle")}</h2>
        <div className="row tight">
          <span className="count">{entries.length}</span>
          <button className="link small" onClick={onRefresh} disabled={syncing}>
            {syncing ? t("syncing") : t("refresh")}
          </button>
        </div>
      </div>

      {syncWarning && <p className="hint sync-warning">{t("syncWarning")}</p>}

      {entries.length > 0 && (
        <div className="bulk-bar">
          <label className="select-all">
            <input
              ref={selectAll}
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              aria-label={t("selectAll")}
            />
            <span>{t("selectAll")}</span>
          </label>
          {selected.size > 0 && (
            <div className="row tight">
              <span className="count">{t("selectedCount", { count: selected.size })}</span>
              <button className="link small danger" onClick={() => onBulkDelete(selectedIds)}>
                {t("deleteSelected")}
              </button>
            </div>
          )}
        </div>
      )}

      {entries.length === 0 ? (
        <p className="muted">{t("historyEmpty")}</p>
      ) : (
        <ul className="history">
          {entries.map((entry) => {
            const count = entry.downloads ?? 0;
            const downloadsLabel =
              count === 1 ? t("downloadOne") : t("downloadsCount", { count });
            const lastLabel = entry.lastDownload
              ? t("lastDownload", { time: formatTime(entry.lastDownload) })
              : count > 0 && !logsAvailable
                ? "—"
                : t("neverDownloaded");
            const expiry = expiryState(entry.expiresAt);
            const expiryLabel =
              expiry === "none"
                ? t("noExpiry")
                : t("expires", { time: formatTime(entry.expiresAt ?? "") });
            const expiryClass =
              expiry === "soon" ? "expiry-soon" : expiry === "expired" ? "expiry-expired" : "";
            return (
              <li key={entry.id} className={selected.has(entry.id) ? "selected" : ""}>
                <input
                  type="checkbox"
                  className="history-check"
                  checked={selected.has(entry.id)}
                  onChange={() => setSelected((current) => toggleSelection(current, entry.id))}
                  aria-label={t("selectFile", { name: entry.name })}
                />
                <div className="history-body">
                  <div className="history-line">
                    <span className="history-name" title={entry.name}>
                      {entry.name}
                    </span>
                    <span className="history-time">{formatTime(entry.time)}</span>
                  </div>
                  <div
                    className="history-meta"
                    title={!logsAvailable ? t("lastDownloadHint") : undefined}
                  >
                    <span>{downloadsLabel}</span>
                    <span>{lastLabel}</span>
                    <span className={expiryClass}>{expiryLabel}</span>
                  </div>
                  <div className="history-actions">
                    <button className="link small" onClick={() => onCopy(entry)}>
                      {t("copy")}
                    </button>
                    <button className="link small danger" onClick={() => onDelete(entry)}>
                      {t("deleteRemote")}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
