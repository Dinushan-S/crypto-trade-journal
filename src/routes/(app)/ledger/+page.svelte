<script lang="ts">
  import { formatDate } from '$lib/utils';

  let { data } = $props();
  let activeTab = $state<'all' | 'deposits' | 'withdrawals' | 'summary'>('all');

  type LedgerEntry = typeof data.entries[0];

  // Computed columns
  function lkrTotalSent(e: LedgerEntry) {
    return (e.fiat_sent ?? 0) + ((e.usd_fee ?? 0) * (e.usd_rate ?? 0));
  }
  function usdReleased(e: LedgerEntry) {
    return (e.usd_quantity ?? 0) - (e.fee ?? 0.07);
  }
  function expectedFiat(e: LedgerEntry) {
    return usdReleased(e) * (e.usd_rate ?? 0);
  }
  function effectiveRate(e: LedgerEntry) {
    if (!e.usd_received || !e.fiat_sent) return null;
    return e.fiat_sent / e.usd_received;
  }

  let deposits = $derived(data.entries.filter((e: LedgerEntry) => e.type === 'deposit'));
  let withdrawals = $derived(data.entries.filter((e: LedgerEntry) => e.type === 'withdrawal'));

  let visibleEntries = $derived(
    activeTab === 'deposits' ? deposits :
    activeTab === 'withdrawals' ? withdrawals :
    activeTab === 'all' ? data.entries : []
  );

  // P&L Summary stats
  let totalLkrIn = $derived(deposits.reduce((s: number, e: LedgerEntry) => s + (e.fiat_sent ?? 0), 0));
  let totalLkrOut = $derived(withdrawals.reduce((s: number, e: LedgerEntry) => s + (e.fiat_amount ?? expectedFiat(e)), 0));
  let totalUsdDeposited = $derived(deposits.reduce((s: number, e: LedgerEntry) => s + (e.usd_received ?? 0), 0));
  let totalUsdWithdrawn = $derived(withdrawals.reduce((s: number, e: LedgerEntry) => s + (usdReleased(e)), 0));
  let netUsd = $derived(totalUsdDeposited - totalUsdWithdrawn);
  let netLkr = $derived(totalLkrIn - totalLkrOut);
</script>

<svelte:head><title>Ledger — INEVITRADE</title></svelte:head>

<div style="padding:1.5rem;max-width:100%;">
  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:0.75rem;">
    <div>
      <h1 style="font-family:'JetBrains Mono',monospace;font-size:1.25rem;font-weight:600;color:var(--text-primary);">P2P Ledger</h1>
      <p style="color:var(--text-muted);font-size:0.875rem;margin-top:0.125rem;">{data.entries.length} entries</p>
    </div>
    <div style="display:flex;gap:0.5rem;">
      <a href="/ledger/import" style="padding:0.5rem 0.875rem;border:1px solid var(--border);border-radius:0.5rem;color:var(--text-muted);text-decoration:none;font-size:0.875rem;display:inline-flex;align-items:center;gap:0.375rem;">
        📥 Import C2C
      </a>
      <a href="/ledger/new" style="padding:0.5rem 0.875rem;background:var(--accent);border:none;border-radius:0.5rem;color:#fff;text-decoration:none;font-size:0.875rem;font-weight:500;">
        + Add Entry
      </a>
    </div>
  </div>

  <!-- Tabs -->
  <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:1rem;">
    {#each [['all','All'], ['deposits','Deposits'], ['withdrawals','Withdrawals'], ['summary','P&L Summary']] as [tab, label]}
      <button
        onclick={() => activeTab = tab as 'all' | 'deposits' | 'withdrawals' | 'summary'}
        style="padding:0.625rem 1rem;border:none;background:transparent;font-size:0.875rem;font-weight:{activeTab === tab ? '600' : '400'};
          color:{activeTab === tab ? 'var(--accent)' : 'var(--text-muted)'};
          border-bottom:{activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent'};
          margin-bottom:-2px;cursor:pointer;transition:all 0.15s;">
        {label}
      </button>
    {/each}
  </div>

  {#if activeTab === 'summary'}
    <!-- P&L Summary -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0.75rem;margin-bottom:1.5rem;">
      {#each ([
        ['Total LKR In', `LKR ${totalLkrIn.toLocaleString('en-US', {maximumFractionDigits:0})}`, 'var(--win)'],
        ['Total LKR Out', `LKR ${totalLkrOut.toLocaleString('en-US', {maximumFractionDigits:0})}`, 'var(--loss)'],
        ['Net LKR Contribution', `LKR ${netLkr.toLocaleString('en-US', {maximumFractionDigits:0})}`, netLkr >= 0 ? 'var(--win)' : 'var(--loss)'],
        ['Total USD Deposited', `$${totalUsdDeposited.toFixed(2)}`, 'var(--win)'],
        ['Total USD Withdrawn', `$${totalUsdWithdrawn.toFixed(2)}`, 'var(--loss)'],
        ['Net USD Position', `$${netUsd.toFixed(2)}`, netUsd >= 0 ? 'var(--win)' : 'var(--loss)'],
      ] satisfies [string, string, string][]) as item}
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1rem;">
          <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">{item[0]}</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:1.1rem;font-weight:700;color:{item[2]};">{item[1]}</div>
        </div>
      {/each}
    </div>
  {:else}
    <!-- Table -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;overflow:hidden;">
      {#if visibleEntries.length === 0}
        <div style="padding:3rem;text-align:center;color:var(--text-muted);">
          No entries yet. <a href="/ledger/import" style="color:var(--accent);text-decoration:none;">Import C2C CSV</a> or <a href="/ledger/new" style="color:var(--accent);text-decoration:none;">add manually</a>.
        </div>
      {:else}
        <div style="overflow-x:auto;">
          {#if activeTab === 'all' || activeTab === 'deposits'}
            <!-- Deposits section / all -->
            {#if activeTab === 'all' && deposits.length > 0}
              <div style="padding:0.625rem 0.75rem;background:color-mix(in srgb,var(--win) 8%,transparent);border-bottom:1px solid var(--border);font-size:0.75rem;font-weight:600;color:var(--win);">DEPOSITS</div>
            {/if}
            <table style="width:100%;border-collapse:collapse;font-size:0.8125rem;">
              <thead>
                <tr style="background:var(--bg);border-bottom:1px solid var(--border);">
                  {#each ['Date','My Bank','Recipient','LKR Sent','Bank Fee','Total LKR','USD Received','Rate','Eff. Rate','Source','Notes'] as col}
                    <th style="padding:0.5rem 0.75rem;text-align:left;font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;">{col}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each (activeTab === 'all' ? deposits : visibleEntries) as e}
                  <tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;color:var(--text-muted);white-space:nowrap;">{formatDate(e.date)}</td>
                    <td style="padding:0.5rem 0.75rem;color:var(--text-primary);">{e.my_bank ?? '—'}</td>
                    <td style="padding:0.5rem 0.75rem;color:var(--text-muted);">{e.recipient_bank ?? e.counterparty ?? '—'}</td>
                    <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;color:var(--text-primary);">{e.fiat_sent?.toLocaleString('en-US') ?? '—'}</td>
                    <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;color:var(--text-muted);">{e.usd_fee ? `$${e.usd_fee}` : '—'}</td>
                    <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;font-weight:600;color:var(--text-primary);">{lkrTotalSent(e).toLocaleString('en-US', {maximumFractionDigits:2})}</td>
                    <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;font-weight:600;color:var(--win);">${(e.usd_received ?? 0).toFixed(2)}</td>
                    <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;">{e.usd_rate?.toFixed(2) ?? '—'}</td>
                    <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;color:var(--accent);">{effectiveRate(e)?.toFixed(2) ?? '—'}</td>
                    <td style="padding:0.5rem 0.75rem;"><span style="font-size:0.7rem;padding:0.1rem 0.375rem;border-radius:0.25rem;background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent);">{e.source === 'c2c_import' ? 'Import' : 'Manual'}</span></td>
                    <td style="padding:0.5rem 0.75rem;color:var(--text-muted);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{e.notes ?? '—'}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
          {#if activeTab === 'all' || activeTab === 'withdrawals'}
            {#if activeTab === 'all' && withdrawals.length > 0}
              <div style="padding:0.625rem 0.75rem;background:color-mix(in srgb,var(--loss) 8%,transparent);border-top:1px solid var(--border);border-bottom:1px solid var(--border);font-size:0.75rem;font-weight:600;color:var(--loss);">WITHDRAWALS</div>
            {/if}
            <table style="width:100%;border-collapse:collapse;font-size:0.8125rem;">
              <thead>
                <tr style="background:var(--bg);border-bottom:1px solid var(--border);">
                  {#each ['Date','Sender','Receiver','USD Qty','Fee','Released USD','Rate','Expected LKR','Actual LKR','Source','Notes'] as col}
                    <th style="padding:0.5rem 0.75rem;text-align:left;font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;">{col}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each (activeTab === 'all' ? withdrawals : visibleEntries) as e}
                  <tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;color:var(--text-muted);white-space:nowrap;">{formatDate(e.date)}</td>
                    <td style="padding:0.5rem 0.75rem;color:var(--text-primary);">{e.sender_bank ?? e.counterparty ?? '—'}</td>
                    <td style="padding:0.5rem 0.75rem;color:var(--text-muted);">{e.receiver_bank ?? '—'}</td>
                    <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;">${(e.usd_quantity ?? 0).toFixed(2)}</td>
                    <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;color:var(--text-muted);">{e.fee ?? 0.07}</td>
                    <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;font-weight:600;color:var(--accent);">${usdReleased(e).toFixed(2)}</td>
                    <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;">{e.usd_rate?.toFixed(2) ?? '—'}</td>
                    <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;">{expectedFiat(e).toLocaleString('en-US', {maximumFractionDigits:0})}</td>
                    <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;font-weight:600;color:var(--text-primary);">{e.fiat_amount?.toLocaleString('en-US') ?? '—'}</td>
                    <td style="padding:0.5rem 0.75rem;"><span style="font-size:0.7rem;padding:0.1rem 0.375rem;border-radius:0.25rem;background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent);">{e.source === 'c2c_import' ? 'Import' : 'Manual'}</span></td>
                    <td style="padding:0.5rem 0.75rem;color:var(--text-muted);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{e.notes ?? '—'}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>
