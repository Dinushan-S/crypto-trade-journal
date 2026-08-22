export type MarketSession = 'asian' | 'london' | 'ny' | 'overnight' | 'my' | 'unscheduled';
export type ViewTz = 'utc' | 'colombo';

export interface MySessionConfig {
  start: string;
  end: string;
}

export const DEFAULT_MY_SESSION: MySessionConfig = { start: '04:30', end: '12:30' };

export const SESSION_LABELS: Record<MarketSession, string> = {
  asian: 'Asian',
  london: 'London',
  ny: 'NY',
  overnight: 'Overnight',
  my: 'My Session',
  unscheduled: 'Unscheduled'
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m ?? 0);
}

function parseTimeToMinutes(time?: string | null): number | null {
  if (!time) return null;
  const parts = time.split(':').map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
  return parts[0] * 60 + parts[1];
}

function inRange(min: number, start: number, end: number): boolean {
  if (start <= end) return min >= start && min < end;
  return min >= start || min < end;
}

function isInMySession(utcMin: number, cfg: MySessionConfig): boolean {
  return inRange(utcMin, toMinutes(cfg.start), toMinutes(cfg.end));
}

export function deriveMarketSessions(
  time: string | null | undefined,
  myCfg: MySessionConfig = DEFAULT_MY_SESSION
): MarketSession[] {
  const utcMin = parseTimeToMinutes(time);
  if (utcMin == null) return ['unscheduled'];
  const out: MarketSession[] = [];
  if (utcMin >= 0 && utcMin < 360) out.push('asian');
  else if (utcMin >= 360 && utcMin < 480) out.push('overnight');
  else if (utcMin >= 480 && utcMin < 780) out.push('london');
  else if (utcMin >= 780 && utcMin < 1320) out.push('ny');
  else out.push('overnight');

  if (isInMySession(utcMin, myCfg)) out.push('my');
  return out;
}

function utcMinutesToColomboLabel(utcMin: number): string {
  const m = (utcMin + 330) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')} Colombo`;
}

export function formatSessionTime(time: string | null | undefined, tz: ViewTz): string {
  if (!time) return '—';
  const utcMin = parseTimeToMinutes(time);
  if (utcMin == null) return time;
  if (tz === 'utc') return time.slice(0, 5) + ' UTC';
  return utcMinutesToColomboLabel(utcMin);
}

export function sessionBadgeColor(s: MarketSession): string {
  if (s === 'asian') return 'var(--accent)';
  if (s === 'london') return '#6366f1';
  if (s === 'ny') return '#0ea5e9';
  if (s === 'overnight') return '#8b5cf6';
  if (s === 'my') return 'var(--win)';
  return 'var(--text-muted)';
}

export function hourlyBuckets(trades: any[]) {
  const buckets: Array<{ hour: number; count: number; wins: number; netPnl: number }> = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0, wins: 0, netPnl: 0 }));
  for (const t of trades) {
    const m = parseTimeToMinutes(t.time);
    if (m == null) continue;
    const h = Math.floor(m / 60);
    buckets[h].count++;
    if (t.win) buckets[h].wins++;
    buckets[h].netPnl += t.pnl ?? 0;
  }
  return buckets;
}

