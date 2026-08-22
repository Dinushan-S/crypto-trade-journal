import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { type Id } from "./_generated/dataModel";

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
  args: {
    date: v.string(),
    coin: v.optional(v.string()),
    position: v.optional(v.string()),
    amount_lost: v.optional(v.number()),
    strategy: v.optional(v.string()),
    reason: v.optional(v.string()),
    notes: v.optional(v.string()),
    mistake: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    return await ctx.db.insert("liquidations", {
      ...args,
      userId,
      created_at: new Date().toISOString(),
    });
  },
});

export const createLiquidationWithTrades = mutation({
  args: {
    date: v.string(),
    coin: v.optional(v.string()),
    position: v.optional(v.string()),
    amount_lost: v.number(),
    strategy: v.optional(v.string()),
    reason: v.optional(v.string()),
    notes: v.optional(v.string()),
    mistake: v.optional(v.string()),
    tradeIds: v.array(v.id("trades")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    if (args.amount_lost <= 0) {
      throw new Error("amount_lost must be positive");
    }
    if (args.tradeIds.length === 0) {
      throw new Error("At least one trade must be linked");
    }

    // Verify all trades exist and belong to this user before writing
    const validatedTradeIds: Id<"trades">[] = [];
    for (const tradeId of args.tradeIds) {
      const trade = await ctx.db.get(tradeId);
      if (!trade || trade.userId !== userId) {
        throw new Error(`Trade ${tradeId} not found or unauthorized`);
      }
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
      ...args,
      userId,
      created_at: new Date().toISOString(),
    });

    // Insert trade links atomically
    for (const tradeId of validatedTradeIds) {
      await ctx.db.insert("liquidation_trades", {
        userId,
        liquidation_id: liquidationId,
        trade_id: tradeId,
      });
    }

    return liquidationId;
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
    for (const tradeId of args.tradeIds) {
      const trade = await ctx.db.get(tradeId);
      if (!trade || trade.userId !== userId) {
        throw new Error(`Trade ${tradeId} not found or unauthorized`);
      }
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
      await ctx.db.delete(link._id);
    }

    // Insert new links
    for (const tradeId of validatedTradeIds) {
      await ctx.db.insert("liquidation_trades", {
        userId,
        liquidation_id: args.liquidationId,
        trade_id: tradeId,
      });
    }
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
      await ctx.db.delete(link._id);
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
      await ctx.db.delete(link._id);
    }

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
    return userTrades.filter((t) => !linkedTradeIds.has(t._id));
  },
});
