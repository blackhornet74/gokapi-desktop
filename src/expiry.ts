export type ExpiryState = "none" | "normal" | "soon" | "expired";

export function expiryState(
  expiresAt: string | null | undefined,
  now: number = Date.now(),
): ExpiryState {
  if (!expiresAt) return "none";
  const time = new Date(expiresAt).getTime();
  if (!Number.isFinite(time) || time <= 0) return "none";
  if (time <= now) return "expired";
  if (time - now <= 24 * 60 * 60 * 1000) return "soon";
  return "normal";
}
