import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const importBatch = internalMutation({
  args: {
    table: v.string(),
    documents: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const table = args.table as "trades" | "ledger" | "liquidations" | "sessions" | "binance_imports" | "mistakes";
    let inserted = 0;
    for (const doc of args.documents) {
      await ctx.db.insert(table, doc);
      inserted++;
    }
    return inserted;
  },
});
