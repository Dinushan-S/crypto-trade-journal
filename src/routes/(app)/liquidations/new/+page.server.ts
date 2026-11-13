import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '../../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../../convex/_generated/dataModel';

export const load: PageServerLoad = async ({ locals: { convex }, url }) => {
	const tradeIdsStr = url.searchParams.get('tradeIds') ?? '';
	const tradeIds = tradeIdsStr.length > 0 ? tradeIdsStr.split(',').filter(Boolean) : [];

	// Trades the user can link (not already linked to another liquidation)
	const availableTrades = await convex
		.query(api.liquidations.getAvailableTrades, {})
		.catch(() => []);

	// If no tradeIds, return empty defaults for standalone mode
	if (tradeIds.length === 0) {
		return {
			tradeIds: [],
			selectedTradeDocs: [],
			availableTrades,
			prefill: null
		};
	}

	// Fetch selected trades and compute prefilled values
	const dates = new Set<string>();
	const coins = new Set<string>();
	const positions = new Set<string>();
	const strategies = new Set<string>();
	let netPnl = 0;
	const selectedTradeDocs: Doc<'trades'>[] = [];

	for (const id of tradeIds) {
		const trade = await convex
			.query(api.trades.getTradeById, { id: id as Id<'trades'> })
			.catch(() => null);
		if (!trade) continue;
		const closes = trade.is_group && 'partial_closes' in trade ? trade.partial_closes : [trade];
		for (const trade of closes) {
			if (selectedTradeDocs.some((t) => t._id === trade._id)) continue;
			selectedTradeDocs.push(trade);
			if (trade.date) dates.add(trade.date);
			if (trade.coin) coins.add(trade.coin);
			if (trade.position) positions.add(trade.position);
			if (trade.strategy) strategies.add(trade.strategy);
			netPnl += trade.pnl ?? 0;
		}
	}

	// Sort dates descending — latest date becomes default
	const sortedDates = [...dates].sort().reverse();
	const latestDate = sortedDates[0] || '';
	const uniqueCoin = coins.size === 1 ? Array.from(coins)[0] : undefined;
	const uniquePosition = positions.size === 1 ? Array.from(positions)[0] : undefined;
	const uniqueStrategy = strategies.size === 1 ? Array.from(strategies)[0] : undefined;
	const amountLost = Math.max(0, -netPnl);

	return {
		tradeIds: selectedTradeDocs.map((t) => t._id),
		selectedTradeDocs,
		availableTrades,
		prefill: {
			date: latestDate,
			coin: uniqueCoin,
			position: uniquePosition,
			strategy: uniqueStrategy,
			amount_lost: amountLost,
			count: selectedTradeDocs.length
		}
	};
};

export const actions: Actions = {
	default: async ({ locals: { convex }, request }) => {
		const formData = await request.formData();
		const date = (formData.get('date') as string) || '';
		const coin = (formData.get('coin') as string) || undefined;
		const position = (formData.get('position') as string) || undefined;
		const amount_lost = formData.get('amount_lost')
			? Number(formData.get('amount_lost'))
			: undefined;
		const strategy = (formData.get('strategy') as string) || undefined;
		const reason = (formData.get('reason') as string) || undefined;
		const mistake = (formData.get('mistake') as string) || undefined;
		const notes = (formData.get('notes') as string) || undefined;
		const tradeIds = ((formData.get('tradeIds') as string) || '')
			.split(',')
			.filter(Boolean)
			.map((t) => t.trim());

		if (!date) return fail(400, { error: 'Date is required.' });
		if (amount_lost === undefined || !Number.isFinite(amount_lost) || amount_lost <= 0) {
			return fail(400, { error: 'Amount lost must be a positive number.' });
		}

		let id: string;
		try {
			if (tradeIds.length > 0) {
				id = await convex.mutation(api.liquidations.createLiquidationWithTrades, {
					date,
					coin,
					position,
					amount_lost,
					strategy,
					reason,
					mistake,
					notes,
					tradeIds: tradeIds as Id<'trades'>[]
				});
			} else {
				id = await convex.mutation(api.liquidations.createLiquidation, {
					date,
					coin,
					position,
					amount_lost,
					strategy,
					reason,
					mistake,
					notes
				});
			}
		} catch (err) {
			return fail(500, {
				error: (err instanceof Error && err.message) || 'Failed to save liquidation.'
			});
		}

		redirect(303, `/liquidations/${id}`);
	}
};
