import fs from "node:fs";
import path from "node:path";

/**
 * Migration Script: Supabase to Convex
 *
 * Usage:
 * 1. Set environment variables:
 *    - SUPABASE_URL (e.g. https://xyz.supabase.co)
 *    - SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY
 *    - CONVEX_URL (e.g. https://your-instance.convex.cloud)
 *    - MIGRATION_TARGET_USER_ID (The target Convex auth userId to attach imported data to)
 *
 * 2. Run:
 *    npx tsx scripts/export-supabase.ts
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;
const TARGET_USER_ID = process.env.MIGRATION_TARGET_USER_ID || "legacy_user";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.log("Error: SUPABASE_URL and SUPABASE_KEY must be provided via environment variables.");
  process.exit(1);
}

const TABLES = ["trades", "ledger", "liquidations", "sessions", "binance_imports", "mistakes"];

async function fetchSupabaseTable(table: string) {
  console.log(`Fetching table '${table}' from Supabase...`);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: {
      apikey: SUPABASE_KEY!,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${table}: ${res.status} ${res.statusText}`);
  }

  return await res.json();
}

async function main() {
  const outDir = path.join(process.cwd(), "export-data");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const exportSummary: Record<string, number> = {};

  for (const table of TABLES) {
    try {
      const rows = await fetchSupabaseTable(table);
      // Remap user_id to target Convex userId and clean up Supabase specific id/user_id fields
      const remappedRows = rows.map((row: any) => {
        const { id, user_id, ...rest } = row;
        return {
          ...rest,
          userId: TARGET_USER_ID,
        };
      });

      const filePath = path.join(outDir, `${table}.json`);
      fs.writeFileSync(filePath, JSON.stringify(remappedRows, null, 2));
      exportSummary[table] = remappedRows.length;
      console.log(`Exported ${remappedRows.length} rows to ${filePath}`);
    } catch (err) {
      console.error(`Error exporting table '${table}':`, err);
    }
  }

  console.log("\n--- Export Completed ---");
  console.table(exportSummary);
  console.log(`JSON dump files created in ${outDir}/`);
  console.log("You can import these into Convex using `npx convex import` or Convex dashboard.");
}

main();
