import { useEffect, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";

interface Props {
  title: string;
  hint: string;
  onDrop: (paths: string[]) => void;
}

export default function DropZone({ title, hint, onDrop }: Props) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let dispose: (() => void) | undefined;
    void getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "enter" || event.payload.type === "over") {
          setActive(true);
        } else if (event.payload.type === "leave") {
          setActive(false);
        } else if (event.payload.type === "drop") {
          setActive(false);
          if (event.payload.paths.length) onDrop(event.payload.paths);
        }
      })
      .then((unlisten) => {
        dispose = unlisten;
      });
    return () => dispose?.();
  }, [onDrop]);

  return (
    <div
      className={`dropzone ${active ? "active" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setActive(true);
      }}
      onDragLeave={() => setActive(false)}
      onDrop={(event) => event.preventDefault()}
    >
      <strong>{title}</strong>
      <span className="muted small">{hint}</span>
    </div>
  );
}
