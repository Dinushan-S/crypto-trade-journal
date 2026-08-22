import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  trades: defineTable({
    userId: v.string(),
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
    created_at: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_userId_and_date", ["userId", "date"])
    .index("by_userId_and_order_id", ["userId", "order_id"]),

  ledger: defineTable({
    userId: v.string(),
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
    created_at: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_userId_and_date", ["userId", "date"])
    .index("by_userId_and_order_number", ["userId", "order_number"]),

  liquidations: defineTable({
    userId: v.string(),
    date: v.string(),
    coin: v.optional(v.string()),
    position: v.optional(v.string()),
    amount_lost: v.optional(v.number()),
    strategy: v.optional(v.string()),
    reason: v.optional(v.string()),
    notes: v.optional(v.string()),
    mistake: v.optional(v.string()),
    created_at: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_userId_and_date", ["userId", "date"]),

  liquidation_trades: defineTable({
    userId: v.string(),
    liquidation_id: v.id("liquidations"),
    trade_id: v.id("trades"),
  })
    .index("by_user_liquidation", ["userId", "liquidation_id"])
    .index("by_user_trade", ["userId", "trade_id"]),

  sessions: defineTable({
    userId: v.string(),
    date: v.string(),
    session_type: v.string(),
    status: v.optional(v.string()),
    market_bias: v.optional(v.string()),
    news_events: v.optional(v.array(v.string())),
    watchlist: v.optional(v.array(v.string())),
    session_notes: v.optional(v.string()),
    trades_count: v.optional(v.number()),
    wins: v.optional(v.number()),
    losses: v.optional(v.number()),
    net_pnl: v.optional(v.number()),
    what_right: v.optional(v.string()),
    what_wrong: v.optional(v.string()),
    tomorrow_plan: v.optional(v.string()),
    created_at: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_userId_and_date_and_session_type", ["userId", "date", "session_type"]),

  mistakes: defineTable({
    userId: v.string(),
    trade_id: v.optional(v.string()),
    trade_date: v.string(),
    trade_time: v.optional(v.string()),
    coin: v.optional(v.string()),
    why_took_trade: v.string(),
    mistake_details: v.string(),
    lesson_learned: v.string(),
    category: v.string(),
    severity: v.optional(v.string()),
    created_at: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_userId_and_trade_date", ["userId", "trade_date"])
    .index("by_userId_and_category", ["userId", "category"]),

  user_settings: defineTable({
    userId: v.string(),
    my_session_start: v.optional(v.string()),
    my_session_end: v.optional(v.string()),
    view_tz: v.optional(v.string()),
    created_at: v.optional(v.string()),
    updated_at: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  ledger_locks: defineTable({
    userId: v.string(),
    depositId: v.id("ledger"),
    lockedUsd: v.number(),
    lockedLkr: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_deposit", ["userId", "depositId"]),

  ledger_allocations: defineTable({
    userId: v.string(),
    withdrawalId: v.id("ledger"),
    depositId: v.id("ledger"),
    releasedUsd: v.number(),
    releasedLkr: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_withdrawal", ["userId", "withdrawalId"])
    .index("by_user_deposit", ["userId", "depositId"]),
});
