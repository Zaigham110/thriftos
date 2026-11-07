/**
 * Dates in the super admin console, one way everywhere (v2 review):
 * - a day: "7 Nov 2026"
 * - a moment: "Today, 2:18 pm", "Yesterday, 2:18 pm", else "7 Nov 2026, 2:18 pm"
 */
const DAY = 86_400_000;

export function day(v: string | Date | null | undefined): string {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function moment(v: string | Date | null | undefined, now = new Date()): string {
  if (!v) return '—';
  const at = new Date(v);
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(now) - start(at)) / DAY);
  const time = at.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s?([ap])\.?m\.?/i, ' $1m').toLowerCase();
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  return `${day(at)}, ${time}`;
}
