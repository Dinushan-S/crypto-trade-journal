import type { PageServerLoad } from './$types';
import { api } from '../../../convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';
import type { Doc } from '../../../convex/_generated/dataModel';

export const load: PageServerLoad = async ({ locals: { convex }, cookies }) => {
	const calendarTz = cookies.get('calendarTz') ?? 'local';

	const [allTrades, allLedger] = await Promise.all([
		convex.query(api.trades.getTrades, {}).catch(() => []),
		convex.query(api.ledger.getLedger, {}).catch(() => [])
	]);

	const trades = allTrades ?? [];
	const ledger = allLedger ?? [];

	const totalTrades = trades.length;
	const completedTrades = trades.filter((t) => !t.is_group || t.status === 'Closed');
	const wins = trades.filter((t) => t.win).length;
	const winRate = completedTrades.length > 0 ? (wins / completedTrades.length) * 100 : 0;
	const netPnl = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);
	const avgPnl = totalTrades > 0 ? netPnl / totalTrades : 0;

	const deposits = ledger.filter((l) => l.type === 'deposit');
	const withdrawals = ledger.filter((l) => l.type === 'withdrawal');
	const totalDeposited = deposits.reduce((s, l) => s + (l.usd_received ?? 0), 0);
	const totalWithdrawn = withdrawals.reduce((s, l) => s + (l.usd_quantity ?? 0), 0);
	const totalLkrIn = deposits.reduce((s, l) => s + (l.fiat_sent ?? 0), 0);
	const totalLkrOut = withdrawals.reduce((s, l) => s + (l.fiat_amount ?? 0), 0);
	const netContributionLkr = totalLkrIn - totalLkrOut;

	const recentTrades = trades.slice(0, 5).map((t) => ({
		id: t._id,
		coin: t.coin,
		position: t.position,
		pnl: t.pnl,
		date: t.date,
		win: t.win,
		loss: t.loss,
		be: t.be
	}));

	const recentLedger = ledger.slice(0, 3).map((l) => ({
		id: l._id,
		type: l.type,
		date: l.date,
		fiat_sent: l.fiat_sent,
		usd_received: l.usd_received,
		usd_quantity: l.usd_quantity
	}));

	// Monthly PnL
	// Read history in separate bounded transactions; the list query only reads saved summaries.
	const tradeById = new Map(trades.map((t) => [t._id, t]));
	type CloseEvent = Omit<Doc<'trades'>, 'time'> & {
		completed: boolean;
		outcome_win: boolean;
		time: string | null | undefined;
	};
	const closeEvents: CloseEvent[] = [];
	let cursor: string | null = null;
	do {
		const history: FunctionReturnType<typeof api.trades.getTradeCloseEvents> = await convex.query(
			api.trades.getTradeCloseEvents,
			{
				paginationOpts: { numItems: 500, cursor }
			}
		);
		for (const c of history.page) {
			const trade = tradeById.get(c.parent_trade_id ?? c._id);
			if (!trade) continue;
			closeEvents.push({
				...c,
				_id: trade._id,
				date: trade.date,
				completed: !trade.is_group || (trade.status === 'Closed' && c._id === trade.last_close_id),
				outcome_win: !!trade.win,
				time: c.time_closed ?? (c.source === 'futures_import' ? c.time : null)
			});
		}
		cursor = history.isDone ? null : history.continueCursor;
	} while (cursor);
	const monthlyMap: Record<string, number> = {};
	for (const t of closeEvents) {
		const closeDate = (t.date_closed ?? t.date)?.slice(0, 10);
		if (!closeDate || t.pnl == null) continue;
		const month = closeDate.slice(0, 7);
		monthlyMap[month] = (monthlyMap[month] ?? 0) + t.pnl;
	}
	const sortedMonths = Object.keys(monthlyMap).sort();
	let running = 0;
	const monthlyPnl = sortedMonths.map((m) => {
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
	const winCount = trades.filter((t) => t.win === true).length;
	const lossCount = completedTrades.filter((t) => t.loss).length;
	const beCount = completedTrades.filter((t) => t.be).length;

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
		completed: boolean;
		outcome_win: boolean;
	};
	type DayStat = { netPnl: number; tradeCount: number; trades: DayTrade[] };
	const dailyStats: Record<string, DayStat> = {};

	for (const t of closeEvents) {
		// Stored date/time are Colombo (LKR). Always serve raw values; the client converts for the UTC view.
		const day = (t.date_closed ?? t.date)?.slice(0, 10);
		if (!day || t.pnl == null) continue;
		if (!dailyStats[day]) dailyStats[day] = { netPnl: 0, tradeCount: 0, trades: [] };
		dailyStats[day].netPnl += t.pnl;
		if (!dailyStats[day].trades.some((trade) => trade.id === t._id))
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
			completed: t.completed,
			outcome_win: t.outcome_win
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
			ledgerMonthMap[month] = {
				month,
				depositedUsd: 0,
				withdrawnUsd: 0,
				depositedLkr: 0,
				withdrawnLkr: 0,
				netUsd: 0
			};
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
		.map((m) => ({ ...m, netUsd: m.depositedUsd - m.withdrawnUsd }))
		.sort((a, b) => b.month.localeCompare(a.month));

	return {
		stats: {
			totalTrades,
			winRate,
			netPnl,
			avgPnl,
			totalDeposited,
			totalWithdrawn,
			netContributionLkr
		},
		recentTrades,
		recentLedger,
		chartData: { monthlyPnl, coinPnl, winCount, lossCount, beCount, dailyStats },
		monthlyLedger,
		calendarTz
	};
};
