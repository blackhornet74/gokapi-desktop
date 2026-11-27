interface Props {
  names: string[];
  busy: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
  onZip: () => void;
  onSeparate: () => void;
  onCancel: () => void;
}

export default function ArchiveDialog({ names, busy, t, onZip, onSeparate, onCancel }: Props) {
  const preview = names.slice(0, 4);

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="modal archive-modal">
        <h2>{t("archiveTitle", { count: names.length })}</h2>
        <p>{t("archiveBody")}</p>
        <p className="muted small">{t("archiveHint")}</p>
        <ul className="archive-names">
          {preview.map((name) => (
            <li key={name} title={name}>
              {name}
            </li>
          ))}
          {names.length > preview.length && <li>+{names.length - preview.length}</li>}
        </ul>
        <div className="row end">
          <button className="link" onClick={onCancel} disabled={busy}>
            {t("cancel")}
          </button>
          <button onClick={onSeparate} disabled={busy}>
            {t("archiveSeparate")}
          </button>
          <button className="primary" onClick={onZip} disabled={busy}>
            {busy ? t("archivePreparing") : t("archiveZip")}
          </button>
        </div>
      </div>
    </div>
  );
}
