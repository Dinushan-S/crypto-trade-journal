import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { paginationOptsValidator } from 'convex/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import { syncTradeLiquidation } from './lib/tradeLiquidation';
import { validateReimportTotals } from './lib/tradeImport';
import {
	closeTime,
	groupCloses,
	summarizeGroup,
	refreshTradeGroup,
	tradeOutcome
} from './lib/tradeGroup';
import type { Doc } from './_generated/dataModel';

function validateTrade(values: Record<string, unknown>) {
	for (const [field, value] of Object.entries(values)) {
		if (typeof value === 'number' && !Number.isFinite(value)) {
			throw new Error(field + ' must be a finite number');
		}
	}
	if (
		typeof values.confidence === 'number' &&
		(!Number.isInteger(values.confidence) || values.confidence < 1 || values.confidence > 5)
	) {
		throw new Error('Confidence must be a whole number from 1 to 5');
	}
	for (const field of ['coin', 'date', 'position']) {
		if (field in values && (typeof values[field] !== 'string' || !values[field].trim())) {
			throw new Error(field + ' is required');
		}
	}
}

export const getTrades = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];
		const trades = await ctx.db
			.query('trades')
			.withIndex('by_userId_and_parent_trade_id', (q) =>
				q.eq('userId', userId).eq('parent_trade_id', undefined)
			)
			.filter((q) => q.neq(q.field('source'), 'combined_notes'))
			.order('desc')
			.take(1000);
		return await Promise.all(
			trades
				.filter((t) => !t.parent_trade_id && t.source !== 'combined_notes')
				.map(async (trade) => {
					if (trade.is_group) return trade;
					if (trade.liquidated !== undefined) return trade;
					const link = await ctx.db
						.query('liquidation_trades')
						.withIndex('by_user_trade', (q) => q.eq('userId', userId).eq('trade_id', trade._id))
						.first();
					return { ...trade, liquidated: !!link };
				})
		);
	}
});

export const getTradeById = query({
	args: { id: v.id('trades') },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return null;
		const trade = await ctx.db.get(args.id);
		if (!trade || trade.userId !== userId) return null;
		return trade.is_group
			? summarizeGroup(trade, await groupCloses(ctx, trade))
			: { ...trade, time_closed: closeTime(trade) };
	}
});

export const getTradeCloseEvents = query({
	args: { paginationOpts: paginationOptsValidator },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error('Unauthenticated');
		return await ctx.db
			.query('trades')
			.withIndex('by_user', (q) => q.eq('userId', userId))
			.filter((q) =>
				q.and(q.neq(q.field('is_group'), true), q.neq(q.field('source'), 'combined_notes'))
			)
			.order('desc')
			.paginate(args.paginationOpts);
	}
});

export const createTrade = mutation({
	args: {
		date: v.string(),
		time: v.optional(v.string()),
		day: v.optional(v.string()),
		coin: v.string(),
		position: v.string(),
		entry_price: v.optional(v.number()),
		exit_price: v.optional(v.number()),
		stop_loss: v.optional(v.number()),
		quantity: v.optional(v.number()),
		leverage: v.optional(v.string()),
		strategy: v.optional(v.string()),
		timeframes: v.optional(v.array(v.string())),
		confidence: v.optional(v.number()),
		risk_pct: v.optional(v.number()),
		range_pct: v.optional(v.number()),
		limit_type: v.optional(v.string()),
		pnl: v.optional(v.number()),
		fee: v.optional(v.number()),
		win: v.optional(v.boolean()),
		loss: v.optional(v.boolean()),
		be: v.optional(v.boolean()),
		date_closed: v.optional(v.string()),
		time_closed: v.optional(v.string()),
		closed_reason: v.optional(v.string()),
		duration: v.optional(v.string()),
		reason: v.optional(v.string()),
		pre_notes: v.optional(v.string()),
		post_notes: v.optional(v.string()),
		order_id: v.optional(v.string()),
		fills: v.optional(v.number()),
		source: v.optional(v.string()),
		liquidated: v.optional(v.boolean())
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error('Unauthenticated');
		validateTrade(args);
		const id = await ctx.db.insert('trades', {
			...args,
			...tradeOutcome(args.pnl),
			time_closed: args.time_closed ?? (args.source === 'futures_import' ? args.time : undefined),
			liquidated: args.liquidated ?? false,
			userId,
			created_at: new Date().toISOString()
		});
		if (args.liquidated) await syncTradeLiquidation(ctx, id, true);
		return id;
	}
});

export const updateTrade = mutation({
	args: {
		id: v.id('trades'),
		original_quantity: v.optional(v.number()),
		time_closed: v.optional(v.union(v.string(), v.null())),
		liquidated: v.optional(v.boolean()),
		date: v.optional(v.string()),
		time: v.optional(v.union(v.string(), v.null())),
		day: v.optional(v.union(v.string(), v.null())),
		coin: v.optional(v.string()),
		position: v.optional(v.string()),
		entry_price: v.optional(v.union(v.number(), v.null())),
		exit_price: v.optional(v.union(v.number(), v.null())),
		stop_loss: v.optional(v.union(v.number(), v.null())),
		quantity: v.optional(v.union(v.number(), v.null())),
		leverage: v.optional(v.union(v.string(), v.null())),
		strategy: v.optional(v.union(v.string(), v.null())),
		timeframes: v.optional(v.array(v.string())),
		confidence: v.optional(v.union(v.number(), v.null())),
		risk_pct: v.optional(v.union(v.number(), v.null())),
		range_pct: v.optional(v.union(v.number(), v.null())),
		limit_type: v.optional(v.union(v.string(), v.null())),
		pnl: v.optional(v.union(v.number(), v.null())),
		fee: v.optional(v.union(v.number(), v.null())),
		win: v.optional(v.boolean()),
		loss: v.optional(v.boolean()),
		be: v.optional(v.boolean()),
		date_closed: v.optional(v.union(v.string(), v.null())),
		closed_reason: v.optional(v.union(v.string(), v.null())),
		duration: v.optional(v.union(v.string(), v.null())),
		reason: v.optional(v.union(v.string(), v.null())),
		pre_notes: v.optional(v.union(v.string(), v.null())),
		post_notes: v.optional(v.union(v.string(), v.null()))
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error('Unauthenticated');
		const existing = await ctx.db.get(args.id);
		if (!existing || existing.userId !== userId) throw new Error('Not found');
		validateTrade(args);
		const { id, ...fields } = args;
		if (existing.is_group) {
			if (
				fields.date !== undefined &&
				(await groupCloses(ctx, existing)).some((c) => c.date_closed! < fields.date!)
			)
				throw new Error('Entry date cannot be later than a close.');
			for (const key of [
				'coin',
				'position',
				'pnl',
				'fee',
				'quantity',
				'exit_price',
				'date_closed',
				'time_closed',
				'liquidated',
				'win',
				'loss',
				'be'
			]) {
				if (key in fields) throw new Error('Edit individual closes to change ' + key);
			}
			if (fields.original_quantity !== undefined) {
				const closed = (await groupCloses(ctx, existing)).reduce(
					(sum, c) => sum + (c.quantity ?? 0),
					0
				);
				if (
					fields.original_quantity <= 0 ||
					fields.original_quantity < closed - Math.max(1e-10, closed * 1e-9)
				)
					throw new Error('Original quantity must be at least the total closed quantity.');
			}
		} else if (fields.original_quantity !== undefined)
			throw new Error('Original quantity is only available for combined trades.');
		if (existing.parent_trade_id) {
			const parent = await ctx.db.get(existing.parent_trade_id);
			if (!parent) throw new Error('Combined trade not found');
			if (typeof fields.date_closed === 'string' && fields.date_closed < parent.date)
				throw new Error('Closing date cannot be earlier than the combined entry date.');
			if (fields.date_closed === null) throw new Error('A partial close must have a closing date.');
			if (
				(fields.coin !== undefined && fields.coin !== parent.coin) ||
				(fields.position !== undefined && fields.position !== parent.position)
			)
				throw new Error('Undo Combine before changing the coin or direction.');
			if (fields.quantity !== undefined) {
				if (!(typeof fields.quantity === 'number' && fields.quantity > 0))
					throw new Error('Close quantity must be positive.');
				const others = (await groupCloses(ctx, parent))
					.filter((c) => c._id !== id)
					.reduce((s, c) => s + c.quantity!, 0);
				if (
					others + fields.quantity >
					parent.original_quantity! + Math.max(1e-10, parent.original_quantity! * 1e-9)
				)
					throw new Error('Increase the combined trade original quantity first.');
			}
			if (fields.pnl === null) throw new Error('A partial close must have a PnL.');
		}
		const updates = Object.fromEntries(
			Object.entries(fields).map(([key, value]) => [key, value === null ? undefined : value])
		);
		if (!existing.is_group && existing.source === 'futures_import' && closeTime(existing)) {
			if (fields.time_closed === null)
				throw new Error('Enter the actual close time instead of clearing an imported timestamp.');
			updates.time_closed = fields.time_closed ?? closeTime(existing);
		}
		if ('pnl' in fields) {
			Object.assign(updates, tradeOutcome(typeof fields.pnl === 'number' ? fields.pnl : undefined));
		}
		await ctx.db.patch(id, { ...updates, updated_at: new Date().toISOString() });
		if (fields.liquidated !== undefined || existing.liquidated) {
			await syncTradeLiquidation(ctx, id, fields.liquidated ?? existing.liquidated ?? false);
		}
		await refreshTradeGroup(ctx, id);
	}
});

export const deleteTrade = mutation({
	args: { id: v.id('trades') },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error('Unauthenticated');
		const existing = await ctx.db.get(args.id);
		if (!existing || existing.userId !== userId) throw new Error('Not found');
		if (existing.is_group || existing.parent_trade_id)
			throw new Error('Undo Combine before deleting this trade.');
		await syncTradeLiquidation(ctx, args.id, false);
		await ctx.db.delete(args.id);
	}
});

export const batchCreateTrades = mutation({
	args: {
		trades: v.array(
			v.object({
				date: v.string(),
				time: v.optional(v.string()),
				day: v.optional(v.string()),
				coin: v.string(),
				position: v.string(),
				entry_price: v.optional(v.number()),
				exit_price: v.optional(v.number()),
				stop_loss: v.optional(v.number()),
				quantity: v.optional(v.number()),
				leverage: v.optional(v.string()),
				strategy: v.optional(v.string()),
				timeframes: v.optional(v.array(v.string())),
				confidence: v.optional(v.number()),
				risk_pct: v.optional(v.number()),
				range_pct: v.optional(v.number()),
				limit_type: v.optional(v.string()),
				pnl: v.optional(v.number()),
				fee: v.optional(v.number()),
				win: v.optional(v.boolean()),
				loss: v.optional(v.boolean()),
				be: v.optional(v.boolean()),
				date_closed: v.optional(v.string()),
				time_closed: v.optional(v.string()),
				closed_reason: v.optional(v.string()),
				duration: v.optional(v.string()),
				reason: v.optional(v.string()),
				pre_notes: v.optional(v.string()),
				post_notes: v.optional(v.string()),
				order_id: v.optional(v.string()),
				fills: v.optional(v.number()),
				source: v.optional(v.string()),
				liquidated: v.optional(v.boolean())
			})
		)
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error('Unauthenticated');
		let inserted = 0;
		let updated = 0;
		let skipped = 0;
		for (const trade of args.trades) {
			validateTrade(trade);
			if (trade.order_id) {
				const existing = await ctx.db
					.query('trades')
					.withIndex('by_userId_and_order_id', (q) =>
						q.eq('userId', userId).eq('order_id', trade.order_id)
					)
					.first();
				if (existing) {
					// CSV owns exchange fields; journal notes, strategy and entry details stay untouched.
					const fields = Object.fromEntries(
						Object.entries({
							...(existing.parent_trade_id ? {} : { date: trade.date, time: trade.time }),
							date_closed: trade.date_closed,
							time_closed: trade.time_closed,
							coin: trade.coin,
							position: trade.position,
							exit_price: trade.exit_price,
							quantity: trade.quantity,
							pnl: trade.pnl,
							fee: trade.fee,
							win: trade.win,
							loss: trade.loss,
							be: trade.be,
							...(trade.pnl !== undefined ? tradeOutcome(trade.pnl) : {}),
							liquidated: trade.liquidated
						}).filter(([, value]) => value !== undefined)
					);
					if (existing.parent_trade_id) {
						const parent = await ctx.db.get(existing.parent_trade_id);
						if (!parent || trade.coin !== parent.coin || trade.position !== parent.position)
							throw new Error('Imported close does not match its combined trade.');
						if (trade.date_closed && trade.date_closed < parent.date)
							throw new Error(
								'Imported closing date cannot be earlier than the combined entry date.'
							);
						const qty = trade.quantity ?? existing.quantity;
						if (!(typeof qty === 'number' && qty > 0))
							throw new Error('Close quantity must be positive.');
						const others = (await groupCloses(ctx, parent))
							.filter((c) => c._id !== existing._id)
							.reduce((s, c) => s + c.quantity!, 0);
						if (
							others + qty >
							parent.original_quantity! + Math.max(1e-10, parent.original_quantity! * 1e-9)
						)
							throw new Error(
								'Increase the combined trade original quantity before importing this close.'
							);
					}
					validateReimportTotals(existing, trade);
					if (
						Object.entries(fields).every(
							([key, value]) => existing[key as keyof typeof existing] === value
						)
					) {
						skipped++;
						continue;
					}
					await ctx.db.patch(existing._id, { ...fields, updated_at: new Date().toISOString() });
					if (trade.liquidated !== undefined || existing.liquidated) {
						await syncTradeLiquidation(
							ctx,
							existing._id,
							trade.liquidated ?? existing.liquidated ?? false
						);
					}
					updated++;
					await refreshTradeGroup(ctx, existing._id);
					continue;
				}
			}
			const id = await ctx.db.insert('trades', {
				...trade,
				...tradeOutcome(trade.pnl),
				time_closed:
					trade.time_closed ?? (trade.source === 'futures_import' ? trade.time : undefined),
				liquidated: trade.liquidated ?? false,
				userId,
				created_at: new Date().toISOString()
			});
			if (trade.liquidated) await syncTradeLiquidation(ctx, id, true);
			inserted++;
		}
		return { inserted, updated, skipped };
	}
});

export const combineTrades = mutation({
	args: {
		ids: v.array(v.id('trades')),
		primaryId: v.id('trades'),
		original_quantity: v.number(),
		date: v.string(),
		time: v.optional(v.string()),
		entry_price: v.optional(v.number()),
		leverage: v.optional(v.string()),
		strategy: v.optional(v.string()),
		reason: v.optional(v.string()),
		pre_notes: v.optional(v.string()),
		post_notes: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error('Unauthenticated');
		validateTrade(args);
		const ids = [...new Set(args.ids)];
		if (ids.length < 2 || ids.length > 100 || !ids.includes(args.primaryId))
			throw new Error('Select 2 to 100 trades and a source for shared details.');
		const selected: Doc<'trades'>[] = [];
		for (const id of ids) {
			const trade = await ctx.db.get(id);
			if (!trade || trade.userId !== userId) throw new Error('Trade not found');
			if (trade.parent_trade_id)
				throw new Error('This close already belongs to a combined trade. Refresh and try again.');
			selected.push(trade);
		}
		const groups = selected.filter((t) => t.is_group);
		if (groups.length > 1) throw new Error('Select at most one existing combined trade.');
		const primary = selected.find((t) => t._id === args.primaryId)!;
		if (
			selected.some(
				(t) =>
					t.coin !== primary.coin || t.position !== primary.position || t.source !== primary.source
			)
		)
			throw new Error('Trades must have the same coin, direction and source.');
		const closes = selected.filter((t) => !t.is_group);
		if (groups[0]) closes.push(...(await groupCloses(ctx, groups[0])));
		if (closes.length > 100) throw new Error('A combined trade supports up to 100 closes.');
		if (
			closes.some(
				(c) =>
					!(typeof c.quantity === 'number' && c.quantity > 0) ||
					c.pnl === undefined ||
					!c.date_closed
			)
		)
			throw new Error(
				'Every close needs a positive quantity, PnL and closing date. Edit missing details first.'
			);
		const closed = closes.reduce((s, c) => s + c.quantity!, 0);
		const symbols = new Set(
			closes.filter((c) => c.order_id?.includes('::')).map((c) => c.order_id!.split('::')[0])
		);
		if (symbols.size > 1)
			throw new Error('Closes must use the same market symbol and quote currency.');
		if (
			args.original_quantity <= 0 ||
			args.original_quantity < closed - Math.max(1e-10, closed * 1e-9)
		)
			throw new Error('Original quantity must be at least the total closed quantity.');
		if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date) || closes.some((c) => c.date_closed! < args.date))
			throw new Error('Entry date must be valid and no later than the closes.');
		const { ids: _ids, primaryId: _primaryId, ...details } = args;
		const now = new Date().toISOString();
		const id =
			groups[0]?._id ??
			(await ctx.db.insert('trades', {
				userId,
				coin: primary.coin,
				position: primary.position,
				source: primary.source,
				is_group: true,
				stop_loss: primary.stop_loss,
				timeframes: primary.timeframes,
				confidence: primary.confidence,
				risk_pct: primary.risk_pct,
				range_pct: primary.range_pct,
				limit_type: primary.limit_type,
				created_at: now,
				...details,
				combined_notes_id: primary.combined_notes_id
			}));
		await ctx.db.patch(id, { ...details, updated_at: now });
		for (const close of closes) {
			// Keep source records and their links intact so imports and Undo Combine remain lossless.
			await ctx.db.patch(close._id, { parent_trade_id: id, time_closed: closeTime(close) });
		}
		await refreshTradeGroup(ctx, id);
		return id;
	}
});

export const undoCombine = mutation({
	args: { id: v.id('trades') },
	handler: async (ctx, { id }) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error('Unauthenticated');
		const group = await ctx.db.get(id);
		if (!group || group.userId !== userId || !group.is_group)
			throw new Error('Combined trade not found');
		const closes = await groupCloses(ctx, group);
		for (const close of closes) await ctx.db.patch(close._id, { parent_trade_id: undefined });
		if (closes[0]) await ctx.db.patch(closes[0]._id, { combined_notes_id: id });
		// Preserve the shared journal and any mistake references without copying financial totals.
		await ctx.db.patch(id, {
			is_group: false,
			source: 'combined_notes',
			original_quantity: undefined,
			quantity: undefined,
			closed_quantity: undefined,
			remaining_quantity: undefined,
			close_count: undefined,
			last_close_id: undefined,
			status: undefined,
			pnl: undefined,
			fee: undefined,
			net_pnl: undefined,
			exit_price: undefined,
			win: undefined,
			loss: undefined,
			be: undefined,
			liquidated: undefined,
			date_closed: undefined,
			time_closed: undefined
		});
		return id;
	}
});
