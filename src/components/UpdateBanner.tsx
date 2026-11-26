import type { UpdateStatus } from "../types";

interface Props {
  status: UpdateStatus;
  t: (key: string, values?: Record<string, string | number>) => string;
  onInstall: () => void;
  onDismiss: () => void;
}

export default function UpdateBanner({ status, t, onInstall, onDismiss }: Props) {
  if (status.kind === "idle" || status.kind === "checking") return null;

  if (status.kind === "available") {
    return (
      <div className="banner">
        <div>
          <strong>{t("updateAvailable", { version: status.version })}</strong>
          {status.notes && <p className="muted small clamp">{status.notes}</p>}
        </div>
        <div className="row tight">
          <button className="small" onClick={onDismiss}>
            {t("later")}
          </button>
          <button className="small primary" onClick={onInstall}>
            {t("updateNow")}
          </button>
        </div>
      </div>
    );
  }

  if (status.kind === "downloading") {
    return (
      <div className="banner">
        <span>{t("downloading")}</span>
        <span className="spinner" aria-hidden="true" />
      </div>
    );
  }

  if (status.kind === "ready") {
    return (
      <div className="banner">
        <span>{t("restarting")}</span>
        <span className="spinner" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="banner error">
      <span>{status.message}</span>
      <button className="small" onClick={onDismiss}>
        {t("close")}
      </button>
    </div>
  );
}
