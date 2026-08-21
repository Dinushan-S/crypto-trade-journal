import type { PageServerLoad } from './$types';
import { api } from '../../../../convex/_generated/api';

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
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m ?? 0);
}
function deriveMarketSessions(time: string | null | undefined, myCfg = { start: '04:30', end: '12:30' }): string[] {
  const utcMin = parseTimeToMinutes(time);
  if (utcMin == null) return ['unscheduled'];
  const out: string[] = [];
  if (utcMin >= 0 && utcMin < 360) out.push('asian');
  else if (utcMin >= 360 && utcMin < 480) out.push('overnight');
  else if (utcMin >= 480 && utcMin < 780) out.push('london');
  else if (utcMin >= 780 && utcMin < 1320) out.push('ny');
  else out.push('overnight');
  if (inRange(utcMin, toMinutes(myCfg.start), toMinutes(myCfg.end))) out.push('my');
  return out;
}

export const load: PageServerLoad = async ({ locals: { convex }, url, cookies }) => {
  const sessions = await convex.query(api.sessions.getSessions, {}).catch(() => []);
  const grouped: Record<string, { date: string; pre?: any; tcl?: any; post?: any }> = {};
  for (const s of sessions) {
    if (!grouped[s.date]) grouped[s.date] = { date: s.date };
    grouped[s.date][s.session_type as 'pre' | 'tcl' | 'post'] = { ...s, id: s._id };
  }

  const sessionRaw = url.searchParams.get('session') ?? '';
  const result = url.searchParams.get('result') ?? 'all';
  const viewTzParam = url.searchParams.get('tz') ?? '';
  const sessionsFilter = sessionRaw ? sessionRaw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) : [];
  const calendarTz = (cookies.get('calendarTz') ?? 'local') as string;
  const viewTz: 'utc' | 'colombo' = viewTzParam === 'colombo' ? 'colombo' : viewTzParam === 'utc' ? 'utc' : (calendarTz === 'utc' ? 'utc' : 'colombo');

  let myCfg = { start: '04:30', end: '12:30' };
  try {
    const settings: any = await convex.query(api.userSettings.getUserSettings, {} as any).catch(() => null);
    if (settings?.my_session_start && settings?.my_session_end) myCfg = { start: settings.my_session_start, end: settings.my_session_end };
  } catch {}

  const allTrades = await convex.query(api.trades.getTrades, {}).catch(() => []);
  let filtered: any[] = allTrades.map((t: any) => ({ ...t, id: t._id }));

  if (result === 'win') filtered = filtered.filter((t: any) => t.win === true);
  if (result === 'loss') filtered = filtered.filter((t: any) => t.loss === true);
  if (result === 'be') filtered = filtered.filter((t: any) => t.be === true);
  if (sessionsFilter.length > 0) {
    const set = new Set(sessionsFilter);
    filtered = filtered.filter((t: any) => deriveMarketSessions(t.time, myCfg).some((s) => set.has(s)));
  }

  const computeStats = (arr: any[]) => {
    const by: Record<string, any[]> = {};
    for (const t of arr) for (const s of deriveMarketSessions(t.time, myCfg)) (by[s] ??= []).push(t);
    const order = ['asian', 'london', 'ny', 'overnight', 'my', 'unscheduled'] as const;
    return order.map((session) => {
      const list = by[session] ?? [];
      const wins = list.filter((t) => t.win).length;
      const netPnl = list.reduce((s, t) => s + (t.pnl ?? 0), 0);
      const grossWin = list.filter((t) => (t.pnl ?? 0) > 0).reduce((s, t) => s + t.pnl, 0);
      const grossLoss = Math.abs(list.filter((t) => (t.pnl ?? 0) < 0).reduce((s, t) => s + t.pnl, 0));
      return { session, count: list.length, wins, losses: list.filter((t) => t.loss).length, bes: list.filter((t) => t.be).length, winRate: list.length ? (wins / list.length) * 100 : 0, netPnl, avgPnl: list.length ? netPnl / list.length : 0, grossWin, grossLoss, profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : null };
    });
  };

  const hourlyBuckets = (() => {
    const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0, wins: 0, netPnl: 0 }));
    for (const t of filtered) {
      const m = parseTimeToMinutes(t.time);
      if (m == null) continue;
      const h = Math.floor(m / 60);
      buckets[h].count++;
      if (t.win) buckets[h].wins++;
      buckets[h].netPnl += t.pnl ?? 0;
    }
    return buckets;
  })();

  const sessionCounts = computeStats(allTrades.filter((t: any) => {
    if (result === 'win' && t.win !== true) return false;
    if (result === 'loss' && t.loss !== true) return false;
    if (result === 'be' && t.be !== true) return false;
    return true;
  }));
  const sessionStats = computeStats(filtered);

  return {
    sessions: Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date)),
    trades: filtered.slice(0, 200),
    totalTrades: filtered.length,
    allTradesCount: allTrades.length,
    filters: { session: sessionRaw, result, tz: viewTz },
    sessionStats,
    sessionCounts,
    hourlyBuckets,
    mySession: myCfg,
    viewTz
  };
};
