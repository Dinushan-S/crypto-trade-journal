import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { type Id } from "./_generated/dataModel";
import { refreshTradeGroup } from './lib/tradeGroup';

const liquidationFields = v.object({
  date: v.string(),
  coin: v.optional(v.string()),
  position: v.optional(v.string()),
  amount_lost: v.number(),
  strategy: v.optional(v.string()),
  reason: v.optional(v.string()),
  notes: v.optional(v.string()),
  mistake: v.optional(v.string()),
});

function validateLiquidation(args: { date: string; amount_lost?: number }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new Error("A valid date is required");
  if (args.amount_lost === undefined || !Number.isFinite(args.amount_lost) || args.amount_lost <= 0) {
    throw new Error("Amount lost must be a positive number");
  }
}

export const updateLiquidation = mutation({
  args: liquidationFields.extend({ id: v.id("liquidations") }).fields,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    validateLiquidation(args);
    await ctx.db.patch(args.id, {
      date: args.date,
      coin: args.coin?.trim().toUpperCase() || undefined,
      position: args.position?.trim() || undefined,
      amount_lost: args.amount_lost,
      strategy: args.strategy?.trim() || undefined,
      reason: args.reason?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      mistake: args.mistake?.trim() || undefined,
      auto_from_trade: false,
      updated_at: new Date().toISOString(),
    });
  },
});

export const getLiquidations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("liquidations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(1000);
  },
});

export const createLiquidation = mutation({
  args: liquidationFields.fields,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    validateLiquidation(args);
    return await ctx.db.insert("liquidations", {
      ...args,
      userId,
      created_at: new Date().toISOString(),
    });
  },
});

export const createLiquidationWithTrades = mutation({
  args: liquidationFields.extend({ tradeIds: v.array(v.id("trades")) }).fields,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    validateLiquidation(args);
    const { tradeIds, ...fields } = args;
    if (tradeIds.length === 0) {
      throw new Error("At least one trade must be linked");
    }

    // Verify all trades exist and belong to this user before writing
    const validatedTradeIds: Id<"trades">[] = [];
    for (const tradeId of new Set(args.tradeIds)) {
      const trade = await ctx.db.get(tradeId);
      if (!trade || trade.userId !== userId) {
        throw new Error(`Trade ${tradeId} not found or unauthorized`);
      }
      if (trade.is_group || trade.source === 'combined_notes') throw new Error('Select individual closes from the combined trade history.');
      validatedTradeIds.push(tradeId);
    }

    // Check for duplicate links across all liquidations
    for (const tradeId of validatedTradeIds) {
      const existingLinks = await ctx.db
        .query("liquidation_trades")
        .withIndex("by_user_trade", (q) =>
          q.eq("userId", userId).eq("trade_id", tradeId)
        )
        .collect();
      if (existingLinks.length > 0) {
        throw new Error(
          `Trade ${tradeId} is already linked to a liquidation`
        );
      }
    }

    // Insert liquidation record
    const liquidationId = await ctx.db.insert("liquidations", {
      ...fields,
      userId,
      created_at: new Date().toISOString(),
    });

    // Insert trade links atomically
    for (const tradeId of validatedTradeIds) {
      await ctx.db.patch(tradeId, { liquidated: true, previous_liquidation_id: undefined });
      await ctx.db.insert("liquidation_trades", {
        userId,
        liquidation_id: liquidationId,
        trade_id: tradeId,
      });
    }

    for (const tradeId of validatedTradeIds) await refreshTradeGroup(ctx, tradeId);
    return liquidationId;
  },
});

export const getLiquidationForTrade = query({
  args: { tradeId: v.id("trades") },
  handler: async (ctx, { tradeId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const trade = await ctx.db.get(tradeId);
    if (!trade || trade.userId !== userId) return null;
    const link = await ctx.db.query("liquidation_trades")
      .withIndex("by_user_trade", q => q.eq("userId", userId).eq("trade_id", tradeId))
      .first();
    return link?.liquidation_id ?? null;
  },
});

export const getLiquidationDetail = query({
  args: { id: v.id("liquidations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const liquidation = await ctx.db.get(args.id);
    if (!liquidation || liquidation.userId !== userId) return null;

    // Fetch all linked trades
    const linkedRecords = await ctx.db
      .query("liquidation_trades")
      .withIndex("by_user_liquidation", (q) =>
        q.eq("userId", userId).eq("liquidation_id", args.id)
      )
      .collect();

    // Hydrate trade documents
    const linkedTrades = [];
    let totalPnl = 0;
    let totalFees = 0;

    for (const link of linkedRecords) {
      const trade = await ctx.db.get(link.trade_id);
      if (trade && trade.userId === userId) {
        linkedTrades.push(trade);
        totalPnl += trade.pnl ?? 0;
        totalFees += trade.fee ?? 0;
      }
    }

    return {
      liquidation,
      linkedTrades,
      aggregated: {
        count: linkedTrades.length,
        netPnL: totalPnl,
        fees: totalFees,
      },
    };
  },
});

export const updateLiquidationLinkedTrades = mutation({
  args: {
    liquidationId: v.id("liquidations"),
    tradeIds: v.array(v.id("trades")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    // Verify liquidation exists and belongs to user
    const liquidation = await ctx.db.get(args.liquidationId);
    if (!liquidation || liquidation.userId !== userId) {
      throw new Error("Liquidation not found or unauthorized");
    }

    if (args.tradeIds.length === 0) {
      throw new Error("At least one trade must be linked");
    }

    // Verify all trades exist and belong to this user
    const validatedTradeIds: Id<"trades">[] = [];
    for (const tradeId of new Set(args.tradeIds)) {
      const trade = await ctx.db.get(tradeId);
      if (!trade || trade.userId !== userId) {
        throw new Error(`Trade ${tradeId} not found or unauthorized`);
      }
      if (trade.is_group || trade.source === 'combined_notes') throw new Error('Select individual closes from the combined trade history.');
      validatedTradeIds.push(tradeId);
    }

    // Check for duplicate links (excluding current liquidation)
    for (const tradeId of validatedTradeIds) {
      const existingLinks = await ctx.db
        .query("liquidation_trades")
        .withIndex("by_user_trade", (q) =>
          q.eq("userId", userId).eq("trade_id", tradeId)
        )
        .collect();
      const differentLiquidationLink = existingLinks.find(
        (link) => link.liquidation_id !== args.liquidationId
      );
      if (differentLiquidationLink) {
        throw new Error(
          `Trade ${tradeId} is already linked to a different liquidation`
        );
      }
    }

    // Remove existing links for this liquidation
    const existingLinks = await ctx.db
      .query("liquidation_trades")
      .withIndex("by_user_liquidation", (q) =>
        q.eq("userId", userId).eq("liquidation_id", args.liquidationId)
      )
      .collect();

    for (const link of existingLinks) {
      if (await ctx.db.get(link.trade_id)) await ctx.db.patch(link.trade_id, { liquidated: false, previous_liquidation_id: args.liquidationId });
      await ctx.db.delete(link._id);
    }

    const selectionChanged = existingLinks.length !== validatedTradeIds.length ||
      existingLinks.some(link => !validatedTradeIds.includes(link.trade_id));
    if (selectionChanged) await ctx.db.patch(args.liquidationId, { auto_from_trade: false });
    // Insert new links
    for (const tradeId of validatedTradeIds) {
      await ctx.db.patch(tradeId, { liquidated: true, previous_liquidation_id: undefined });
      await ctx.db.insert("liquidation_trades", {
        userId,
        liquidation_id: args.liquidationId,
        trade_id: tradeId,
      });
    }
    for (const tradeId of new Set([...validatedTradeIds, ...existingLinks.map(l => l.trade_id)])) await refreshTradeGroup(ctx, tradeId);
  },
});

export const unlinkTradeFromLiquidation = mutation({
  args: {
    liquidationId: v.id("liquidations"),
    tradeId: v.id("trades"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    // Verify liquidation exists and belongs to user
    const liquidation = await ctx.db.get(args.liquidationId);
    if (!liquidation || liquidation.userId !== userId) {
      throw new Error("Liquidation not found or unauthorized");
    }

    // Find and delete the specific link
    const link = await ctx.db
      .query("liquidation_trades")
      .withIndex("by_user_liquidation", (q) =>
        q.eq("userId", userId).eq("liquidation_id", args.liquidationId)
      )
      .filter((q) => q.eq(q.field("trade_id"), args.tradeId))
      .first();

    if (link) {
      if (await ctx.db.get(args.tradeId)) await ctx.db.patch(args.tradeId, { liquidated: false, previous_liquidation_id: args.liquidationId });
      await ctx.db.delete(link._id);
      await refreshTradeGroup(ctx, args.tradeId);
    } else {
      throw new Error("Trade not linked to this liquidation");
    }
  },
});

export const deleteLiquidation = mutation({
  args: { id: v.id("liquidations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const liquidation = await ctx.db.get(args.id);
    if (!liquidation || liquidation.userId !== userId) {
      throw new Error("Liquidation not found or unauthorized");
    }

    // Delete all linked trade records first
    const linkedRecords = await ctx.db
      .query("liquidation_trades")
      .withIndex("by_user_liquidation", (q) =>
        q.eq("userId", userId).eq("liquidation_id", args.id)
      )
      .collect();

    for (const link of linkedRecords) {
      if (await ctx.db.get(link.trade_id)) await ctx.db.patch(link.trade_id, { liquidated: false });
      await ctx.db.delete(link._id);
    }

    for (const link of linkedRecords) await refreshTradeGroup(ctx, link.trade_id);

    // Delete the liquidation itself
    await ctx.db.delete(args.id);
  },
});

export const getAvailableTrades = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const userTrades = await ctx.db
      .query("trades")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(1000);

    const linkedRecords = await ctx.db
      .query("liquidation_trades")
      .withIndex("by_user_trade", (q) => q.eq("userId", userId))
      .collect();

    const linkedTradeIds = new Set(linkedRecords.map((l) => l.trade_id));
    return userTrades.filter((t) => !t.is_group && t.source !== 'combined_notes' && !linkedTradeIds.has(t._id));
  },
});
