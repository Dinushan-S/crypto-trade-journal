import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export async function syncTradeLiquidation(ctx: MutationCtx, tradeId: Id<"trades">, marked: boolean) {
  const trade = await ctx.db.get(tradeId);
  if (!trade) throw new Error("Trade not found");
  const link = await ctx.db.query("liquidation_trades")
    .withIndex("by_user_trade", q => q.eq("userId", trade.userId).eq("trade_id", tradeId)).first();
  if (marked) {
    if (link) {
      const liquidation = await ctx.db.get(link.liquidation_id);
      if (liquidation?.auto_from_trade) {
        if (!(typeof trade.pnl === "number" && trade.pnl < 0)) {
          throw new Error("Keep a negative PnL for a liquidated trade, or clear its liquidation mark.");
        }
        await ctx.db.patch(liquidation._id, {
          amount_lost: -trade.pnl,
          date: trade.date_closed || trade.date,
          coin: trade.coin,
          position: trade.position,
          strategy: trade.strategy,
          updated_at: new Date().toISOString(),
        });
      }
    } else {
      const previous = trade.previous_liquidation_id
        ? await ctx.db.get(trade.previous_liquidation_id) : null;
      if (previous && previous.userId === trade.userId) {
        await ctx.db.insert("liquidation_trades", {
          userId: trade.userId, liquidation_id: previous._id, trade_id: tradeId,
        });
        await ctx.db.patch(tradeId, { liquidated: true, previous_liquidation_id: undefined });
        return;
      }
      if (!(typeof trade.pnl === "number" && trade.pnl < 0)) {
        throw new Error("Enter a negative PnL before marking this trade as liquidated.");
      }
      const liquidationId = await ctx.db.insert("liquidations", {
        userId: trade.userId,
        date: trade.date_closed || trade.date,
        coin: trade.coin,
        position: trade.position,
        strategy: trade.strategy,
        amount_lost: -trade.pnl,
        auto_from_trade: true,
        created_at: new Date().toISOString(),
      });
      await ctx.db.insert("liquidation_trades", {
        userId: trade.userId, liquidation_id: liquidationId, trade_id: tradeId,
      });
    }
  } else if (link) {
    await ctx.db.delete(link._id);
    const liquidation = await ctx.db.get(link.liquidation_id);
    const remaining = await ctx.db.query("liquidation_trades")
      .withIndex("by_user_liquidation", q => q.eq("userId", trade.userId).eq("liquidation_id", link.liquidation_id)).first();
    // Keep manually entered event details when a trade is unlinked.
    if (liquidation?.auto_from_trade && !remaining) await ctx.db.delete(liquidation._id);
    await ctx.db.patch(tradeId, {
      previous_liquidation_id: liquidation && !liquidation.auto_from_trade ? liquidation._id : undefined,
    });
  }
  await ctx.db.patch(tradeId, { liquidated: marked, ...(marked ? { previous_liquidation_id: undefined } : {}) });
}
