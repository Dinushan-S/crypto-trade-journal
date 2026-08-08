import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getSessions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const getSessionByDateAndType = query({
  args: { date: v.string(), session_type: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("sessions")
      .withIndex("by_user_date_type", (q) =>
        q.eq("userId", userId).eq("date", args.date).eq("session_type", args.session_type)
      )
      .first();
  },
});

export const upsertSession = mutation({
  args: {
    date: v.string(),
    session_type: v.string(),
    status: v.optional(v.string()),
    market_bias: v.optional(v.string()),
    news_events: v.optional(v.any()),
    watchlist: v.optional(v.any()),
    live_trades: v.optional(v.any()),
    session_notes: v.optional(v.string()),
    what_seen: v.optional(v.string()),
    what_skipped: v.optional(v.string()),
    trades_count: v.optional(v.number()),
    wins: v.optional(v.number()),
    losses: v.optional(v.number()),
    net_pnl: v.optional(v.number()),
    what_right: v.optional(v.string()),
    what_wrong: v.optional(v.string()),
    tomorrow_plan: v.optional(v.string()),
    checklist: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_user_date_type", (q) =>
        q.eq("userId", userId).eq("date", args.date).eq("session_type", args.session_type)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    } else {
      return await ctx.db.insert("sessions", {
        ...args,
        userId,
        created_at: new Date().toISOString(),
      });
    }
  },
});
