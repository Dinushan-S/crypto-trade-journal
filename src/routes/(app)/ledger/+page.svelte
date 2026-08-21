<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { enhance } from '$app/forms';
  import { formatDate, periodRange, type Period } from '$lib/utils';

  let { data, form } = $props();
  let activeTab = $state<'all' | 'deposits' | 'withdrawals'>('all');

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

  // Date filtering (client-side — the whole ledger is already loaded)
  let period = $state<Period>('custom');
  let dateFrom = $state('');
  let dateTo = $state('');
  function setPeriod(p: Period) {
    period = p;
    if (p === 'custom') return;
    ({ from: dateFrom, to: dateTo } = periodRange(p));
  }

  let entries = $derived(
    data.entries.filter(
      (e: LedgerEntry) =>
        (!dateFrom || e.date >= dateFrom) && (!dateTo || e.date <= dateTo)
    )
  );

  let deposits = $derived(entries.filter((e: LedgerEntry) => e.type === 'deposit'));
  let withdrawals = $derived(entries.filter((e: LedgerEntry) => e.type === 'withdrawal'));

  let visibleEntries = $derived(
    activeTab === 'deposits' ? deposits :
    activeTab === 'withdrawals' ? withdrawals :
    entries
  );

  // P&L Summary stats
  let totalLkrIn = $derived(deposits.reduce((s: number, e: LedgerEntry) => s + (e.fiat_sent ?? 0), 0));
  let totalLkrOut = $derived(withdrawals.reduce((s: number, e: LedgerEntry) => s + (e.fiat_amount ?? expectedFiat(e)), 0));
  let totalUsdDeposited = $derived(deposits.reduce((s: number, e: LedgerEntry) => s + (e.usd_received ?? 0), 0));
  let totalUsdWithdrawn = $derived(withdrawals.reduce((s: number, e: LedgerEntry) => s + (usdReleased(e)), 0));
  let netUsd = $derived(totalUsdDeposited - totalUsdWithdrawn);
  let netLkr = $derived(totalLkrIn - totalLkrOut);

  // Lock tracking UI state
  let lockInputs = $state<Record<string, string>>({});
  let releaseOpen = $state<string | null>(null);
  let releaseInputs = $state<Record<string, Record<string, string>>>({});

  $effect(() => {
    if (form?.error) {
      alert(form.error);
    }
  });

  const inlineForm = () => async ({ update }: any) => {
    await update();
    await invalidateAll();
  };
</script>

<svelte:head><title>Ledger — Qulem-Trade</title></svelte:head>

<div style="padding:1.5rem;max-width:100%;">
  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:0.75rem;">
    <div>
      <h1 style="font-family:'JetBrains Mono',monospace;font-size:1.25rem;font-weight:600;color:var(--text-primary);">P2P Ledger</h1>
      <p style="color:var(--text-muted);font-size:0.875rem;margin-top:0.125rem;">{entries.length} entries</p>
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

  <!-- Date filter -->
  <div style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin-bottom:1rem;">
    {#each [['day','Today'],['week','This Week'],['month','This Month'],['custom','Custom']] as [p, label]}
      <button
        onclick={() => setPeriod(p as Period)}
        style="padding:0.375rem 0.625rem;border:1px solid {period === p ? 'var(--accent)' : 'var(--border)'};border-radius:0.375rem;background:{period === p ? 'color-mix(in srgb,var(--accent) 12%,transparent)' : 'var(--bg)'};color:{period === p ? 'var(--accent)' : 'var(--text-muted)'};font-size:0.8rem;cursor:pointer;"
      >{label}</button>
    {/each}
    <input type="date" bind:value={dateFrom} oninput={() => (period = 'custom')}
      style="padding:0.375rem 0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:0.375rem;color:var(--text-primary);font-size:0.8rem;" />
    <span style="color:var(--text-muted);font-size:0.8rem;">→</span>
    <input type="date" bind:value={dateTo} oninput={() => (period = 'custom')}
      style="padding:0.375rem 0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:0.375rem;color:var(--text-primary);font-size:0.8rem;" />
    {#if dateFrom || dateTo}
      <button onclick={() => { dateFrom = ''; dateTo = ''; period = 'custom'; }}
        style="padding:0.375rem 0.625rem;border:none;background:transparent;color:var(--text-muted);font-size:0.8rem;cursor:pointer;text-decoration:underline;">Clear</button>
    {/if}
  </div>

  <!-- P&L Summary -->
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0.75rem;margin-bottom:1.5rem;">
    {#each ([
      ['Total LKR In', `LKR ${totalLkrIn.toLocaleString('en-US', {maximumFractionDigits:0})}`, 'var(--loss)'],
      ['Total LKR Out', `LKR ${totalLkrOut.toLocaleString('en-US', {maximumFractionDigits:0})}`, 'var(--win)'],
      ['Net LKR Contribution', `LKR ${netLkr.toLocaleString('en-US', {maximumFractionDigits:0})}`, netLkr >= 0 ? 'var(--win)' : 'var(--loss)'],
      ['Total USD Deposited', `$${totalUsdDeposited.toFixed(2)}`, 'var(--loss)'],
      ['Total USD Withdrawn', `$${totalUsdWithdrawn.toFixed(2)}`, 'var(--win)'],
      ['Net USD Position', `$${netUsd.toFixed(2)}`, netUsd >= 0 ? 'var(--win)' : 'var(--loss)'],
    ] satisfies [string, string, string][]) as item}
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1rem;">
        <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">{item[0]}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:1.1rem;font-weight:700;color:{item[2]};">{item[1]}</div>
      </div>
    {/each}
  </div>

  <!-- Tabs -->
  <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:1rem;">
    {#each [['all','All'], ['deposits','Deposits'], ['withdrawals','Withdrawals']] as [tab, label]}
      <button
        onclick={() => activeTab = tab as 'all' | 'deposits' | 'withdrawals'}
        style="padding:0.625rem 1rem;border:none;background:transparent;font-size:0.875rem;font-weight:{activeTab === tab ? '600' : '400'};
          color:{activeTab === tab ? 'var(--accent)' : 'var(--text-muted)'};
          border-bottom:{activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent'};
          margin-bottom:-2px;cursor:pointer;transition:all 0.15s;">
        {label}
      </button>
    {/each}
  </div>

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
                  {#each ['Date','My Bank','Recipient','LKR Sent','Bank Fee','Total LKR','USD Received','Rate','Eff. Rate','Source','Lock','Released','Remaining','Status','Notes',''] as col}
                    <th style="padding:0.5rem 0.75rem;text-align:left;font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;">{col}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each (activeTab === 'all' ? deposits : visibleEntries) as e}
                  {@const tr = e.tracking}
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
                    <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;font-weight:600;color:var(--text-primary);white-space:nowrap;">
                      {#if tr?.lockedUsd != null}
                        ${tr.lockedUsd.toFixed(2)}
                        {#if tr.lockedLkr != null}<span style="color:var(--text-muted);font-size:0.7rem;"> · LKR {tr.lockedLkr.toLocaleString('en-US', {maximumFractionDigits:0})}</span>{/if}
                      {:else}
                        <form method="POST" action="?/lock" use:enhance={inlineForm}>
                          <input type="hidden" name="depositId" value={e.id} />
                          <input type="number" name="lockedUsd" min="0" step="any" placeholder="Lock $" required
                            style="width:80px;padding:0.2rem 0.375rem;background:var(--bg);border:1px solid var(--border);border-radius:0.25rem;color:var(--text-primary);font-size:0.75rem;" />
                          <button type="submit" style="display:none;"></button>
                        </form>
                      {/if}
                    </td>
                    <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;color:var(--text-primary);white-space:nowrap;">
                      {#if tr?.releasedUsd > 0}
                        ${tr.releasedUsd.toFixed(2)}
                        {#if tr.releasedLkr > 0}<span style="color:var(--text-muted);font-size:0.7rem;"> · LKR {tr.releasedLkr.toLocaleString('en-US', {maximumFractionDigits:0})}</span>{/if}
                      {:else}
                        <span style="color:var(--text-muted);">—</span>
                      {/if}
                    </td>
                    <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;font-weight:600;color:{tr?.remainingUsd === 0 ? 'var(--win)' : 'var(--text-primary)'};white-space:nowrap;">
                      {#if tr?.remainingUsd != null}
                        ${tr.remainingUsd.toFixed(2)}
                        {#if tr.remainingLkr != null}<span style="color:var(--text-muted);font-size:0.7rem;"> · LKR {tr.remainingLkr.toLocaleString('en-US', {maximumFractionDigits:0})}</span>{/if}
                      {:else}
                        <span style="color:var(--text-muted);">—</span>
                      {/if}
                    </td>
                    <td style="padding:0.5rem 0.75rem;white-space:nowrap;">
                      {#if tr?.fullyWithdrawn}
                        <span style="font-size:0.7rem;padding:0.1rem 0.375rem;border-radius:0.25rem;background:color-mix(in srgb,var(--win) 15%,transparent);color:var(--win);font-weight:700;">Fully Withdrawn ✓</span>
                      {:else if tr?.lockedUsd != null}
                        <span style="font-size:0.7rem;padding:0.1rem 0.375rem;border-radius:0.25rem;background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent);">Tracking</span>
                      {:else}
                        <span style="color:var(--text-muted);">—</span>
                      {/if}
                    </td>
                    <td style="padding:0.5rem 0.75rem;color:var(--text-muted);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{e.notes ?? '—'}</td>
                    <td style="padding:0.5rem 0.75rem;"><a href="/ledger/{e._id}" style="color:var(--accent);text-decoration:none;font-size:0.8rem;">Edit</a></td>
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
                  {#each ['Date','Sender','Receiver','USD Qty','Fee','Released USD','Rate','Expected LKR','Actual LKR','Source','Balance','Notes',''] as col}
                    <th style="padding:0.5rem 0.75rem;text-align:left;font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;">{col}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each (activeTab === 'all' ? withdrawals : visibleEntries) as e}
                  {@const tr = e.tracking}
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
                    <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;font-weight:600;color:{tr?.balanceUsd > 0 ? 'var(--loss)' : 'var(--text-muted)'};white-space:nowrap;">
                      {#if tr?.balanceUsd > 0}
                        ${tr.balanceUsd.toFixed(2)}
                      {:else}
                        <span style="color:var(--text-muted);">—</span>
                      {/if}
                    </td>
                    <td style="padding:0.5rem 0.75rem;color:var(--text-muted);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{e.notes ?? '—'}</td>
                    <td style="padding:0.5rem 0.75rem;white-space:nowrap;">
                      <a href="/ledger/{e._id}" style="color:var(--accent);text-decoration:none;font-size:0.8rem;margin-right:0.5rem;">Edit</a>
                      <button onclick={() => releaseOpen = releaseOpen === e.id ? null : e.id}
                        style="padding:0.25rem 0.5rem;border:1px solid var(--border);border-radius:0.25rem;background:transparent;color:var(--text-muted);font-size:0.75rem;cursor:pointer;">
                        {releaseOpen === e.id ? '✕' : 'Release'}
                      </button>
                    </td>
                  </tr>
                  {#if releaseOpen === e.id}
                    <tr style="border-bottom:1px solid var(--border);background:color-mix(in srgb,var(--accent) 4%,transparent);">
                      <td colspan="13" style="padding:0.75rem;">
                        <form method="POST" action="?/allocate" use:enhance={() => async ({ update }: any) => {
                          await update();
                          await invalidateAll();
                          releaseOpen = null;
                        }}>
                          <input type="hidden" name="withdrawalId" value={e.id} />
                          <div style="display:flex;flex-wrap:wrap;gap:0.75rem;align-items:center;">
                            <span style="font-size:0.8rem;color:var(--text-muted);font-weight:600;">Release into:</span>
                            {#each deposits.filter((d) => d.tracking?.remainingUsd != null && d.tracking.remainingUsd > 0) as d}
                              <label style="display:flex;align-items:center;gap:0.375rem;font-size:0.8rem;color:var(--text-primary);">
                                <span>{formatDate(d.date)} <span style="color:var(--text-muted);">(${(d.tracking?.remainingUsd ?? 0).toFixed(0)} left)</span></span>
                                <input type="number" min="0" step="any" placeholder="USD"
                                  value={releaseInputs[e.id]?.[d.id] ?? ''}
                                  oninput={(ev) => {
                                    const v = (ev.currentTarget as HTMLInputElement).value;
                                    releaseInputs[e.id] = { ...(releaseInputs[e.id] ?? {}), [d.id]: v };
                                  }}
                                  style="width:90px;padding:0.25rem 0.375rem;background:var(--bg);border:1px solid var(--border);border-radius:0.25rem;color:var(--text-primary);font-size:0.75rem;" />
                              </label>
                            {/each}
                            <input type="hidden" name="allocations"
                              value={JSON.stringify(
                                Object.entries(releaseInputs[e.id] ?? {})
                                  .filter(([, v]) => Number(v) > 0)
                                  .map(([depId, v]) => ({ depositId: depId, releasedUsd: Number(v) }))
                              )} />
                            <button type="submit" style="padding:0.375rem 0.75rem;background:var(--accent);color:#fff;border:none;border-radius:0.375rem;font-size:0.8rem;font-weight:600;cursor:pointer;">Apply</button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  {/if}
                {/each}
              </tbody>
            </table>
          {/if}
        </div>
      {/if}
    </div>
</div>
