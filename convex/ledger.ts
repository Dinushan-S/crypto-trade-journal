import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

const round2 = (n: number) => Math.round(n * 100) / 100;

function usdReleasedOf(e: { usd_quantity?: number | null; fee?: number | null }) {
  return (e.usd_quantity ?? 0) - (e.fee ?? 0.07);
}

function expectedFiatOf(e: { usd_quantity?: number | null; fee?: number | null; usd_rate?: number | null; fiat_amount?: number | null }) {
  return e.fiat_amount ?? usdReleasedOf(e) * (e.usd_rate ?? 0);
}

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

export const getLedgerWithTracking = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const entries = await ctx.db
      .query("ledger")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(1000);

    const [locks, allocations] = await Promise.all([
      ctx.db.query("ledger_locks").withIndex("by_user", (q) => q.eq("userId", userId)).take(10000),
      ctx.db.query("ledger_allocations").withIndex("by_user", (q) => q.eq("userId", userId)).take(10000),
    ]);

    const lockByDeposit = new Map(locks.map((l) => [l.depositId, l]));
    const allocByWithdrawal = new Map<string, typeof allocations>();
    const allocByDeposit = new Map<string, typeof allocations>();
    for (const a of allocations) {
      if (!allocByWithdrawal.has(a.withdrawalId)) allocByWithdrawal.set(a.withdrawalId, []);
      allocByWithdrawal.get(a.withdrawalId)!.push(a);
      if (!allocByDeposit.has(a.depositId)) allocByDeposit.set(a.depositId, []);
      allocByDeposit.get(a.depositId)!.push(a);
    }

    return entries.map((e) => {
      const isDeposit = e.type === 'deposit';
      const lock = isDeposit ? lockByDeposit.get(e._id) : undefined;
      const releasedUsd = isDeposit
        ? round2((allocByDeposit.get(e._id) ?? []).reduce((s, a) => s + a.releasedUsd, 0))
        : 0;
      const releasedLkr = isDeposit
        ? round2((allocByDeposit.get(e._id) ?? []).reduce((s, a) => s + a.releasedLkr, 0))
        : 0;
      const lockedUsd = lock?.lockedUsd ?? null;
      const lockedLkr = lock?.lockedLkr ?? null;
      const remainingUsd = lockedUsd != null ? round2(Math.max(0, lockedUsd - releasedUsd)) : null;
      const remainingLkr = lockedLkr != null ? round2(Math.max(0, lockedLkr - releasedLkr)) : null;
      const fullyWithdrawn = lockedUsd != null && remainingUsd === 0 && releasedUsd > 0;

      const wdAllocs = allocByWithdrawal.get(e._id) ?? [];
      const balanceUsd = isDeposit ? null : round2(Math.max(0, usdReleasedOf(e) - wdAllocs.reduce((s, a) => s + a.releasedUsd, 0)));

      return {
        ...e,
        tracking: isDeposit
          ? { lockedUsd, lockedLkr, releasedUsd, releasedLkr, remainingUsd, remainingLkr, fullyWithdrawn }
          : { balanceUsd },
      };
    });
  },
});

export const createLedgerLock = mutation({
  args: {
    depositId: v.id("ledger"),
    lockedUsd: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const deposit = await ctx.db.get(args.depositId);
    if (!deposit || deposit.userId !== userId || deposit.type !== 'deposit') throw new Error("Not found");
    const maxLock = deposit.usd_received ?? 0;
    const lockedUsd = round2(Math.min(Math.max(0, args.lockedUsd), maxLock));
    const lockedLkr = round2(lockedUsd * (deposit.usd_rate ?? 0));

    const existing = await ctx.db
      .query("ledger_locks")
      .withIndex("by_user_deposit", (q) => q.eq("userId", userId).eq("depositId", args.depositId))
      .first();
    if (existing) {
      const releasedUsd = (await ctx.db.query("ledger_allocations").withIndex("by_user_deposit", (q) => q.eq("userId", userId).eq("depositId", args.depositId)).collect())
        .reduce((s, a) => s + a.releasedUsd, 0);
      const finalUsd = round2(Math.max(lockedUsd, releasedUsd));
      const finalLkr = round2(finalUsd * (deposit.usd_rate ?? 0));
      await ctx.db.patch(existing._id, { lockedUsd: finalUsd, lockedLkr: finalLkr });
      return existing._id;
    }
    return await ctx.db.insert("ledger_locks", { userId, depositId: args.depositId, lockedUsd, lockedLkr });
  },
});

export const allocateRelease = mutation({
  args: {
    withdrawalId: v.id("ledger"),
    allocations: v.array(
      v.object({ depositId: v.id("ledger"), releasedUsd: v.number() })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    await applyAllocations(ctx, userId, args.withdrawalId, args.allocations);
  },
});

async function applyAllocations(
  ctx: MutationCtx,
  userId: string,
  withdrawalId: Id<"ledger">,
  allocations: { depositId: Id<"ledger">; releasedUsd: number }[]
) {
  const withdrawal = await ctx.db.get(withdrawalId);
  if (!withdrawal || withdrawal.userId !== userId || withdrawal.type !== 'withdrawal') throw new Error("Not found");
  const available = usdReleasedOf(withdrawal);
  const desiredSum = allocations.reduce((s, a) => s + a.releasedUsd, 0);
  if (desiredSum > available + 1e-9) throw new Error("Allocation exceeds withdrawal released USD");

  // Reset: delete existing allocations for this withdrawal, then re-create.
  const existingAllocs = await ctx.db.query("ledger_allocations").withIndex("by_user_withdrawal", (q) => q.eq("userId", userId).eq("withdrawalId", withdrawalId)).collect();
  for (const a of existingAllocs) await ctx.db.delete(a._id);

  const totalLkr = expectedFiatOf(withdrawal);

  // Cap each allocation at the deposit's remaining; excess stays on the withdrawal's Balance.
  const capped: { depositId: Id<"ledger">; releasedUsd: number }[] = [];
  for (const a of allocations) {
    const dep = await ctx.db.get(a.depositId);
    if (!dep || dep.userId !== userId || dep.type !== 'deposit') throw new Error("Not found");
    const lock = await ctx.db.query("ledger_locks").withIndex("by_user_deposit", (q) => q.eq("userId", userId).eq("depositId", a.depositId)).first();
    if (!lock) throw new Error("Deposit is not locked");
    const releasedSoFar = (await ctx.db.query("ledger_allocations").withIndex("by_user_deposit", (q) => q.eq("userId", userId).eq("depositId", a.depositId)).collect())
      .reduce((s, x) => s + x.releasedUsd, 0);
    const remaining = lock.lockedUsd - releasedSoFar;
    capped.push({ depositId: a.depositId, releasedUsd: round2(Math.min(Math.max(0, a.releasedUsd), remaining)) });
  }

  // Create new allocations, splitting LKR proportionally.
  const totalUsd = capped.reduce((s, a) => s + a.releasedUsd, 0) || 1;
  let allocatedLkr = 0;
  for (let i = 0; i < capped.length; i++) {
    const a = capped[i];
    const isLast = i === capped.length - 1;
    let releasedLkr = round2((a.releasedUsd / totalUsd) * totalLkr);
    if (isLast) releasedLkr = round2(totalLkr - allocatedLkr);
    allocatedLkr += releasedLkr;
    await ctx.db.insert("ledger_allocations", {
      userId, withdrawalId, depositId: a.depositId,
      releasedUsd: a.releasedUsd, releasedLkr,
    });
  }
}

export const rebalanceAllocations = mutation({
  args: {
    withdrawalId: v.id("ledger"),
    allocations: v.array(
      v.object({ depositId: v.id("ledger"), releasedUsd: v.number() })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    await applyAllocations(ctx, userId, args.withdrawalId, args.allocations);
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

export const getWithdrawalAllocations = query({
  args: { withdrawalId: v.id("ledger") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const withdrawal = await ctx.db.get(args.withdrawalId);
    if (!withdrawal || withdrawal.userId !== userId || withdrawal.type !== 'withdrawal') return [];
    return await ctx.db
      .query("ledger_allocations")
      .withIndex("by_user_withdrawal", (q) => q.eq("userId", userId).eq("withdrawalId", args.withdrawalId))
      .take(1000);
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

    // If the entry type changes, drop tracking records (lock/allocations are type-scoped).
    if (updates.type && updates.type !== existing.type) {
      const locks = await ctx.db.query("ledger_locks").withIndex("by_user_deposit", (q) => q.eq("userId", userId).eq("depositId", args.id)).collect();
      for (const l of locks) await ctx.db.delete(l._id);
      const allocs = await ctx.db.query("ledger_allocations").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
      for (const a of allocs) {
        if (a.depositId === args.id || a.withdrawalId === args.id) await ctx.db.delete(a._id);
      }
    }

    // Deposit shrunk below lock → clamp lock (but never below already-released).
    if (existing.type === 'deposit' && updates.usd_received != null) {
      const lock = await ctx.db.query("ledger_locks").withIndex("by_user_deposit", (q) => q.eq("userId", userId).eq("depositId", args.id)).first();
      if (lock) {
        const released = (await ctx.db.query("ledger_allocations").withIndex("by_user_deposit", (q) => q.eq("userId", userId).eq("depositId", args.id)).collect())
          .reduce((s, a) => s + a.releasedUsd, 0);
        const maxLock = updates.usd_received ?? 0;
        const newUsd = round2(Math.max(released, Math.min(lock.lockedUsd, maxLock)));
        await ctx.db.patch(lock._id, { lockedUsd: newUsd, lockedLkr: round2(newUsd * (existing.usd_rate ?? 0)) });
      }
    }

    // Withdrawal quantity/fee changed → scale existing allocations proportionally (LKR scales with USD; rate change re-splits).
    if (existing.type === 'withdrawal' && (updates.usd_quantity != null || updates.fee != null || updates.usd_rate != null)) {
      const allocs = await ctx.db.query("ledger_allocations").withIndex("by_user_withdrawal", (q) => q.eq("userId", userId).eq("withdrawalId", args.id)).collect();
      if (allocs.length > 0) {
        const oldReleased = usdReleasedOf(existing);
        const newEntry = { ...existing, ...updates };
        const newReleased = usdReleasedOf(newEntry);
        const scale = oldReleased > 0 ? newReleased / oldReleased : 0;
        let allocatedLkr = 0;
        for (let i = 0; i < allocs.length; i++) {
          const a = allocs[i];
          const isLast = i === allocs.length - 1;
          const newUsd = round2(a.releasedUsd * scale);
          // LKR stays proportional to the withdrawal's total LKR (fiat_amount or expected), not per-row rate.
          const newLkr = isLast
            ? round2(expectedFiatOf(newEntry) - allocatedLkr)
            : round2((newUsd / newReleased) * expectedFiatOf(newEntry));
          allocatedLkr += newLkr;
          await ctx.db.patch(a._id, { releasedUsd: newUsd, releasedLkr: newLkr });
        }
      }
    }

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

    if (existing.type === 'deposit') {
      const allocs = await ctx.db.query("ledger_allocations").withIndex("by_user_deposit", (q) => q.eq("userId", userId).eq("depositId", args.id)).collect();
      if (allocs.length > 0) throw new Error("Cannot delete a deposit with release history");
      const lock = await ctx.db.query("ledger_locks").withIndex("by_user_deposit", (q) => q.eq("userId", userId).eq("depositId", args.id)).first();
      if (lock) await ctx.db.delete(lock._id);
    } else if (existing.type === 'withdrawal') {
      const allocs = await ctx.db.query("ledger_allocations").withIndex("by_user_withdrawal", (q) => q.eq("userId", userId).eq("withdrawalId", args.id)).collect();
      for (const a of allocs) await ctx.db.delete(a._id);
    }

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
