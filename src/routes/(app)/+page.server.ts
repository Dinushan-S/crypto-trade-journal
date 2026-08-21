import type { PageServerLoad } from './$types';
import { api } from '../../../convex/_generated/api';

export const load: PageServerLoad = async ({ locals: { convex }, cookies }) => {
  const calendarTz = cookies.get('calendarTz') ?? 'local';

  const [allTrades, allLedger] = await Promise.all([
    convex.query(api.trades.getTrades, {}).catch(() => []),
    convex.query(api.ledger.getLedger, {}).catch(() => []),
  ]);

  const trades: any[] = allTrades ?? [];
  const ledger: any[] = allLedger ?? [];

  const totalTrades = trades.length;
  const wins = trades.filter((t: any) => t.win).length;
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100) : 0;
  const netPnl = trades.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0);
  const avgPnl = totalTrades > 0 ? netPnl / totalTrades : 0;

  const deposits = ledger.filter((l: any) => l.type === 'deposit');
  const withdrawals = ledger.filter((l: any) => l.type === 'withdrawal');
  const totalDeposited = deposits.reduce((s: number, l: any) => s + (l.usd_received ?? 0), 0);
  const totalWithdrawn = withdrawals.reduce((s: number, l: any) => s + (l.usd_quantity ?? 0), 0);
  const totalLkrIn = deposits.reduce((s: number, l: any) => s + (l.fiat_sent ?? 0), 0);
  const totalLkrOut = withdrawals.reduce((s: number, l: any) => s + (l.fiat_amount ?? 0), 0);
  const netContributionLkr = totalLkrIn - totalLkrOut;

  const recentTrades = trades.slice(0, 5).map((t: any) => ({
    id: t._id,
    coin: t.coin,
    position: t.position,
    pnl: t.pnl,
    date: t.date,
    win: t.win,
    loss: t.loss,
    be: t.be,
  }));

  const recentLedger = ledger.slice(0, 3).map((l: any) => ({
    id: l._id,
    type: l.type,
    date: l.date,
    fiat_sent: l.fiat_sent,
    usd_received: l.usd_received,
    usd_quantity: l.usd_quantity,
  }));

  // Monthly PnL
  const monthlyMap: Record<string, number> = {};
  for (const t of trades) {
    const closeDate = (t.date_closed ?? t.date)?.slice(0, 10);
    if (!closeDate || t.pnl == null) continue;
    const month = closeDate.slice(0, 7);
    monthlyMap[month] = (monthlyMap[month] ?? 0) + t.pnl;
  }
  const sortedMonths = Object.keys(monthlyMap).sort();
  let running = 0;
  const monthlyPnl = sortedMonths.map(m => {
    running += monthlyMap[m];
    return { month: m, cumulative: running, monthly: monthlyMap[m] };
  });

  // PnL by coin
  const coinMap: Record<string, number> = {};
  for (const t of trades) {
    if (!t.coin || t.pnl == null) continue;
    coinMap[t.coin] = (coinMap[t.coin] ?? 0) + t.pnl;
  }
  const coinPnl = Object.entries(coinMap)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 10);

  // Win/Loss/BE counts
  const winCount = trades.filter((t: any) => t.win === true).length;
  const lossCount = trades.filter((t: any) => t.win === false && t.pnl !== null && t.pnl! < 0).length;
  const beCount = trades.filter((t: any) => t.pnl === 0).length;

  // Daily stats
  type DayTrade = {
    id: string;
    coin: string;
    position: string;
    date_opened: string | null;
    date_closed: string | null;
    time: string | null;
    entry_price: number | null;
    exit_price: number | null;
    pnl: number;
  };
  type DayStat = { netPnl: number; tradeCount: number; trades: DayTrade[] };
  const dailyStats: Record<string, DayStat> = {};

  for (const t of trades) {
    // Stored date/time are Colombo (LKR). Always serve raw values; the client converts for the UTC view.
    const day = (t.date_closed ?? t.date)?.slice(0, 10);
    if (!day || t.pnl == null) continue;
    if (!dailyStats[day]) dailyStats[day] = { netPnl: 0, tradeCount: 0, trades: [] };
    dailyStats[day].netPnl += t.pnl;
    dailyStats[day].tradeCount += 1;
    dailyStats[day].trades.push({
      id: t._id,
      coin: t.coin ?? '',
      position: t.position ?? '',
      date_opened: t.date ?? null,
      date_closed: t.date_closed ?? null,
      time: t.time ?? null,
      entry_price: t.entry_price ?? null,
      exit_price: t.exit_price ?? null,
      pnl: t.pnl,
    });
  }

  // Monthly ledger summary
  type MonthLedger = {
    month: string;
    depositedUsd: number;
    withdrawnUsd: number;
    depositedLkr: number;
    withdrawnLkr: number;
    netUsd: number;
  };
  const ledgerMonthMap: Record<string, MonthLedger> = {};
  for (const entry of ledger) {
    if (!entry.date) continue;
    const month = entry.date.slice(0, 7);
    if (!ledgerMonthMap[month]) {
      ledgerMonthMap[month] = { month, depositedUsd: 0, withdrawnUsd: 0, depositedLkr: 0, withdrawnLkr: 0, netUsd: 0 };
    }
    if (entry.type === 'deposit') {
      ledgerMonthMap[month].depositedUsd += entry.usd_received ?? 0;
      ledgerMonthMap[month].depositedLkr += entry.fiat_sent ?? 0;
    } else if (entry.type === 'withdrawal') {
      ledgerMonthMap[month].withdrawnUsd += entry.usd_quantity ?? 0;
      ledgerMonthMap[month].withdrawnLkr += entry.fiat_amount ?? 0;
    }
  }
  const monthlyLedger = Object.values(ledgerMonthMap)
    .map(m => ({ ...m, netUsd: m.depositedUsd - m.withdrawnUsd }))
    .sort((a, b) => b.month.localeCompare(a.month));

  return {
    stats: { totalTrades, winRate, netPnl, avgPnl, totalDeposited, totalWithdrawn, netContributionLkr },
    recentTrades,
    recentLedger,
    chartData: { monthlyPnl, coinPnl, winCount, lossCount, beCount, dailyStats },
    monthlyLedger,
    calendarTz,
  };
};
