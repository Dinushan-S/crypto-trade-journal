/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');
async function setup() {
  const root = convexTest(schema, modules);
  const t = root.withIdentity({ subject: 'group-owner' });
  const common = { coin: 'BTC', position: 'Long', date: '2026-10-30', source: 'futures_import' };
  const a = await t.mutation(api.trades.createTrade, { ...common, date_closed: '2026-10-31', quantity: 2, exit_price: 100, pnl: 20, fee: 1, order_id: 'BTC::1', pre_notes: 'Original note' });
  const b = await t.mutation(api.trades.createTrade, { ...common, date_closed: '2026-11-01', quantity: 3, exit_price: 110, pnl: -5, fee: 2, order_id: 'BTC::2', liquidated: true });
  const args = { ids: [a, b], primaryId: a, original_quantity: 5, date: '2026-10-30', entry_price: 90, leverage: '10x', pre_notes: 'Shared note' };
  return { t, root, a, b, args, common };
}

test('combines closes without losing original records, links or double counting totals', async () => {
  const { t, a, b, args } = await setup();
  const liquidation = await t.query(api.liquidations.getLiquidationForTrade, { tradeId: b });
  const id = await t.mutation(api.trades.combineTrades, args);
  const rows = await t.query(api.trades.getTrades, {});
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ _id: id, close_count: 2, quantity: 5, closed_quantity: 5, remaining_quantity: 0, exit_price: 106, pnl: 15, fee: 3, net_pnl: 12, status: 'Closed', win: true, date_closed: '2026-11-01', liquidated: true });
  expect(await t.query(api.trades.getTradeById, { id: a })).toMatchObject({ parent_trade_id: id, order_id: 'BTC::1', pre_notes: 'Original note' });
  expect(await t.query(api.liquidations.getLiquidationForTrade, { tradeId: b })).toBe(liquidation);
  await expect(t.mutation(api.trades.deleteTrade, { id })).rejects.toThrow('Undo Combine');
  await expect(t.mutation(api.trades.updateTrade, { id, pnl: 123 })).rejects.toThrow('individual closes');
});

test('partial positions stay open; adding another close completes the same group', async () => {
  const { t, args, common } = await setup();
  const id = await t.mutation(api.trades.combineTrades, { ...args, original_quantity: 6 });
  expect(await t.query(api.trades.getTradeById, { id })).toMatchObject({ status: 'Partially closed', remaining_quantity: 1 });
  expect((await t.query(api.trades.getTradeById, { id }))!.win).toBeUndefined();
  const c = await t.mutation(api.trades.createTrade, { ...common, date_closed: '2026-11-02', quantity: 1, pnl: 1 });
  expect(await t.mutation(api.trades.combineTrades, { ...args, ids: [id, c], primaryId: id, original_quantity: 6 })).toBe(id);
  expect(await t.query(api.trades.getTradeById, { id })).toMatchObject({ status: 'Closed', close_count: 3, remaining_quantity: 0 });
});

test('CSV updates close dates without replacing totals, shared entry or notes', async () => {
  const { t, a, args, common } = await setup();
  const id = await t.mutation(api.trades.combineTrades, args);
  const csv = { ...common, date: '2026-11-01', time: '10:00:00', time_closed: '10:00:00', date_closed: '2026-11-01', quantity: 2, exit_price: 100, pnl: 20, fee: 1, order_id: 'BTC::1' };
  expect(await t.mutation(api.trades.batchCreateTrades, { trades: [csv] })).toMatchObject({ inserted: 0, updated: 1 });
  expect(await t.query(api.trades.getTradeById, { id })).toMatchObject({ close_count: 2, pnl: 15, pre_notes: 'Shared note', date: '2026-10-30', entry_price: 90 });
  expect(await t.query(api.trades.getTradeById, { id: a })).toMatchObject({ date: '2026-10-30', time_closed: '10:00:00', parent_trade_id: id });
  expect(await t.mutation(api.trades.batchCreateTrades, { trades: [csv] })).toMatchObject({ inserted: 0, skipped: 1 });
  await expect(t.mutation(api.trades.updateTrade, { id: a, quantity: 9 })).rejects.toThrow('original quantity');
  await expect(t.mutation(api.trades.batchCreateTrades, { trades: [{ ...csv, quantity: 9 }] })).rejects.toThrow('original quantity');
});

test('rejects incompatible, stale and unauthorized selections atomically', async () => {
  const { t, root, a, b, args, common } = await setup();
  const other = await t.mutation(api.trades.createTrade, { ...common, coin: 'ETH', date_closed: '2026-11-01', quantity: 1, pnl: 2 });
  await expect(t.mutation(api.trades.combineTrades, { ...args, ids: [a, other] })).rejects.toThrow('same coin');
  await expect(t.mutation(api.trades.combineTrades, { ...args, original_quantity: 1 })).rejects.toThrow('Original quantity');
  await expect(root.withIdentity({ subject: 'another-user' }).mutation(api.trades.combineTrades, args)).rejects.toThrow('not found');
  expect(await t.query(api.trades.getTradeById, { id: a })).not.toHaveProperty('parent_trade_id');
  await t.mutation(api.trades.combineTrades, args);
  await expect(t.mutation(api.trades.combineTrades, { ...args, ids: [a, b] })).rejects.toThrow('already belongs');
});

test('Undo Combine restores rows and retains shared notes, source notes and liquidation links', async () => {
  const { t, a, b, args } = await setup();
  const id = await t.mutation(api.trades.combineTrades, args);
  await t.mutation(api.trades.undoCombine, { id });
  const rows = await t.query(api.trades.getTrades, {});
  expect(rows).toHaveLength(2);
  expect(rows.reduce((s, c) => s + (c.pnl ?? 0), 0)).toBe(15);
  expect(await t.query(api.trades.getTradeById, { id: a })).toMatchObject({ pre_notes: 'Original note' });
  expect(await t.query(api.trades.getTradeById, { id })).toMatchObject({ source: 'combined_notes', pre_notes: 'Shared note' });
  expect(await t.query(api.liquidations.getLiquidationForTrade, { tradeId: b })).toBeTruthy();
});

test('dashboard counts a single trade while attributing realized profit to each close month and day', async () => {
  const { t, args } = await setup();
  const id = await t.mutation(api.trades.combineTrades, args);
  const { load } = await import('../src/routes/(app)/+page.server');
  const result = await load({ locals: { convex: { query: t.query } }, cookies: { get: () => 'local' } } as never) as any;
  expect(result.stats).toMatchObject({ totalTrades: 1, netPnl: 15, winRate: 100 });
  expect(result.chartData.monthlyPnl).toMatchObject([{ month: '2026-10', monthly: 20 }, { month: '2026-11', monthly: -5 }]);
  expect(result.chartData.dailyStats['2026-10-31']).toMatchObject({ netPnl: 20, tradeCount: 1 });
  expect(result.chartData.dailyStats['2026-11-01'].trades[0].id).toBe(id);
});

test('legacy import close times survive entry-time edits before and after combining', async () => {
  const { t, a, b, args } = await setup();
  await t.run(async ctx => {
    await ctx.db.patch(a, { time: '10:00:00', time_closed: undefined });
    await ctx.db.patch(b, { time: '12:00:00', time_closed: undefined });
  });
  await t.mutation(api.trades.updateTrade, { id: a, time: '08:00:00' });
  expect(await t.query(api.trades.getTradeById, { id: a })).toMatchObject({ time: '08:00:00', time_closed: '10:00:00' });
  const id = await t.mutation(api.trades.combineTrades, args);
  await t.mutation(api.trades.updateTrade, { id: b, time: '07:00:00' });
  expect(await t.query(api.trades.getTradeById, { id: b })).toMatchObject({ time: '07:00:00', time_closed: '12:00:00' });
  expect(await t.query(api.trades.getTradeById, { id })).toMatchObject({ time_closed: '12:00:00' });
  await expect(t.mutation(api.trades.updateTrade, { id: b, time_closed: null })).rejects.toThrow('actual close time');
});

test('individual, combined and restored outcomes consistently use realized PnL', async () => {
  const { t, a, b, args } = await setup();
  await t.mutation(api.trades.updateTrade, { id: b, liquidated: false });
  await t.mutation(api.trades.updateTrade, { id: a, pnl: 0.5, fee: 1 });
  await t.mutation(api.trades.updateTrade, { id: b, pnl: 0.5, fee: 1 });
  const id = await t.mutation(api.trades.combineTrades, args);
  expect(await t.query(api.trades.getTradeById, { id })).toMatchObject({ pnl: 1, fee: 2, net_pnl: -1, win: true, loss: false });
  await t.mutation(api.trades.undoCombine, { id });
  expect(await t.query(api.trades.getTradeById, { id: a })).toMatchObject({ win: true, loss: false });
});

test('list reads saved summaries without child arrays; edits and liquidation links keep them current', async () => {
  const { t, a, b, args } = await setup();
  const id = await t.mutation(api.trades.combineTrades, args);
  const [row] = await t.query(api.trades.getTrades, {});
  expect(row).toMatchObject({ _id: id, pnl: 15, close_count: 2, liquidated: true });
  expect(row).not.toHaveProperty('partial_closes');
  expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ pnl: 15, last_close_id: b });
  await t.mutation(api.trades.updateTrade, { id: a, pnl: 30 });
  expect((await t.query(api.trades.getTrades, {}))[0]).toMatchObject({ pnl: 25 });
  const eventId = await t.query(api.liquidations.getLiquidationForTrade, { tradeId: b });
  await t.mutation(api.liquidations.deleteLiquidation, { id: eventId! });
  expect((await t.query(api.trades.getTrades, {}))[0]).toMatchObject({ liquidated: false });
  const liquidationId = await t.mutation(api.liquidations.createLiquidationWithTrades, { date: '2026-11-01', amount_lost: 5, tradeIds: [b] });
  expect((await t.query(api.trades.getTrades, {}))[0]).toMatchObject({ liquidated: true });
  await t.mutation(api.liquidations.unlinkTradeFromLiquidation, { liquidationId, tradeId: b });
  expect((await t.query(api.trades.getTrades, {}))[0]).toMatchObject({ liquidated: false });
});

test('close history pages do not duplicate group summaries', async () => {
  const { t, args } = await setup();
  await t.mutation(api.trades.combineTrades, args);
  const first = await t.query(api.trades.getTradeCloseEvents, { paginationOpts: { numItems: 1, cursor: null } });
  expect(first.page).toHaveLength(1);
  const second = await t.query(api.trades.getTradeCloseEvents, { paginationOpts: { numItems: 1, cursor: first.continueCursor } });
  expect(second.page).toHaveLength(1);
  expect(second.page[0]._id).not.toBe(first.page[0]._id);
  expect([...first.page, ...second.page].every(t => !t.is_group)).toBe(true);
});
