<script lang="ts">
  import { createSupabaseClient } from '$lib/supabase';
  import { user } from '$lib/stores/auth';
  import { parseTradeHistoryCSV, type TradeHistoryTrade } from '$lib/utils/binance-trade-history-parser';
  import { goto } from '$app/navigation';
  import TradeLoader from '$lib/components/TradeLoader.svelte';

  const supabase = createSupabaseClient();

  let step = $state<1 | 2 | 3>(1);
  let fileName = $state('');
  let csvText = $state('');
  let parsedTrades = $state<TradeHistoryTrade[]>([]);
  let existingOrderIds = $state<Set<string>>(new Set());
  let selected = $state<Set<number>>(new Set());
  let importing = $state(false);
  let processing = $state(false); // true while parsing CSV + checking Supabase duplicates
  let importResult = $state<{ imported: number; skipped: number } | null>(null);
  let error = $state('');
  let dragOver = $state(false);

  type TradeWithStatus = TradeHistoryTrade & { status: 'new' | 'duplicate' };
  let tradesWithStatus = $derived(
    parsedTrades.map((t) => ({
      ...t,
      status: existingOrderIds.has(t.order_id) ? 'duplicate' : 'new'
    } as TradeWithStatus))
  );

  let selectedNewTrades = $derived(
    tradesWithStatus.filter((t, i) => t.status === 'new' && selected.has(i))
  );

  function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) { error = 'Please upload a .csv file'; return; }
    fileName = file.name;
    const reader = new FileReader();
    reader.onload = async (e) => {
      csvText = e.target?.result as string;
      await processCSV();
    };
    reader.readAsText(file);
  }

  async function processCSV() {
    error = '';
    processing = true;
    try {
      const trades = parseTradeHistoryCSV(csvText);

      // Check existing order_ids
      const orderIds = trades.map(t => t.order_id);
      const { data: existing } = await supabase
        .from('trades')
        .select('order_id')
        .in('order_id', orderIds);

      existingOrderIds = new Set((existing ?? []).map((r: { order_id: string | null }) => r.order_id).filter((id): id is string => Boolean(id)));
      parsedTrades = trades;

      // Pre-select all new (non-duplicate) trades
      const newSelected = new Set<number>();
      trades.forEach((t, i) => { if (!existingOrderIds.has(t.order_id)) newSelected.add(i); });
      selected = newSelected;

      step = 2;
    } catch (e: unknown) {
      error = `Parse error: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      processing = false;
    }
  }

  function toggleSelect(i: number) {
    const s = new Set(selected);
    if (s.has(i)) s.delete(i); else s.add(i);
    selected = s;
  }

  async function confirmImport() {
    importing = true;
    error = '';
    const toImport = tradesWithStatus.filter((t, i) => selected.has(i) && t.status === 'new');

    const rows = toImport.map(t => ({
      user_id: $user?.id,
      coin: t.coin,
      position: t.position,
      date: t.date,
      time: t.time,
      date_closed: t.date_closed,
      entry_price: t.entry_price,
      exit_price: t.exit_price,
      quantity: t.quantity,
      pnl: t.pnl,
      fee: t.fee ?? null,
      win: t.win,
      loss: t.loss,
      be: t.be,
      order_id: t.order_id,
      source: 'futures_import' as const,
    }));

    const { error: err } = await supabase.from('trades').insert(rows);
    if (err) { error = err.message; importing = false; return; }

    // Log import
    await supabase.from('binance_imports').insert({
      user_id: $user?.id,
      filename: fileName,
      import_type: 'futures',
      trades_count: rows.length,
      skipped_count: tradesWithStatus.filter(t => t.status === 'duplicate').length,
    });

    importResult = {
      imported: rows.length,
      skipped: tradesWithStatus.filter(t => t.status === 'duplicate').length
    };
    step = 3;
    importing = false;
  }

  const statusColors: Record<string, string> = {
    new: 'var(--win)',
    duplicate: '#f59e0b',
  };
  const statusLabel: Record<string, string> = { new: '🟢 New', duplicate: '🟡 Duplicate' };
</script>

<svelte:head><title>Import Trades — Qulem-Trade</title></svelte:head>

<div style="padding:1.5rem;max-width:900px;">
  <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;">
    <a href="/trades" style="color:var(--text-muted);text-decoration:none;font-size:0.875rem;">← Trades</a>
    <h1 style="font-family:'JetBrains Mono',monospace;font-size:1.25rem;font-weight:600;color:var(--text-primary);">Import Trade History CSV</h1>
  </div>

  <!-- Progress bar -->
  <div style="display:flex;gap:0;margin-bottom:1.5rem;background:var(--surface);border:1px solid var(--border);border-radius:0.5rem;overflow:hidden;">
    {#each [[1,'Upload'],[2,'Preview'],[3,'Done']] as [s, label]}
      <div style="flex:1;padding:0.625rem;text-align:center;font-size:0.8rem;font-weight:{step >= (s as number) ? '600' : '400'};
        background:{step === (s as number) ? 'var(--accent)' : step > (s as number) ? 'color-mix(in srgb,var(--accent) 20%,transparent)' : 'transparent'};
        color:{step === (s as number) ? '#fff' : step > (s as number) ? 'var(--accent)' : 'var(--text-muted)'};">
        {s}. {label}
      </div>
    {/each}
  </div>

  {#if error}
    <div style="background:color-mix(in srgb,var(--loss) 15%,transparent);border:1px solid var(--loss);border-radius:0.5rem;padding:0.75rem;margin-bottom:1rem;color:var(--loss);font-size:0.875rem;">{error}</div>
  {/if}

  {#if step === 1}
    <!-- STEP 1: Upload -->
    {#if processing}
      <!-- Processing overlay: shown while CSV is parsed and Supabase duplicate check runs -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:3rem;text-align:center;">
        <TradeLoader label="Analysing trades…" />
      </div>
    {:else}
      <div
        style="background:var(--surface);border:2px dashed {dragOver ? 'var(--accent)' : 'var(--border)'};border-radius:0.75rem;padding:3rem;text-align:center;transition:border-color 0.15s;cursor:pointer;"
        ondragover={(e) => { e.preventDefault(); dragOver = true; }}
        ondragleave={() => dragOver = false}
        ondrop={(e) => { e.preventDefault(); dragOver = false; const f = e.dataTransfer?.files[0]; if (f) handleFile(f); }}
      >
        <div style="font-size:2.5rem;margin-bottom:1rem;">📂</div>
        <p style="color:var(--text-primary);font-weight:600;margin-bottom:0.5rem;">Drop your Binance Futures Trade History CSV here</p>
        <p style="color:var(--text-muted);font-size:0.875rem;margin-bottom:1.5rem;">Or click to browse · .csv files only</p>
        <input
          type="file" accept=".csv" id="csv-input" style="display:none;"
          onchange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFile(f); }}
        />
        <label for="csv-input" style="padding:0.625rem 1.5rem;background:var(--accent);color:#fff;border-radius:0.5rem;font-size:0.875rem;font-weight:500;cursor:pointer;">Browse Files</label>
      </div>
      <div style="margin-top:1rem;padding:0.75rem 1rem;background:var(--surface);border:1px solid var(--border);border-radius:0.5rem;">
        <p style="font-size:0.8rem;color:var(--text-muted);">Expected format: <span style="font-family:'JetBrains Mono',monospace;color:var(--text-primary);">Binance → Orders → Futures → Trade History → Export</span></p>
      </div>
    {/if}

  {:else if step === 2}
    <!-- STEP 2: Preview -->
    <div style="margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
      <div>
        <span style="font-size:0.875rem;color:var(--text-primary);font-weight:600;">{fileName}</span>
        <span style="margin-left:0.75rem;font-size:0.8rem;color:var(--text-muted);">{parsedTrades.length} trades parsed</span>
      </div>
      <div style="display:flex;gap:1rem;font-size:0.8rem;">
        <span style="color:var(--win);">🟢 {tradesWithStatus.filter(t => t.status === 'new').length} new</span>
        <span style="color:#f59e0b;">🟡 {tradesWithStatus.filter(t => t.status === 'duplicate').length} duplicates</span>
      </div>
    </div>

    <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;overflow:hidden;margin-bottom:1rem;">
      <div style="overflow-x:auto;max-height:400px;overflow-y:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
          <thead style="position:sticky;top:0;background:var(--bg);">
            <tr style="border-bottom:1px solid var(--border);">
              <th style="padding:0.5rem 0.75rem;text-align:left;font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;width:40px;">
                <input type="checkbox"
                  checked={tradesWithStatus.filter((_, i) => selected.has(i) && tradesWithStatus[i].status === 'new').length === tradesWithStatus.filter(t => t.status === 'new').length && tradesWithStatus.filter(t => t.status === 'new').length > 0}
                  onchange={(e) => {
                    if ((e.target as HTMLInputElement).checked) {
                      selected = new Set(tradesWithStatus.map((_, i) => i).filter(i => tradesWithStatus[i].status === 'new'));
                    } else {
                      selected = new Set();
                    }
                  }}
                />
              </th>
              {#each ['Status','Date','Coin','Side','Entry','Exit','Qty','PnL'] as col}
                <th style="padding:0.5rem 0.75rem;text-align:left;font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">{col}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each tradesWithStatus as trade, i}
              <tr style="border-bottom:1px solid var(--border);opacity:{trade.status === 'duplicate' ? 0.5 : 1};">
                <td style="padding:0.5rem 0.75rem;">
                  <input type="checkbox"
                    checked={selected.has(i)}
                    disabled={trade.status === 'duplicate'}
                    onchange={() => toggleSelect(i)}
                  />
                </td>
                <td style="padding:0.5rem 0.75rem;">
                  <span style="font-size:0.7rem;font-weight:600;color:{statusColors[trade.status]};">{statusLabel[trade.status]}</span>
                </td>
                <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;color:var(--text-muted);">{trade.date}</td>
                <td style="padding:0.5rem 0.75rem;font-weight:600;color:var(--text-primary);">{trade.coin}</td>
                <td style="padding:0.5rem 0.75rem;">
                  <span style="color:{trade.position === 'Long' ? 'var(--win)' : 'var(--loss)'};font-weight:600;">{trade.position}</span>
                </td>
                <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;">{trade.entry_price ?? '—'}</td>
                <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;">{trade.exit_price ?? '—'}</td>
                <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;">{trade.quantity ?? '—'}</td>
                <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;font-weight:600;color:{trade.pnl > 0 ? 'var(--win)' : trade.pnl < 0 ? 'var(--loss)' : 'var(--text-muted)'};">
                  {trade.pnl > 0 ? '+' : ''}{trade.pnl.toFixed(4)}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <div style="display:flex;gap:0.75rem;align-items:center;">
      <button
        onclick={confirmImport}
        disabled={importing || selectedNewTrades.length === 0}
        style="padding:0.625rem 1.5rem;background:var(--accent);color:#fff;border:none;border-radius:0.5rem;font-weight:600;font-size:0.875rem;cursor:pointer;opacity:{importing || selectedNewTrades.length === 0 ? 0.5 : 1};display:inline-flex;align-items:center;gap:0.5rem;">
        {#if importing}
          <TradeLoader />
          Importing…
        {:else}
          Import {selectedNewTrades.length} Trades
        {/if}
      </button>
      <button onclick={() => { step = 1; parsedTrades = []; fileName = ''; }} style="padding:0.625rem 1rem;border:1px solid var(--border);border-radius:0.5rem;background:transparent;color:var(--text-muted);font-size:0.875rem;cursor:pointer;">
        ← Back
      </button>
    </div>

  {:else}
    <!-- STEP 3: Done -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:3rem;text-align:center;">
      <div style="font-size:2.5rem;margin-bottom:1rem;">✅</div>
      <h2 style="font-family:'JetBrains Mono',monospace;font-size:1.1rem;color:var(--text-primary);margin-bottom:0.5rem;">Import Complete</h2>
      <p style="color:var(--text-muted);font-size:0.875rem;margin-bottom:0.5rem;">{importResult?.imported} trades imported · {importResult?.skipped} duplicates skipped</p>
      <div style="display:flex;gap:0.75rem;justify-content:center;margin-top:1.5rem;">
        <a href="/trades" style="padding:0.625rem 1.5rem;background:var(--accent);color:#fff;border-radius:0.5rem;text-decoration:none;font-size:0.875rem;font-weight:500;">View Trades</a>
        <button onclick={() => { step = 1; parsedTrades = []; importResult = null; fileName = ''; }} style="padding:0.625rem 1rem;border:1px solid var(--border);border-radius:0.5rem;background:transparent;color:var(--text-muted);font-size:0.875rem;cursor:pointer;">Import Another</button>
      </div>
    </div>
  {/if}
</div>
