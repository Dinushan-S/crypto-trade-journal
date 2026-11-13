/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { expect, test, vi } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

test('editing a trade saves decimals and updates only its modification timestamp', async () => {
	vi.useFakeTimers();
	try {
		vi.setSystemTime(new Date('2026-11-12T10:00:00Z'));
		const t = convexTest(schema, modules).withIdentity({ subject: 'user-123' });
		const id = await t.mutation(api.trades.createTrade, {
			coin: 'BTC',
			position: 'Long',
			date: '2026-11-10',
			time: '08:21:37',
			date_closed: '2026-11-11',
			exit_price: 69340.3,
			quantity: 0.009
		});
		const before = await t.query(api.trades.getTradeById, { id });

		vi.setSystemTime(new Date('2026-11-13T10:00:00Z'));
		await t.mutation(api.trades.updateTrade, { id, strategy: 'Breakout' });
		expect(await t.query(api.trades.getTradeById, { id })).toMatchObject({
			date: '2026-11-10',
			time: '08:21:37',
			date_closed: '2026-11-11',
			exit_price: 69340.3,
			quantity: 0.009,
			strategy: 'Breakout',
			created_at: before!.created_at,
			updated_at: '2026-11-13T10:00:00.000Z'
		});

		await t.mutation(api.trades.updateTrade, { id, time: '09:15:42', exit_price: 69341.25 });
		expect(await t.query(api.trades.getTradeById, { id })).toMatchObject({
			time: '09:15:42',
			date_closed: '2026-11-11',
			exit_price: 69341.25
		});
	} finally {
		vi.useRealTimers();
	}
});

test('clearing optional trade fields removes stale values and result flags', async () => {
	const t = convexTest(schema, modules).withIdentity({ subject: 'user-123' });
	const id = await t.mutation(api.trades.createTrade, {
		coin: 'BTC',
		position: 'Long',
		date: '2026-11-10',
		time: '08:21:37',
		pnl: 50,
		win: true,
		strategy: 'Breakout',
		timeframes: ['1h']
	});
	await t.mutation(api.trades.updateTrade, { id, pnl: null, strategy: null, timeframes: [] });
	const saved = await t.query(api.trades.getTradeById, { id });
	expect(saved!.pnl).toBeUndefined();
	expect(saved!.win).toBeUndefined();
	expect(saved!.strategy).toBeUndefined();
	expect(saved!.timeframes).toEqual([]);
	expect(saved!.time).toBe('08:21:37');
});

test('rejects invalid trade numbers without changing saved data', async () => {
	const t = convexTest(schema, modules).withIdentity({ subject: 'user-123' });
	const id = await t.mutation(api.trades.createTrade, {
		coin: 'BTC',
		position: 'Long',
		date: '2026-11-10',
		exit_price: 69340.3
	});
	for (const exit_price of [NaN, Infinity]) {
		await expect(t.mutation(api.trades.updateTrade, { id, exit_price })).rejects.toThrow();
	}
	await expect(t.mutation(api.trades.updateTrade, { id, confidence: 1.5 })).rejects.toThrow();
	expect((await t.query(api.trades.getTradeById, { id }))!.exit_price).toBe(69340.3);
});

test('marking a trade liquidated creates one linked event and unmarking removes its automatic event', async () => {
	const t = convexTest(schema, modules).withIdentity({ subject: 'user-123' });
	const id = await t.mutation(api.trades.createTrade, {
		coin: 'BTC',
		position: 'Long',
		date: '2026-11-10',
		pnl: -100.25
	});
	await t.mutation(api.trades.updateTrade, { id, liquidated: true });
	await t.mutation(api.trades.updateTrade, { id, liquidated: true });
	const events = await t.query(api.liquidations.getLiquidations, {});
	expect(events).toHaveLength(1);
	expect(events[0].amount_lost).toBe(100.25);
	expect(await t.query(api.liquidations.getLiquidationForTrade, { tradeId: id })).toBe(
		events[0]._id
	);
	await t.mutation(api.trades.updateTrade, { id, liquidated: false });
	expect(await t.query(api.liquidations.getLiquidations, {})).toHaveLength(0);
	expect((await t.query(api.trades.getTradeById, { id }))!.liquidated).toBe(false);
});

test('re-import updates orders and liquidation status without losing journal edits or creating duplicates', async () => {
	const t = convexTest(schema, modules).withIdentity({ subject: 'user-123' });
	const trade = {
		coin: 'BTC',
		position: 'Long',
		date: '2026-11-10',
		time: '08:21:37',
		pnl: -100,
		quantity: 0.009,
		exit_price: 69340.3,
		fee: 0.1,
		order_id: 'BTCUSDT::123',
		source: 'futures_import'
	};
	expect(await t.mutation(api.trades.batchCreateTrades, { trades: [trade] })).toEqual({
		inserted: 1,
		updated: 0,
		skipped: 0
	});
	const [saved] = await t.query(api.trades.getTrades, {});
	await t.mutation(api.trades.updateTrade, {
		id: saved._id,
		strategy: 'Breakout',
		reason: 'My setup',
		pre_notes: 'Keep this',
		entry_price: 69000
	});
	const changed = { ...trade, liquidated: true };
	expect(await t.mutation(api.trades.batchCreateTrades, { trades: [changed] })).toEqual({
		inserted: 0,
		updated: 1,
		skipped: 0
	});
	expect(await t.query(api.trades.getTradeById, { id: saved._id })).toMatchObject({
		strategy: 'Breakout',
		reason: 'My setup',
		pre_notes: 'Keep this',
		entry_price: 69000,
		pnl: -100,
		exit_price: 69340.3,
		liquidated: true
	});
	expect(await t.mutation(api.trades.batchCreateTrades, { trades: [changed] })).toEqual({
		inserted: 0,
		updated: 0,
		skipped: 1
	});
	expect(await t.query(api.liquidations.getLiquidations, {})).toHaveLength(1);
	// A CSV without a liquidation column must preserve the existing mark.
	await t.mutation(api.trades.batchCreateTrades, { trades: [{ ...trade, time: '08:21:38' }] });
	expect((await t.query(api.trades.getTradeById, { id: saved._id }))!.liquidated).toBe(true);
	expect((await t.query(api.liquidations.getLiquidations, {}))[0].amount_lost).toBe(100);
});

test('partial or changed aggregate reimports are rejected atomically', async () => {
	const t = convexTest(schema, modules).withIdentity({ subject: 'user-123' });
	const trade = {
		coin: 'BTC',
		position: 'Long',
		date: '2026-11-10',
		quantity: 2,
		pnl: -200,
		fee: 2,
		exit_price: 100,
		order_id: 'BTCUSDT::partial',
		source: 'futures_import'
	};
	await t.mutation(api.trades.batchCreateTrades, { trades: [trade] });
	for (const changed of [
		{ quantity: 1, pnl: -100, fee: 1 },
		{ quantity: 3, pnl: -300 },
		{ pnl: -250 }
	]) {
		await expect(
			t.mutation(api.trades.batchCreateTrades, {
				trades: [{ ...trade, ...changed, liquidated: true }]
			})
		).rejects.toThrow('financial totals differ');
	}
	const [saved] = await t.query(api.trades.getTrades, {});
	expect(saved).toMatchObject({ quantity: 2, pnl: -200, fee: 2, liquidated: false });
	expect(await t.query(api.liquidations.getLiquidations, {})).toHaveLength(0);
	await t.mutation(api.trades.batchCreateTrades, {
		trades: [{ ...trade, date_closed: '2026-11-12', liquidated: true }]
	});
	expect((await t.query(api.liquidations.getLiquidations, {}))[0]).toMatchObject({
		date: '2026-11-12',
		amount_lost: 200
	});
	await t.mutation(api.trades.batchCreateTrades, {
		trades: [{ ...trade, date_closed: '2026-11-13' }]
	});
	expect((await t.query(api.liquidations.getLiquidations, {}))[0].date).toBe('2026-11-13');
});
