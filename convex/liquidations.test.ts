/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const makeTest = () => convexTest(schema, modules).withIdentity({ subject: "user-123" });
const trade = { coin: "BTC", position: "Long", date: "2026-11-10", time: "08:21:37", pnl: -100.25 };

test("create with trades omits the link IDs from the document and deduplicates links", async () => {
  const t = makeTest();
  const tradeId = await t.mutation(api.trades.createTrade, trade);
  const id = await t.mutation(api.liquidations.createLiquidationWithTrades, {
    date: trade.date, amount_lost: 100.25, tradeIds: [tradeId, tradeId],
  });
  const detail = await t.query(api.liquidations.getLiquidationDetail, { id });
  expect(detail!.liquidation).not.toHaveProperty("tradeIds");
  expect(detail!.linkedTrades).toHaveLength(1);
  expect(detail!.aggregated.netPnL).toBe(-100.25);
});

test("edit changes liquidation details, clears notes, and preserves linked trade times", async () => {
  const t = makeTest();
  const tradeId = await t.mutation(api.trades.createTrade, trade);
  const id = await t.mutation(api.liquidations.createLiquidationWithTrades, {
    date: trade.date, amount_lost: 100.25, tradeIds: [tradeId], notes: "Old note",
  });
  const before = await t.query(api.liquidations.getLiquidationDetail, { id });
  await t.mutation(api.liquidations.updateLiquidation, {
    id, date: trade.date, amount_lost: 101.75, coin: " btc ", reason: "No stop loss", notes: "",
  });
  const after = await t.query(api.liquidations.getLiquidationDetail, { id });
  expect(after!.liquidation).toMatchObject({ amount_lost: 101.75, coin: "BTC", reason: "No stop loss", created_at: before!.liquidation.created_at });
  expect(after!.liquidation.notes).toBeUndefined();
  expect(after!.liquidation.updated_at).toBeDefined();
  expect(after!.linkedTrades).toEqual(before!.linkedTrades);
});

test("rejects invalid amounts and another user's edits", async () => {
  const root = convexTest(schema, modules);
  const t = root.withIdentity({ subject: "user-123" });
  for (const amount_lost of [0, -1, NaN, Infinity]) {
    await expect(t.mutation(api.liquidations.createLiquidation, { date: trade.date, amount_lost })).rejects.toThrow();
  }
  const id = await t.mutation(api.liquidations.createLiquidation, { date: trade.date, amount_lost: 20 });
  const other = root.withIdentity({ subject: "other-user" });
  await expect(other.mutation(api.liquidations.updateLiquidation, { id, date: trade.date, amount_lost: 1 })).rejects.toThrow();
  expect((await t.query(api.liquidations.getLiquidationDetail, { id }))!.liquidation.amount_lost).toBe(20);
});

test("link changes keep existing selections and prevent linking a trade twice", async () => {
  const t = makeTest();
  const first = await t.mutation(api.trades.createTrade, trade);
  const second = await t.mutation(api.trades.createTrade, trade);
  const id = await t.mutation(api.liquidations.createLiquidationWithTrades, { date: trade.date, amount_lost: 100.25, tradeIds: [first] });
  await t.mutation(api.liquidations.updateLiquidationLinkedTrades, { liquidationId: id, tradeIds: [first, second, second] });
  expect((await t.query(api.liquidations.getLiquidationDetail, { id }))!.linkedTrades).toHaveLength(2);
  await expect(t.mutation(api.liquidations.createLiquidationWithTrades, { date: trade.date, amount_lost: 100.25, tradeIds: [second] })).rejects.toThrow();
  await t.mutation(api.liquidations.unlinkTradeFromLiquidation, { liquidationId: id, tradeId: second });
  expect((await t.query(api.liquidations.getLiquidationDetail, { id }))!.linkedTrades).toHaveLength(1);
});


test("saving links keeps retained and newly selected trades marked and clears removed trades", async () => {
  const t = makeTest();
  const first = await t.mutation(api.trades.createTrade, trade);
  const second = await t.mutation(api.trades.createTrade, trade);
  const third = await t.mutation(api.trades.createTrade, trade);
  const id = await t.mutation(api.liquidations.createLiquidationWithTrades, { date: trade.date, amount_lost: 100.25, tradeIds: [first, second] });
  await t.mutation(api.liquidations.updateLiquidationLinkedTrades, { liquidationId: id, tradeIds: [first, third] });
  for (const tradeId of [first, third]) expect((await t.query(api.trades.getTradeById, { id: tradeId }))!.liquidated).toBe(true);
  expect((await t.query(api.trades.getTradeById, { id: second }))!.liquidated).toBe(false);
  await t.mutation(api.liquidations.updateLiquidationLinkedTrades, { liquidationId: id, tradeIds: [first, third] });
  expect((await t.query(api.trades.getTradeById, { id: first }))!.liquidated).toBe(true);
});

test("toggling a manual liquidation restores its original event without increasing losses", async () => {
  const t = makeTest();
  const tradeId = await t.mutation(api.trades.createTrade, trade);
  const id = await t.mutation(api.liquidations.createLiquidationWithTrades, { date: trade.date, amount_lost: 150, notes: "Keep manual details", tradeIds: [tradeId] });
  for (let i = 0; i < 2; i++) {
    await t.mutation(api.trades.updateTrade, { id: tradeId, liquidated: false });
    await t.mutation(api.trades.updateTrade, { id: tradeId, liquidated: true });
  }
  const events = await t.query(api.liquidations.getLiquidations, {});
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ _id: id, amount_lost: 150, notes: "Keep manual details" });
  expect(await t.query(api.liquidations.getLiquidationForTrade, { tradeId })).toBe(id);
});

test("automatic event metadata follows trade edits while manual event details remain unchanged", async () => {
  const t = makeTest();
  const tradeId = await t.mutation(api.trades.createTrade, { ...trade, liquidated: true });
  const id = (await t.query(api.liquidations.getLiquidationForTrade, { tradeId }))!;
  await t.mutation(api.liquidations.updateLiquidationLinkedTrades, { liquidationId: id, tradeIds: [tradeId] });
  await t.mutation(api.trades.updateTrade, { id: tradeId, date_closed: "2026-11-12", coin: "ETH", strategy: "Retest", pnl: -120 });
  expect((await t.query(api.liquidations.getLiquidationDetail, { id }))!.liquidation).toMatchObject({ date: "2026-11-12", coin: "ETH", strategy: "Retest", amount_lost: 120 });
  await expect(t.mutation(api.trades.updateTrade, { id: tradeId, pnl: null })).rejects.toThrow("negative PnL");
  expect((await t.query(api.trades.getTradeById, { id: tradeId }))!.pnl).toBe(-120);
  await t.mutation(api.liquidations.updateLiquidation, { id, date: "2026-11-09", amount_lost: 200, coin: "BTC", notes: "Manual override" });
  await t.mutation(api.trades.updateTrade, { id: tradeId, date_closed: "2026-11-13", coin: "SOL", pnl: -130 });
  expect((await t.query(api.liquidations.getLiquidationDetail, { id }))!.liquidation).toMatchObject({ date: "2026-11-09", coin: "BTC", amount_lost: 200, notes: "Manual override" });
});
