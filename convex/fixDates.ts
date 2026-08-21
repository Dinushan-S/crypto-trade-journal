import { internalMutation } from "./_generated/server";

// One-off repair for dates written as "202026-08-21" by the old importer
// (it prepended "20" to already-4-digit years).
const fix = (d?: string) =>
  typeof d === "string" && /^20\d{4}-\d{2}-\d{2}$/.test(d) ? d.slice(2) : undefined;

export const stripDoubledYear = internalMutation({
  args: {},
  handler: async (ctx) => {
    let fixed = 0;
    for (const table of ["trades", "ledger", "liquidations"] as const) {
      for (const row of await ctx.db.query(table).collect()) {
        const patch: Record<string, string> = {};
        const d = fix(row.date);
        if (d) patch.date = d;
        const dc = fix((row as { date_closed?: string }).date_closed);
        if (dc) patch.date_closed = dc;
        if (Object.keys(patch).length) {
          await ctx.db.patch(row._id, patch);
          fixed++;
        }
      }
    }
    return { fixed };
  },
});
