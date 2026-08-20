/**
 * One-off migration: convert the Supabase CSV export in ./data into JSONL for `npx convex import`.
 *
 * Usage:
 *   node scripts/import-supabase-csv.mjs --user <convexUserId> [--dir data] [--out .import]
 *   npx convex import --table trades --format jsonl --append .import/trades.jsonl
 *   npx convex import --table ledger --format jsonl --append .import/ledger.jsonl
 *   npx convex import --table binance_imports --format jsonl --append .import/binance_imports.jsonl
 */
import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a, i, all) =>
    a.startsWith('--') ? [[a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]] : []
  )
);

const userId = args.user;
const dir = typeof args.dir === 'string' ? args.dir : 'data';
const out = typeof args.out === 'string' ? args.out : '.import';
if (typeof userId !== 'string') {
  console.error('Usage: node scripts/import-supabase-csv.mjs --user <convexUserId> [--dir data] [--out .import]');
  process.exit(1);
}

// --- CSV -> Convex field coercion ---------------------------------------
const str = (v) => (v === '' || v == null ? undefined : String(v));
const num = (v) => {
  if (v === '' || v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const bool = (v) => (v === '' || v == null ? undefined : v === 'true' || v === 't');
const arr = (v) => {
  if (!v) return undefined;
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed.map(String) : undefined;
  } catch {
    return undefined;
  }
};
/** Postgres CSV doubles single quotes inside quoted text. */
const text = (v) => str(v)?.replace(/''/g, "'");
/** '2026-06-04 22:58:33.732241+00' -> ISO 8601 */
const ts = (v) => {
  const d = new Date(String(v ?? '').replace(' ', 'T').replace(/\+00$/, 'Z'));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

/** Drops undefined keys — Convex rejects an explicit undefined for an optional field. */
const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

function readCsv(name) {
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) {
    console.warn(`  skipped: ${file} not found`);
    return [];
  }
  const { data, errors } = Papa.parse(fs.readFileSync(file, 'utf8'), { header: true, skipEmptyLines: true });
  if (errors.length) console.warn(`  ${name}: ${errors.length} parse warning(s), first: ${errors[0].message}`);
  return data;
}

const toTrade = (r) =>
  clean({
    userId,
    date: str(r.date) ?? '',
    time: str(r.time),
    day: str(r.day),
    coin: str(r.coin) ?? '',
    position: str(r.position) ?? '',
    entry_price: num(r.entry_price),
    exit_price: num(r.exit_price),
    stop_loss: num(r.stop_loss),
    quantity: num(r.quantity),
    leverage: str(r.leverage),
    strategy: text(r.strategy),
    timeframes: arr(r.timeframes),
    confidence: num(r.confidence),
    risk_pct: num(r.risk_pct),
    range_pct: num(r.range_pct),
    fib_match_macro: str(r.fib_match_macro),
    limit_type: str(r.limit_type),
    pnl: num(r.pnl),
    fee: num(r.fee),
    win: bool(r.win),
    loss: bool(r.loss),
    be: bool(r.be),
    date_closed: str(r.date_closed),
    closed_reason: text(r.closed_reason),
    duration: str(r.duration),
    reason: text(r.reason),
    pre_notes: text(r.pre_notes),
    post_notes: text(r.post_notes),
    order_id: str(r.order_id),
    fills: num(r.fills),
    source: str(r.source),
    annotated: bool(r.annotated),
    created_at: ts(r.created_at),
  });

const toLedger = (r) =>
  clean({
    userId,
    type: str(r.type) ?? '',
    date: str(r.date) ?? '',
    time: str(r.time),
    my_bank: str(r.my_bank),
    recipient_bank: str(r.recipient_bank),
    sender_bank: str(r.sender_bank),
    receiver_bank: str(r.receiver_bank),
    fiat_sent: num(r.fiat_sent),
    usd_fee: num(r.usd_fee),
    usd_rate: num(r.usd_rate),
    usd_received: num(r.usd_received),
    usd_quantity: num(r.usd_quantity),
    fee: num(r.fee),
    fiat_amount: num(r.fiat_amount),
    notes: text(r.notes),
    order_number: str(r.order_number),
    counterparty: str(r.counterparty),
    source: str(r.source),
    created_at: ts(r.created_at),
  });

const toImport = (r) =>
  clean({
    userId,
    filename: str(r.filename),
    import_type: str(r.import_type) ?? 'unknown',
    imported_at: ts(r.imported_at),
    trades_count: num(r.trades_count),
    skipped_count: num(r.skipped_count),
    status: str(r.status),
  });

// Oldest first, so Convex _creationTime order matches chronology.
const byDate = (a, b) => `${a.date} ${a.time ?? ''}`.localeCompare(`${b.date} ${b.time ?? ''}`);

fs.mkdirSync(out, { recursive: true });
for (const [table, rows] of [
  ['trades', readCsv('trades_rows.csv').map(toTrade).sort(byDate)],
  ['ledger', readCsv('ledger_rows.csv').map(toLedger).sort(byDate)],
  ['binance_imports', readCsv('binance_imports_rows.csv').map(toImport)],
]) {
  const file = path.join(out, `${table}.jsonl`);
  fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`${table}: ${rows.length} rows -> ${file}`);
}
