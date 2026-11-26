import type { HistoryEntry } from "../types";

interface Props {
  entries: HistoryEntry[];
  t: (key: string, values?: Record<string, string | number>) => string;
  onCopy: (entry: HistoryEntry) => void;
  onDelete: (entry: HistoryEntry) => void;
  onRemove: (entry: HistoryEntry) => void;
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function HistoryList({ entries, t, onCopy, onDelete, onRemove }: Props) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{t("historyTitle")}</h2>
        <span className="muted small">{entries.length}</span>
      </div>
      {entries.length === 0 ? (
        <p className="muted">{t("historyEmpty")}</p>
      ) : (
        <ul className="history">
          {entries.map((entry) => (
            <li key={entry.id}>
              <div className="history-main">
                <span className="history-name" title={entry.name}>
                  {entry.name}
                </span>
                <span className="muted small">{formatTime(entry.time)}</span>
              </div>
              <div className="row tight">
                <button className="small" onClick={() => onCopy(entry)}>
                  {t("copy")}
                </button>
                <button className="small" onClick={() => onRemove(entry)}>
                  {t("removeLocal")}
                </button>
                <button className="small danger" onClick={() => onDelete(entry)}>
                  {t("deleteRemote")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
