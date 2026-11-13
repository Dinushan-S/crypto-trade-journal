import type { Doc } from '../_generated/dataModel';
import type { QueryCtx, MutationCtx } from '../_generated/server';

export function tradeOutcome(pnl: number | undefined) {
	return {
		win: pnl === undefined ? undefined : pnl > 0,
		loss: pnl === undefined ? undefined : pnl < 0,
		be: pnl === undefined ? undefined : pnl === 0
	};
}

export function closeTime(trade: Doc<'trades'>) {
	return trade.time_closed ?? (trade.source === 'futures_import' ? trade.time : undefined);
}

export async function refreshTradeGroup(ctx: MutationCtx, tradeId: Doc<'trades'>['_id']) {
	const trade = await ctx.db.get(tradeId);
	if (!trade) return;
	const group = trade.parent_trade_id ? await ctx.db.get(trade.parent_trade_id) : trade;
	if (!group?.is_group) return;
	const summary = summarizeGroup(group, await groupCloses(ctx, group));
	await ctx.db.patch(group._id, {
		quantity: summary.quantity,
		closed_quantity: summary.closed_quantity,
		remaining_quantity: summary.remaining_quantity,
		close_count: summary.close_count,
		status: summary.status,
		pnl: summary.pnl,
		fee: summary.fee,
		net_pnl: summary.net_pnl,
		exit_price: summary.exit_price,
		date_closed: summary.date_closed,
		time_closed: summary.time_closed,
		win: summary.win,
		loss: summary.loss,
		be: summary.be,
		liquidated: summary.liquidated,
		last_close_id: summary.partial_closes.at(-1)?._id,
		updated_at: summary.updated_at
	});
}

export async function groupCloses(ctx: Pick<QueryCtx, 'db'>, trade: Doc<'trades'>) {
	const closes = await ctx.db
		.query('trades')
		.withIndex('by_userId_and_parent_trade_id', (q) =>
			q.eq('userId', trade.userId).eq('parent_trade_id', trade._id)
		)
		.take(101);
	if (closes.length > 100) throw new Error('A combined trade supports up to 100 closes.');
	const hydrated = await Promise.all(
		closes.map(async (c) => {
			if (c.liquidated !== undefined) return c;
			const link = await ctx.db
				.query('liquidation_trades')
				.withIndex('by_user_trade', (q) => q.eq('userId', trade.userId).eq('trade_id', c._id))
				.first();
			return { ...c, liquidated: !!link };
		})
	);
	return hydrated.sort((a, b) =>
		`${a.date_closed ?? a.date}T${a.time_closed ?? a.time ?? ''}`.localeCompare(
			`${b.date_closed ?? b.date}T${b.time_closed ?? b.time ?? ''}`
		)
	);
}

export function summarizeGroup(trade: Doc<'trades'>, closes: Doc<'trades'>[]) {
	const closedQuantity = closes.reduce((sum, c) => sum + (c.quantity ?? 0), 0);
	const remaining = Math.max(0, (trade.original_quantity ?? closedQuantity) - closedQuantity);
	const complete = remaining <= Math.max(1e-10, closedQuantity * 1e-9);
	const pnl = closes.reduce((sum, c) => sum + (c.pnl ?? 0), 0);
	const fee = closes.reduce((sum, c) => sum + (c.fee ?? 0), 0);
	const net = pnl - fee;
	const last = closes.at(-1);
	return {
		...trade,
		quantity: trade.original_quantity,
		closed_quantity: closedQuantity,
		updated_at: [trade.updated_at, ...closes.map((c) => c.updated_at)]
			.filter((value): value is string => !!value)
			.sort()
			.at(-1),
		remaining_quantity: complete ? 0 : remaining,
		close_count: closes.length,
		status: complete ? 'Closed' : 'Partially closed',
		pnl,
		fee,
		net_pnl: net,
		exit_price:
			closes.every((c) => c.exit_price != null) && closedQuantity > 0
				? closes.reduce((sum, c) => sum + c.exit_price! * c.quantity!, 0) / closedQuantity
				: undefined,
		date_closed: complete ? (last?.date_closed ?? last?.date) : undefined,
		time_closed: complete
			? (last?.time_closed ?? (last?.source === 'futures_import' ? last.time : undefined))
			: undefined,
		...tradeOutcome(complete ? pnl : undefined),
		liquidated: closes.some((c) => c.liquidated),
		partial_closes: closes
	};
}
