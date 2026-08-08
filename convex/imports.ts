import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getImports = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("binance_imports")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const createImportRecord = mutation({
  args: {
    filename: v.optional(v.string()),
    import_type: v.string(),
    trades_count: v.optional(v.number()),
    skipped_count: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    return await ctx.db.insert("binance_imports", {
      ...args,
      userId,
      imported_at: new Date().toISOString(),
    });
  },
});
