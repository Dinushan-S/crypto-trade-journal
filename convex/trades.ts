import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getTrades = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("trades")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const getTradeById = query({
  args: { id: v.id("trades") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const trade = await ctx.db.get(args.id);
    if (!trade || trade.userId !== userId) return null;
    return trade;
  },
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
    fib_match_macro: v.optional(v.string()),
    limit_type: v.optional(v.string()),
    pnl: v.optional(v.number()),
    fee: v.optional(v.number()),
    win: v.optional(v.boolean()),
    loss: v.optional(v.boolean()),
    be: v.optional(v.boolean()),
    date_closed: v.optional(v.string()),
    closed_reason: v.optional(v.string()),
    duration: v.optional(v.string()),
    reason: v.optional(v.string()),
    pre_notes: v.optional(v.string()),
    post_notes: v.optional(v.string()),
    order_id: v.optional(v.string()),
    fills: v.optional(v.number()),
    source: v.optional(v.string()),
    annotated: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    return await ctx.db.insert("trades", {
      ...args,
      userId,
      created_at: new Date().toISOString(),
    });
  },
});

export const updateTrade = mutation({
  args: {
    id: v.id("trades"),
    date: v.optional(v.string()),
    time: v.optional(v.string()),
    day: v.optional(v.string()),
    coin: v.optional(v.string()),
    position: v.optional(v.string()),
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
    fib_match_macro: v.optional(v.string()),
    limit_type: v.optional(v.string()),
    pnl: v.optional(v.number()),
    fee: v.optional(v.number()),
    win: v.optional(v.boolean()),
    loss: v.optional(v.boolean()),
    be: v.optional(v.boolean()),
    date_closed: v.optional(v.string()),
    closed_reason: v.optional(v.string()),
    duration: v.optional(v.string()),
    reason: v.optional(v.string()),
    pre_notes: v.optional(v.string()),
    post_notes: v.optional(v.string()),
    annotated: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const deleteTrade = mutation({
  args: { id: v.id("trades") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
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
        fib_match_macro: v.optional(v.string()),
        limit_type: v.optional(v.string()),
        pnl: v.optional(v.number()),
        fee: v.optional(v.number()),
        win: v.optional(v.boolean()),
        loss: v.optional(v.boolean()),
        be: v.optional(v.boolean()),
        date_closed: v.optional(v.string()),
        closed_reason: v.optional(v.string()),
        duration: v.optional(v.string()),
        reason: v.optional(v.string()),
        pre_notes: v.optional(v.string()),
        post_notes: v.optional(v.string()),
        order_id: v.optional(v.string()),
        fills: v.optional(v.number()),
        source: v.optional(v.string()),
        annotated: v.optional(v.boolean()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    let inserted = 0;
    for (const trade of args.trades) {
      if (trade.order_id) {
        const existing = await ctx.db
          .query("trades")
          .withIndex("by_user_order", (q) =>
            q.eq("userId", userId).eq("order_id", trade.order_id)
          )
          .first();
        if (existing) continue;
      }
      await ctx.db.insert("trades", {
        ...trade,
        userId,
        created_at: new Date().toISOString(),
      });
      inserted++;
    }
    return inserted;
  },
});
