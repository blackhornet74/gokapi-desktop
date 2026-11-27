import { useEffect, useRef, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { isDesktop } from "../api";
import { isRecentDuplicate } from "../dedupe";

interface Props {
  title: string;
  hint: string;
  onDrop: (paths: string[]) => void;
}

export default function DropZone({ title, hint, onDrop }: Props) {
  const [active, setActive] = useState(false);
  const handler = useRef(onDrop);
  const lastDrop = useRef<{ key: string; at: number } | null>(null);
  handler.current = onDrop;

  useEffect(() => {
    if (!isDesktop) return;
    let dispose: (() => void) | undefined;
    void getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "enter" || event.payload.type === "over") {
          setActive(true);
        } else if (event.payload.type === "leave") {
          setActive(false);
        } else if (event.payload.type === "drop") {
          setActive(false);
          const paths = event.payload.paths;
          if (!paths.length) return;
          const key = paths.join("\u0000");
          const now = Date.now();
          if (isRecentDuplicate(lastDrop.current, key, now)) return;
          lastDrop.current = { key, at: now };
          handler.current(paths);
        }
      })
      .then((unlisten) => {
        dispose = unlisten;
      });
    return () => dispose?.();
  }, []);

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
      <span className="drop-glyph" aria-hidden="true">
        ↓
      </span>
      <span className="muted small">{hint}</span>
    </div>
  );
}
