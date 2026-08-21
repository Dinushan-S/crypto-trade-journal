import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getLedger = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("ledger")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(1000);
  },
});

export const createLedgerEntry = mutation({
  args: {
    type: v.string(),
    date: v.string(),
    time: v.optional(v.string()),
    my_bank: v.optional(v.string()),
    recipient_bank: v.optional(v.string()),
    sender_bank: v.optional(v.string()),
    receiver_bank: v.optional(v.string()),
    fiat_sent: v.optional(v.number()),
    usd_fee: v.optional(v.number()),
    usd_rate: v.optional(v.number()),
    usd_received: v.optional(v.number()),
    usd_quantity: v.optional(v.number()),
    fee: v.optional(v.number()),
    fiat_amount: v.optional(v.number()),
    notes: v.optional(v.string()),
    order_number: v.optional(v.string()),
    counterparty: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    return await ctx.db.insert("ledger", {
      ...args,
      userId,
      created_at: new Date().toISOString(),
    });
  },
});

export const getLedgerEntryById = query({
  args: { id: v.id("ledger") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const entry = await ctx.db.get(args.id);
    if (!entry || entry.userId !== userId) return null;
    return entry;
  },
});

export const updateLedgerEntry = mutation({
  args: {
    id: v.id("ledger"),
    type: v.optional(v.string()),
    date: v.optional(v.string()),
    time: v.optional(v.string()),
    my_bank: v.optional(v.string()),
    recipient_bank: v.optional(v.string()),
    sender_bank: v.optional(v.string()),
    receiver_bank: v.optional(v.string()),
    fiat_sent: v.optional(v.number()),
    usd_fee: v.optional(v.number()),
    usd_rate: v.optional(v.number()),
    usd_received: v.optional(v.number()),
    usd_quantity: v.optional(v.number()),
    fee: v.optional(v.number()),
    fiat_amount: v.optional(v.number()),
    notes: v.optional(v.string()),
    order_number: v.optional(v.string()),
    counterparty: v.optional(v.string()),
    source: v.optional(v.string()),
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

export const deleteLedgerEntry = mutation({
  args: { id: v.id("ledger") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});

export const batchCreateLedger = mutation({
  args: {
    entries: v.array(
      v.object({
        type: v.string(),
        date: v.string(),
        time: v.optional(v.string()),
        my_bank: v.optional(v.string()),
        recipient_bank: v.optional(v.string()),
        sender_bank: v.optional(v.string()),
        receiver_bank: v.optional(v.string()),
        fiat_sent: v.optional(v.number()),
        usd_fee: v.optional(v.number()),
        usd_rate: v.optional(v.number()),
        usd_received: v.optional(v.number()),
        usd_quantity: v.optional(v.number()),
        fee: v.optional(v.number()),
        fiat_amount: v.optional(v.number()),
        notes: v.optional(v.string()),
        order_number: v.optional(v.string()),
        counterparty: v.optional(v.string()),
        source: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    let inserted = 0;
    for (const entry of args.entries) {
      if (entry.order_number) {
        const existing = await ctx.db
          .query("ledger")
          .withIndex("by_userId_and_order_number", (q) =>
            q.eq("userId", userId).eq("order_number", entry.order_number)
          )
          .first();
        if (existing) continue;
      }
      await ctx.db.insert("ledger", {
        ...entry,
        userId,
        created_at: new Date().toISOString(),
      });
      inserted++;
    }
    return inserted;
  },
});
