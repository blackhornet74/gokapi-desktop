export function isRecentDuplicate(
  previous: { key: string; at: number } | null,
  key: string,
  now: number,
  windowMs = 1000,
): boolean {
  return previous !== null && previous.key === key && now - previous.at < windowMs;
}

export function filterActivePaths<T extends { path: string; status: string }>(
  active: T[],
  candidates: string[],
): string[] {
  const busy = new Set(
    active
      .filter((item) => item.status === "queued" || item.status === "uploading")
      .map((item) => item.path),
  );
  return candidates.filter((path) => !busy.has(path));
}

export function toggleSelection(current: Set<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function pruneSelection(current: Set<string>, alive: string[]): Set<string> {
  const keep = new Set(alive);
  return new Set([...current].filter((id) => keep.has(id)));
}
