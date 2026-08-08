import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getMistakes = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("mistakes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const getMistakeById = query({
  args: { id: v.id("mistakes") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== userId) return null;
    return item;
  },
});

export const createMistake = mutation({
  args: {
    trade_id: v.optional(v.string()),
    trade_date: v.string(),
    trade_time: v.optional(v.string()),
    coin: v.optional(v.string()),
    why_took_trade: v.string(),
    mistake_details: v.string(),
    lesson_learned: v.string(),
    category: v.string(),
    severity: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    return await ctx.db.insert("mistakes", {
      ...args,
      userId,
      created_at: new Date().toISOString(),
    });
  },
});

export const updateMistake = mutation({
  args: {
    id: v.id("mistakes"),
    trade_id: v.optional(v.string()),
    trade_date: v.optional(v.string()),
    trade_time: v.optional(v.string()),
    coin: v.optional(v.string()),
    why_took_trade: v.optional(v.string()),
    mistake_details: v.optional(v.string()),
    lesson_learned: v.optional(v.string()),
    category: v.optional(v.string()),
    severity: v.optional(v.string()),
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

export const deleteMistake = mutation({
  args: { id: v.id("mistakes") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});
