import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getLiquidations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("liquidations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
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
