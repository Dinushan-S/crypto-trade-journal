<script lang="ts">
  import { createSupabaseClient } from '$lib/supabase';
  import { user } from '$lib/stores/auth';
  import { parseC2CCSV, type C2CEntry } from '$lib/utils/c2c-parser';

  const supabase = createSupabaseClient();

  let step = $state<1 | 2 | 3>(1);
  let fileName = $state('');
  let parsedEntries = $state<C2CEntry[]>([]);
  let existingOrderNumbers = $state<Set<string>>(new Set());
  let selected = $state<Set<number>>(new Set());
  let importing = $state(false);
  let importResult = $state<{ imported: number; skipped: number } | null>(null);
  let error = $state('');
  let dragOver = $state(false);

  type EntryWithStatus = C2CEntry & { status: 'new' | 'duplicate' };
  let entriesWithStatus = $derived(
    parsedEntries.map(e => ({
      ...e,
      status: existingOrderNumbers.has(e.order_number) ? 'duplicate' : 'new'
    } as EntryWithStatus))
  );

  let selectedNewEntries = $derived(
    entriesWithStatus.filter((e, i) => e.status === 'new' && selected.has(i))
  );

  function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) { error = 'Please upload a .csv file'; return; }
    fileName = file.name;
    const reader = new FileReader();
    reader.onload = async (e) => { await processCSV(e.target?.result as string); };
    reader.readAsText(file);
  }

  async function processCSV(csv: string) {
    error = '';
    try {
      const entries = parseC2CCSV(csv);
      if (entries.length === 0) { error = 'No completed orders found in this CSV.'; return; }

      const orderNumbers = entries.map(e => e.order_number).filter(Boolean);
      const { data: existing } = await supabase
        .from('ledger')
        .select('order_number')
        .in('order_number', orderNumbers);

      existingOrderNumbers = new Set((existing ?? []).map((r: { order_number: string | null }) => r.order_number).filter((n): n is string => Boolean(n)));
      parsedEntries = entries;

      const newSelected = new Set<number>();
      entries.forEach((e, i) => { if (!existingOrderNumbers.has(e.order_number)) newSelected.add(i); });
      selected = newSelected;
      step = 2;
    } catch (e: unknown) {
      error = `Parse error: ${e instanceof Error ? e.message : String(e)}`;
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
    const toImport = entriesWithStatus.filter((e, i) => selected.has(i) && e.status === 'new');

    const rows = toImport.map(e => ({
      user_id: $user?.id,
      type: e.type,
      date: e.date,
      time: e.time,
      fiat_sent: e.fiat_sent,
      usd_rate: e.usd_rate,
      usd_received: e.usd_received,
      usd_quantity: e.usd_quantity,
      counterparty: e.counterparty,
      order_number: e.order_number,
      source: 'c2c_import' as const,
    }));

    const { error: err } = await supabase.from('ledger').insert(rows);
    if (err) { error = err.message; importing = false; return; }

    await supabase.from('binance_imports').insert({
      user_id: $user?.id,
      filename: fileName,
      import_type: 'c2c',
      trades_count: rows.length,
      skipped_count: entriesWithStatus.filter(e => e.status === 'duplicate').length,
    });

    importResult = {
      imported: rows.length,
      skipped: entriesWithStatus.filter(e => e.status === 'duplicate').length
    };
    step = 3;
    importing = false;
  }
</script>

<svelte:head><title>Import Ledger — Qulem-Trade</title></svelte:head>

<div style="padding:1.5rem;max-width:900px;">
  <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;">
    <a href="/ledger" style="color:var(--text-muted);text-decoration:none;font-size:0.875rem;">← Ledger</a>
    <h1 style="font-family:'JetBrains Mono',monospace;font-size:1.25rem;font-weight:600;color:var(--text-primary);">Import C2C Orders</h1>
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
    <div
      style="background:var(--surface);border:2px dashed {dragOver ? 'var(--accent)' : 'var(--border)'};border-radius:0.75rem;padding:3rem;text-align:center;transition:border-color 0.15s;cursor:pointer;"
      ondragover={(e) => { e.preventDefault(); dragOver = true; }}
      ondragleave={() => dragOver = false}
      ondrop={(e) => { e.preventDefault(); dragOver = false; const f = e.dataTransfer?.files[0]; if (f) handleFile(f); }}
    >
      <div style="font-size:2.5rem;margin-bottom:1rem;">📂</div>
      <p style="color:var(--text-primary);font-weight:600;margin-bottom:0.5rem;">Drop your Binance C2C Order History CSV here</p>
      <p style="color:var(--text-muted);font-size:0.875rem;margin-bottom:1.5rem;">Buy orders = Deposits · Sell orders = Withdrawals</p>
      <input
        type="file" accept=".csv" id="c2c-input" style="display:none;"
        onchange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFile(f); }}
      />
      <label for="c2c-input" style="padding:0.625rem 1.5rem;background:var(--accent);color:#fff;border-radius:0.5rem;font-size:0.875rem;font-weight:500;cursor:pointer;">Browse Files</label>
    </div>

  {:else if step === 2}
    <div style="margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
      <span style="font-size:0.875rem;color:var(--text-primary);font-weight:600;">{fileName}</span>
      <div style="display:flex;gap:1rem;font-size:0.8rem;">
        <span style="color:var(--win);">🟢 {entriesWithStatus.filter(e => e.status === 'new').length} new</span>
        <span style="color:#f59e0b;">🟡 {entriesWithStatus.filter(e => e.status === 'duplicate').length} duplicates</span>
      </div>
    </div>

    <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;overflow:hidden;margin-bottom:1rem;">
      <div style="overflow-x:auto;max-height:400px;overflow-y:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
          <thead style="position:sticky;top:0;background:var(--bg);">
            <tr style="border-bottom:1px solid var(--border);">
              <th style="padding:0.5rem 0.75rem;text-align:left;font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;width:40px;"></th>
              {#each ['Status','Date','Type','LKR Sent','Rate','USDT','Counterparty'] as col}
                <th style="padding:0.5rem 0.75rem;text-align:left;font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">{col}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each entriesWithStatus as entry, i}
              <tr style="border-bottom:1px solid var(--border);opacity:{entry.status === 'duplicate' ? 0.5 : 1};">
                <td style="padding:0.5rem 0.75rem;">
                  <input type="checkbox" checked={selected.has(i)} disabled={entry.status === 'duplicate'} onchange={() => toggleSelect(i)} />
                </td>
                <td style="padding:0.5rem 0.75rem;font-size:0.7rem;font-weight:600;color:{entry.status === 'new' ? 'var(--win)' : '#f59e0b'};">
                  {entry.status === 'new' ? '🟢 New' : '🟡 Dup'}
                </td>
                <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;color:var(--text-muted);">{entry.date}</td>
                <td style="padding:0.5rem 0.75rem;">
                  <span style="color:{entry.type === 'deposit' ? 'var(--win)' : 'var(--loss)'};font-weight:600;">{entry.type === 'deposit' ? '↓ Deposit' : '↑ Withdraw'}</span>
                </td>
                <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;">{entry.fiat_sent?.toFixed(2) ?? '—'}</td>
                <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;">{entry.usd_rate?.toFixed(2) ?? '—'}</td>
                <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;font-weight:600;color:var(--accent);">
                  ${(entry.usd_received ?? entry.usd_quantity ?? 0).toFixed(2)}
                </td>
                <td style="padding:0.5rem 0.75rem;color:var(--text-muted);font-size:0.75rem;">{entry.counterparty ?? '—'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <div style="display:flex;gap:0.75rem;">
      <button
        onclick={confirmImport}
        disabled={importing || selectedNewEntries.length === 0}
        style="padding:0.625rem 1.5rem;background:var(--accent);color:#fff;border:none;border-radius:0.5rem;font-weight:600;font-size:0.875rem;cursor:pointer;opacity:{importing || selectedNewEntries.length === 0 ? 0.5 : 1};">
        {importing ? 'Importing…' : `Import ${selectedNewEntries.length} Entries`}
      </button>
      <button onclick={() => { step = 1; parsedEntries = []; }} style="padding:0.625rem 1rem;border:1px solid var(--border);border-radius:0.5rem;background:transparent;color:var(--text-muted);font-size:0.875rem;cursor:pointer;">← Back</button>
    </div>

  {:else}
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:3rem;text-align:center;">
      <div style="font-size:2.5rem;margin-bottom:1rem;">✅</div>
      <h2 style="font-family:'JetBrains Mono',monospace;font-size:1.1rem;color:var(--text-primary);margin-bottom:0.5rem;">Import Complete</h2>
      <p style="color:var(--text-muted);font-size:0.875rem;">{importResult?.imported} entries imported · {importResult?.skipped} duplicates skipped</p>
      <div style="display:flex;gap:0.75rem;justify-content:center;margin-top:1.5rem;">
        <a href="/ledger" style="padding:0.625rem 1.5rem;background:var(--accent);color:#fff;border-radius:0.5rem;text-decoration:none;font-size:0.875rem;font-weight:500;">View Ledger</a>
        <button onclick={() => { step = 1; parsedEntries = []; importResult = null; }} style="padding:0.625rem 1rem;border:1px solid var(--border);border-radius:0.5rem;background:transparent;color:var(--text-muted);font-size:0.875rem;cursor:pointer;">Import Another</button>
      </div>
    </div>
  {/if}
</div>
