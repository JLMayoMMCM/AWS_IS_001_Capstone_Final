// Date / time formatting helpers shared across pages.

/** "May 10, 2026" */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "Friday, June 5, 2026" */
export function formatDateLong(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** "2:00 PM" */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** Whole days from now until `iso`. Negative if in the past. */
export function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/** True if the given timestamp is in the past. */
export function isPast(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

/**
 * Human date/time range for an event card, e.g.
 * "Fri, Jun 5 · 2:00 – 5:00 PM" (same day) or
 * "Jun 15, 6:00 PM – Jun 16, 12:00 PM" (spanning days).
 */
export function formatEventWhen(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return startsAt;
  }
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    const day = start.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    return `${day} · ${formatTime(startsAt)} – ${formatTime(endsAt)}`;
  }
  return (
    `${formatDate(startsAt)}, ${formatTime(startsAt)} – ` +
    `${formatDate(endsAt)}, ${formatTime(endsAt)}`
  );
}

/** Human-readable file size, e.g. "1.8 MB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3);
  const value = bytes / 1024 ** exp;
  return `${exp === 0 ? value : value.toFixed(1)} ${units[exp]}`;
}
