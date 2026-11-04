/** "2h 13m", "45m", "Less than a minute". */
export function formatPlayTime(seconds: number): string {
  if (!(seconds >= 60)) return seconds > 0 ? "Less than a minute" : "Not played yet";
  const minutes = Math.floor(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** "Today", "Yesterday", or a short date. */
export function formatDay(time: number | string): string {
  const d = new Date(time);
  const today = new Date();
  const days = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}
