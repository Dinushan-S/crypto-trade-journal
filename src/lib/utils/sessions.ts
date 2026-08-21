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

export const SESSION_ORDER: MarketSession[] = ['asian', 'london', 'ny', 'overnight', 'my', 'unscheduled'];

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

export function derivePrimarySession(time: string | null | undefined): Exclude<MarketSession, 'my' | 'unscheduled'> | 'unscheduled' {
  const utcMin = parseTimeToMinutes(time);
  if (utcMin == null) return 'unscheduled';
  if (utcMin >= 0 && utcMin < 360) return 'asian';
  if (utcMin >= 360 && utcMin < 480) return 'overnight';
  if (utcMin >= 480 && utcMin < 780) return 'london';
  if (utcMin >= 780 && utcMin < 1320) return 'ny';
  return 'overnight';
}

export function utcMinutesToColomboLabel(utcMin: number): string {
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

export interface SessionStats {
  session: MarketSession;
  count: number;
  wins: number;
  losses: number;
  bes: number;
  winRate: number;
  netPnl: number;
  avgPnl: number;
  grossWin: number;
  grossLoss: number;
  profitFactor: number | null;
}

export function computeSessionStats(trades: any[], myCfg: MySessionConfig = DEFAULT_MY_SESSION): SessionStats[] {
  const by: Record<string, any[]> = {};
  for (const t of trades) {
    for (const s of deriveMarketSessions(t.time, myCfg)) {
      (by[s] ??= []).push(t);
    }
  }
  return SESSION_ORDER.map((session) => {
    const list = by[session] ?? [];
    const wins = list.filter((t) => t.win).length;
    const losses = list.filter((t) => t.loss).length;
    const bes = list.filter((t) => t.be).length;
    const netPnl = list.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const grossWin = list.filter((t) => (t.pnl ?? 0) > 0).reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(list.filter((t) => (t.pnl ?? 0) < 0).reduce((s, t) => s + t.pnl, 0));
    return {
      session,
      count: list.length,
      wins,
      losses,
      bes,
      winRate: list.length ? (wins / list.length) * 100 : 0,
      netPnl,
      avgPnl: list.length ? netPnl / list.length : 0,
      grossWin,
      grossLoss,
      profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : null
    };
  });
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

export function parseMySessionWindow(v: string): MySessionConfig | null {
  const parts = v.split(',').map((s) => s.trim());
  if (parts.length !== 2) return null;
  if (!/^\d{1,2}:\d{2}$/.test(parts[0]) || !/^\d{1,2}:\d{2}$/.test(parts[1])) return null;
  return { start: parts[0].padStart(5, '0'), end: parts[1].padStart(5, '0') };
}
