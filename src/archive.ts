function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function parentPath(path: string): string {
  const parts = path.split(/[\\/]/);
  parts.pop();
  return parts.join("/");
}

export function suggestArchiveName(paths: string[], now: Date = new Date()): string {
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}`;
  const parents = new Set(paths.map(parentPath));
  let base = "gokapi";
  if (parents.size === 1) {
    const [only] = [...parents];
    const segment = only.split(/[\\/]/).filter(Boolean).pop();
    if (segment && !/^[A-Za-z]:$/.test(segment)) {
      base = segment.replace(/[\\/:*?"<>|]/g, "-").trim() || "gokapi";
    }
  }
  return `${base}-${stamp}.zip`;
}
