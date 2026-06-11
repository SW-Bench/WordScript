/** Compact relative time, e.g. "just now", "4m", "2h", "3d". */
export function relativeTime(ms: number, now = Date.now()): string {
  const diff = Math.max(0, now - ms);
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(ms).toLocaleDateString();
}

/** Absolute, locale-aware timestamp for tooltips/detail. */
export function absoluteTime(ms: number): string {
  return new Date(ms).toLocaleString();
}

/** Trim to a length with an ellipsis, collapsing whitespace. */
export function truncate(text: string, max = 120): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}
