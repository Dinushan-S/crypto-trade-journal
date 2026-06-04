import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
  const [tradesRes, ledgerRes, recentTradesRes, recentLedgerRes] = await Promise.all([
    supabase.from('trades').select('pnl, win, loss, be', { count: 'exact' }),
    supabase.from('ledger').select('type, fiat_sent, usd_received, usd_quantity, usd_rate, fiat_amount'),
    supabase.from('trades').select('id, coin, position, pnl, date, win, loss, be').order('date', { ascending: false }).order('created_at', { ascending: false }).limit(5),
    supabase.from('ledger').select('id, type, date, fiat_sent, usd_received, usd_quantity').order('date', { ascending: false }).limit(3),
  ]);

  const trades = tradesRes.data ?? [];
  const ledger = ledgerRes.data ?? [];

  const totalTrades = tradesRes.count ?? 0;
  const wins = trades.filter(t => t.win).length;
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100) : 0;
  const netPnl = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const avgPnl = totalTrades > 0 ? netPnl / totalTrades : 0;

  const deposits = ledger.filter(l => l.type === 'deposit');
  const withdrawals = ledger.filter(l => l.type === 'withdrawal');
  const totalDeposited = deposits.reduce((s, l) => s + (l.usd_received ?? 0), 0);
  const totalWithdrawn = withdrawals.reduce((s, l) => s + (l.usd_quantity ?? 0), 0);
  const totalLkrIn = deposits.reduce((s, l) => s + (l.fiat_sent ?? 0), 0);
  const totalLkrOut = withdrawals.reduce((s, l) => s + (l.fiat_amount ?? 0), 0);
  const netContributionLkr = totalLkrIn - totalLkrOut;

  // Chart data: fetch all trades for aggregation
  const { data: allTrades } = await supabase
    .from('trades')
    .select('date, pnl, coin, win')
    .order('date', { ascending: true });

  // Monthly PnL (cumulative running total per month)
  const monthlyMap: Record<string, number> = {};
  for (const t of allTrades ?? []) {
    if (!t.date || t.pnl == null) continue;
    const month = t.date.slice(0, 7); // YYYY-MM
    monthlyMap[month] = (monthlyMap[month] ?? 0) + t.pnl;
  }
  const sortedMonths = Object.keys(monthlyMap).sort();
  let running = 0;
  const monthlyPnl = sortedMonths.map(m => {
    running += monthlyMap[m];
    return { month: m, cumulative: running, monthly: monthlyMap[m] };
  });

  // PnL by coin (top 10)
  const coinMap: Record<string, number> = {};
  for (const t of allTrades ?? []) {
    if (!t.coin || t.pnl == null) continue;
    coinMap[t.coin] = (coinMap[t.coin] ?? 0) + t.pnl;
  }
  const coinPnl = Object.entries(coinMap)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 10);

  // Win/Loss/BE counts
  const winCount = (allTrades ?? []).filter(t => t.win === true).length;
  const lossCount = (allTrades ?? []).filter(t => t.win === false && t.pnl !== null && t.pnl < 0).length;
  const beCount = (allTrades ?? []).filter(t => t.pnl === 0).length;

  return {
    stats: { totalTrades, winRate, netPnl, avgPnl, totalDeposited, totalWithdrawn, netContributionLkr },
    recentTrades: recentTradesRes.data ?? [],
    recentLedger: recentLedgerRes.data ?? [],
    chartData: { monthlyPnl, coinPnl, winCount, lossCount, beCount },
  };
};
