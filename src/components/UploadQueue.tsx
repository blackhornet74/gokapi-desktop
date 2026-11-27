import type { HistoryEntry, UploadOptions } from "../types";

export type QueueStatus = "queued" | "uploading" | "done" | "failed" | "cancelled";

export interface QueueItem {
  key: string;
  path: string;
  name: string;
  isFolder: boolean;
  temporary: boolean;
  status: QueueStatus;
  options: UploadOptions;
  sent: number;
  total?: number;
  size?: number;
  error?: string;
  entry?: HistoryEntry;
}

interface Props {
  items: QueueItem[];
  t: (key: string, values?: Record<string, string | number>) => string;
  onCancelAll: () => void;
  onClearFinished: () => void;
}

const active = (item: QueueItem) => item.status === "queued" || item.status === "uploading";

export default function UploadQueue({ items, t, onCancelAll, onClearFinished }: Props) {
  const hasActive = items.some(active);
  const hasFinished = items.some((item) => !active(item));

  return (
    <section className="ledger-panel outbox-panel">
      <div className="panel-head">
        <h2>{t("queueTitle")}</h2>
        <div className="row tight">
          {hasActive && (
            <button className="link small danger" onClick={onCancelAll}>
              {t("cancelAll")}
            </button>
          )}
          {hasFinished && (
            <button className="link small" onClick={onClearFinished}>
              {t("clearFinished")}
            </button>
          )}
        </div>
      </div>
      {items.length === 0 ? (
        <p className="queue-empty muted small">{t("queueEmpty")}</p>
      ) : (
        <ul className="queue">
        {items.map((item) => {
          const percent =
            item.status === "uploading" && item.total
              ? Math.min(100, Math.round((item.sent / item.total) * 100))
              : item.status === "done"
                ? 100
                : 0;
          return (
            <li key={item.key} className={`queue-item status-${item.status}`}>
              <div className="queue-line">
                <span className="queue-name" title={item.path}>
                  {item.name}
                </span>
                <span className="queue-status">
                  {item.status === "uploading" && item.total
                    ? t("progress", {
                        done: Math.round((item.sent / 1024 / 1024) * 10) / 10 + " MB",
                        total: Math.round((item.total / 1024 / 1024) * 10) / 10 + " MB",
                      })
                    : t(`status${item.status.charAt(0).toUpperCase()}${item.status.slice(1)}`)}
                </span>
              </div>
              {item.status === "uploading" && (
                <div className="bar">
                  <span style={{ width: `${percent}%` }} />
                </div>
              )}
              {item.error && <div className="error small">{t(`errors.${item.error}`)}</div>}
            </li>
          );
        })}
        </ul>
      )}
      {hasActive && <p className="hint">{t("cancelHint")}</p>}
    </section>
  );
}
