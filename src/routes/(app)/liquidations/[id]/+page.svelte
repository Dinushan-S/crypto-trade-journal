<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { formatCurrency, formatDate } from '$lib/utils';

  let { data }: { data: { detail: any; error?: string } } = $props();
  let { detail } = data;

  const liquidation = detail.liquidation;
  let linkedTrades = detail.linkedTrades || [];
  let aggregated = detail.aggregated || { count: 0, netPnL: 0, fees: 0 };
  let formError = $state(detail.error ?? '');

  function pnlColor(pnl: number | null | undefined): string {
    if (pnl == null) return 'var(--text-muted)';
    if (pnl > 0) return 'var(--win)';
    if (pnl < 0) return 'var(--loss)';
    return 'var(--text-muted)';
  }

  const inputStyle = `padding:0.5rem 0.75rem;background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;color:var(--text-primary);font-size:0.875rem;width:100%;box-sizing:border-box;outline:none;`;
  const labelStyle = `display:block;font-size:0.7rem;font-weight:600;color:var(--text-muted);margin-bottom:0.25rem;text-transform:uppercase;letter-spacing:0.05em;`;

  // Delete confirmation dialog
  let showDeleteDialog = $state(false);
  let deleting = $state(false);

  async function handleDelete() {
    showDeleteDialog = false;
    deleting = true;
    formError = '';
    const form = new FormData();
    form.set('id', liquidation._id);
    const res = await fetch(`/liquidations/${liquidation._id}`, {
      method: 'POST',
      body: form,
    });
    deleting = false;
    if (res.ok) goto('/liquidations');
    else {
      const json = await res.json().catch(() => ({ error: 'Delete failed' }));
      formError = json.error || 'Failed to delete liquidation';
    }
  }

  // Trade picker modal state
  let showModal = $state(false);
  let loadingTrades = $state(false);
  let allUserTrades: any[] = [];
  let modalCoinFilter = $state('');
  let modalResultFilter = $state('all');
  let modalSearchPage = $state(1);
  const MODAL_PAGE_SIZE = 30;

  // Selection within modal
  let selectedModalIds = $state(new Set<string>());

  // Filtered trades from modal
  const filteredTrades = $derived(
    allUserTrades.filter((t: any) => {
      if (modalCoinFilter && !(t.coin ?? '').toLowerCase().includes(modalCoinFilter.toLowerCase())) return false;
      if (modalResultFilter === 'win' && !t.win) return false;
      if (modalResultFilter === 'loss' && !t.loss) return false;
      if (modalResultFilter === 'be' && !t.be) return false;
      return true;
    })
  );

  const totalFilteredPages = $derived(Math.max(1, Math.ceil(filteredTrades.length / MODAL_PAGE_SIZE)));

  const pagedTrades = $derived(
    filteredTrades.slice((modalSearchPage - 1) * MODAL_PAGE_SIZE, modalSearchPage * MODAL_PAGE_SIZE)
  );

  const alreadyLinkedIds = new Set(linkedTrades.map((t: any) => t._id));

  const allModalSelected = $derived(
    pagedTrades.length > 0 && pagedTrades.every((t: any) => selectedModalIds.has(t._id))
  );

  function getAvailableTrades(): any[] {
    return allUserTrades.filter((t: any) => !alreadyLinkedIds.has(t._id));
  }

  async function openModal() {
    showModal = true;
    formError = '';
    loadingTrades = true;
    try {
      allUserTrades = await window.__convex__.query(api.trades.getTrades, {}).catch(() => []);
    } catch {
      allUserTrades = [];
    } finally {
      loadingTrades = false;
    }
    // Pre-select already-linked trades (shown as disabled)
    selectedModalIds.clear();
    for (const trade of linkedTrades) {
      selectedModalIds.add(trade._id);
    }
  }

  function closeModal() {
    showModal = false;
  }

  function toggleModalSelectAll(checked: boolean) {
    if (checked) {
      pagedTrades.forEach((t: any) => {
        if (!alreadyLinkedIds.has(t._id)) selectedModalIds.add(t._id);
      });
    } else {
      pagedTrades.forEach((t: any) => {
        if (!alreadyLinkedIds.has(t._id)) selectedModalIds.delete(t._id);
      });
    }
  }

  function toggleModalTradeSelect(tradeId: string, checked: boolean) {
    if (checked) selectedModalIds.add(tradeId);
    else selectedModalIds.delete(tradeId);
  }

  const selectedCount = $derived(selectedModalIds.size - linkedTrades.length);
  const hasAnyUnlinkedSelected = $derived(selectedCount > 0);

  async function submitSelection() {
    if (!hasAnyUnlinkedSelected) {
      formError = 'Select at least one trade to link.';
      return;
    }
    const idsArray = Array.from(selectedModalIds);
    const form = new FormData();
    form.set('liquidationId', liquidation._id);
    form.set('tradeIds', idsArray.join(','));
    const res = await fetch(`/liquidations/${liquidation._id}`, {
      method: 'POST',
      body: form,
    });
    if (res.ok) {
      closeModal();
      goto(`/liquidations/${liquidation._id}`);
    } else {
      const json = await res.json().catch(() => ({ error: 'Failed to add trades' }));
      formError = json.error || 'Failed to add trades';
    }
  }

  function clearErrors() {
    formError = '';
  }
</script>

<svelte:head><title>Liquidation — Qulem-Trade</title></svelte:head>

<div style="padding:1.5rem;max-width:900px;">
  <!-- Error banner -->
  {#if formError}
    <button type="button" onclick={clearErrors} style="background:color-mix(in srgb,var(--loss) 10%,transparent);border:1px solid var(--loss);border-radius:0.75rem;padding:0.75rem 1rem;margin-bottom:1rem;color:var(--loss);font-size:0.875rem;cursor:pointer;display:flex;align-items:center;justify-content:space-between;">
      <span>⚠ {formError}</span>
      <span style="font-weight:700;margin-left:1rem;opacity:0.7;">✕</span>
    </button>
  {/if}

  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:0.75rem;">
    <div style="display:flex;align-items:center;gap:1rem;">
      <a href="/liquidations" style="color:var(--text-muted);text-decoration:none;font-size:0.875rem;">← Liquidations</a>
      <h1 style="font-family:'JetBrains Mono',monospace;font-size:1.25rem;font-weight:600;color:var(--text-primary);">Liquidation Details</h1>
    </div>
    <div style="display:flex;gap:0.5rem;">
      <button
        onclick={() => showDeleteDialog = true}
        disabled={deleting}
        style="padding:0.5rem 0.875rem;background:transparent;border:1px solid var(--loss);border-radius:0.5rem;color:var(--loss);font-size:0.875rem;cursor:pointer;opacity:{deleting ? 0.5 : 1};"
      >🗑 Delete</button>
    </div>
  </div>

  <!-- Metadata card -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1.5rem;margin-bottom:1.5rem;">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1.25rem;">
      <div>
        <label style={labelStyle}>Date</label>
        <div style="font-size:0.9rem;color:var(--text-primary);">{formatDate(liquidation.date)}</div>
      </div>
      <div>
        <label style={labelStyle}>Coin</label>
        <div style="font-size:0.9rem;font-weight:600;color:var(--text-primary);">{liquidation.coin ?? '—'}</div>
      </div>
      <div>
        <label style={labelStyle}>Position</label>
        <div>
          {#if liquidation.position}
            <span style="padding:0.125rem 0.5rem;border-radius:0.25rem;font-size:0.8rem;font-weight:600;
              background:{liquidation.position === 'Long' ? 'color-mix(in srgb,var(--win) 15%,transparent)' : 'color-mix(in srgb,var(--loss) 15%,transparent)'};
              color:{liquidation.position === 'Long' ? 'var(--win)' : 'var(--loss)'};">
              {liquidation.position}
            </span>
          {:else}
            <span style="color:var(--text-muted);">—</span>
          {/if}
        </div>
      </div>
      <div>
        <label style={labelStyle}>Strategy</label>
        <div style="font-size:0.9rem;color:var(--text-muted);">{liquidation.strategy ?? '—'}</div>
      </div>
      <div>
        <label style={labelStyle}>Amount Lost ($)</label>
        <div style="font-size:1rem;font-weight:700;color:var(--loss);">{liquidation.amount_lost != null ? `$${liquidation.amount_lost.toFixed(2)}` : '—'}</div>
      </div>
      <div>
        <label style={labelStyle}>Reason</label>
        <div style="font-size:0.9rem;color:var(--text-muted);">{liquidation.reason ?? '—'}</div>
      </div>
      {#if liquidation.mistake}
        <div style="grid-column:1/-1;">
          <label style={labelStyle}>Mistake</label>
          <div style="font-size:0.9rem;color:var(--loss);">{liquidation.mistake}</div>
        </div>
      {/if}
      {#if liquidation.notes}
        <div style="grid-column:1/-1;">
          <label style={labelStyle}>Notes</label>
          <div style="font-size:0.9rem;color:var(--text-muted);white-space:pre-wrap;">{liquidation.notes}</div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Linked trades section -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;overflow:hidden;">
    <div style="padding:1rem 1.25rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">
      <div style="display:flex;align-items:center;gap:1rem;">
        <h3 style="font-size:0.95rem;font-weight:600;color:var(--text-primary);">Linked Trades</h3>
        <span style="font-size:0.8rem;color:var(--text-muted);">{aggregated.count} trade{aggregated.count !== 1 ? 's' : ''}</span>
      </div>
      <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
        <span style="font-size:0.8rem;color:var(--text-muted);">Net PnL: <strong style="color:{pnlColor(aggregated.netPnL)}">{formatCurrency(aggregated.netPnL)}</strong></span>
        <span style="font-size:0.8rem;color:var(--text-muted);">Fees: <strong>{formatCurrency(aggregated.fees)}</strong></span>
        <button onclick={openModal} style="padding:0.375rem 0.75rem;border:1px solid var(--border);border-radius:0.375rem;color:var(--text-muted);font-size:0.8rem;cursor:pointer;background:transparent;">
          + Manage Links
        </button>
      </div>
    </div>

    {#if linkedTrades.length === 0}
      <div style="padding:2rem;text-align:center;color:var(--text-muted);">
        No trades linked yet. Click "+ Manage Links" above to add trades.
      </div>
    {:else}
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:0.8125rem;">
          <thead>
            <tr style="background:var(--bg);border-bottom:1px solid var(--border);">
              <th style="padding:0.625rem 0.75rem;text-align:left;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">Date</th>
              <th style="padding:0.625rem 0.75rem;text-align:left;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">Coin</th>
              <th style="padding:0.625rem 0.75rem;text-align:left;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">Pos</th>
              <th style="padding:0.625rem 0.75rem;text-align:left;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">PnL</th>
              <th style="padding:0.625rem 0.75rem;text-align:left;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">Fee</th>
              <th style="padding:0.625rem 0.75rem;text-align:left;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">Result</th>
              <th style="padding:0.625rem 0.75rem;text-align:left;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">Duration</th>
              <th style="padding:0.625rem 0.75rem;text-align:left;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">Source</th>
              <th style="padding:0.625rem 0.75rem;text-align:right;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">Action</th>
            </tr>
          </thead>
          <tbody>
            {#each linkedTrades as trade}
              <tr style="border-bottom:1px solid var(--border);">
                <td style="padding:0.625rem 0.75rem;font-family:'JetBrains Mono',monospace;color:var(--text-muted);white-space:nowrap;">{formatDate(trade.date)}</td>
                <td style="padding:0.625rem 0.75rem;font-weight:600;color:var(--text-primary);">{trade.coin}</td>
                <td style="padding:0.625rem 0.75rem;">
                  <span style="padding:0.125rem 0.5rem;border-radius:0.25rem;font-size:0.75rem;font-weight:600;
                    background:{trade.position === 'Long' ? 'color-mix(in srgb,var(--win) 15%,transparent)' : 'color-mix(in srgb,var(--loss) 15%,transparent)'};
                    color:{trade.position === 'Long' ? 'var(--win)' : 'var(--loss)'};">
                    {trade.position}
                  </span>
                </td>
                <td style="padding:0.625rem 0.75rem;font-family:'JetBrains Mono',monospace;font-weight:600;color:{pnlColor(trade.pnl)};">
                  {formatCurrency(trade.pnl)}
                </td>
                <td style="padding:0.625rem 0.75rem;font-family:'JetBrains Mono',monospace;color:var(--text-muted);">
                  {trade.fee != null ? `-${trade.fee.toFixed(2)}` : '—'}
                </td>
                <td style="padding:0.625rem 0.75rem;">
                  <span style="font-size:0.75rem;font-weight:600;color:{trade.win ? 'var(--win)' : trade.loss ? 'var(--loss)' : 'var(--text-muted)'};">
                    {trade.win ? 'Win' : trade.loss ? 'Loss' : trade.be ? 'BE' : '—'}
                  </span>
                </td>
                <td style="padding:0.625rem 0.75rem;color:var(--text-muted);">{trade.duration ?? '—'}</td>
                <td style="padding:0.625rem 0.75rem;color:var(--text-muted);">{trade.source ?? '—'}</td>
                <td style="padding:0.625rem 0.75rem;text-align:right;">
                  <form method="POST" style="display:inline;">
                    <input type="hidden" name="liquidationId" value={liquidation._id} />
                    <input type="hidden" name="tradeId" value={trade._id} />
                    <button type="submit" name="_action" value="unlink" style="padding:0.25rem 0.5rem;background:transparent;border:1px solid var(--border);border-radius:0.25rem;color:var(--text-muted);font-size:0.75rem;cursor:pointer;" title="Unlink this trade">✕</button>
                  </form>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <!-- Delete confirmation dialog -->
  {#if showDeleteDialog}
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:100;display:flex;align-items:center;justify-content:center;" onclick={(e) => { if (e.target === e.currentTarget) showDeleteDialog = false; }}>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1.5rem;max-width:400px;width:90%;">
        <h3 style="font-size:1rem;font-weight:600;color:var(--text-primary);margin-bottom:0.75rem;">Delete Liquidation?</h3>
        <p style="font-size:0.9rem;color:var(--text-muted);margin-bottom:1.25rem;">
          This will remove this liquidation and all its trade links. The underlying trades will remain in your Trade Log.
        </p>
        <div style="display:flex;gap:0.75rem;justify-content:flex-end;">
          <button onclick={() => showDeleteDialog = false} disabled={deleting} style="padding:0.5rem 1rem;border:1px solid var(--border);border-radius:0.5rem;background:transparent;color:var(--text-muted);font-size:0.875rem;cursor:pointer;">Cancel</button>
          <button onclick={handleDelete} disabled={deleting} style="padding:0.5rem 1rem;background:var(--loss);color:#fff;border:none;border-radius:0.5rem;font-size:0.875rem;font-weight:600;cursor:pointer;opacity:{deleting ? 0.5 : 1};" >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Trade picker modal -->
  {#if showModal}
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:100;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:2rem 1rem;" onclick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;max-width:800px;width:100%;min-height:400px;display:flex;flex-direction:column;">
        <!-- Modal header -->
        <div style="padding:1rem 1.25rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
          <h3 style="font-size:1rem;font-weight:600;color:var(--text-primary);">Link Trades to Liquidation</h3>
          <button onclick={closeModal} style="padding:0.25rem 0.5rem;background:transparent;border:none;font-size:1.1rem;color:var(--text-muted);cursor:pointer;">✕</button>
        </div>

        <!-- Filters -->
        <div style="padding:0.875rem 1.25rem;border-bottom:1px solid var(--border);display:flex;gap:0.75rem;flex-wrap:wrap;align-items:flex-end;">
          <div>
            <label style={labelStyle}>Coin</label>
            <input type="text" bind:value={modalCoinFilter} placeholder="BTC, ETH…" style="{inputStyle}width:120px;" />
          </div>
          <div>
            <label style={labelStyle}>Result</label>
            <select bind:value={modalResultFilter} style="{inputStyle}width:120px;">
              <option value="all">All</option>
              <option value="win">Win</option>
              <option value="loss">Loss</option>
              <option value="be">BE</option>
            </select>
          </div>
          <div style="margin-left:auto;display:flex;gap:0.5rem;align-items:center;">
            <span style="font-size:0.8rem;color:var(--text-muted);">
              {filteredTrades.length} found · Page {modalSearchPage}/{totalFilteredPages}
            </span>
            <span style="font-size:0.8rem;font-weight:600;color:{hasAnyUnlinkedSelected ? 'var(--accent)' : 'var(--text-muted)'};">
              {selectedCount} selected
            </span>
          </div>
        </div>

        <!-- Loading / trade list -->
        <div style="flex:1;overflow-y:auto;">
          {#if loadingTrades}
            <div style="padding:3rem;text-align:center;color:var(--text-muted);">Loading trades…</div>
          {:else if allUserTrades.length === 0}
            <div style="padding:3rem;text-align:center;color:var(--text-muted);">No trades found.</div>
          {:else}
            <table style="width:100%;border-collapse:collapse;font-size:0.8125rem;">
              <thead>
                <tr style="background:var(--bg);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:1;">
                  <th style="padding:0.5rem 0.75rem;text-align:center;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;width:40px;">
                    <input type="checkbox" checked={allModalSelected} onchange={(e) => toggleModalSelectAll((e.target as HTMLInputElement).checked)} style="cursor:pointer;accent-color:var(--accent);" />
                  </th>
                  <th style="padding:0.5rem 0.75rem;text-align:left;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">Date</th>
                  <th style="padding:0.5rem 0.75rem;text-align:left;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">Coin</th>
                  <th style="padding:0.5rem 0.75rem;text-align:left;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">Pos</th>
                  <th style="padding:0.5rem 0.75rem;text-align:right;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">PnL</th>
                  <th style="padding:0.5rem 0.75rem;text-align:left;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">Result</th>
                </tr>
              </thead>
              <tbody>
                {#each pagedTrades as trade}
                  <tr style="border-bottom:1px solid var(--border);background:{alreadyLinkedIds.has(trade._id) ? 'color-mix(in srgb,var(--accent) 8%,transparent)' : 'transparent'};">
                    <td style="padding:0.5rem 0.75rem;text-align:center;">
                      <input
                        type="checkbox"
                        checked={selectedModalIds.has(trade._id)}
                        onchange={(e) => toggleModalTradeSelect(trade._id, (e.target as HTMLInputElement).checked)}
                        disabled={alreadyLinkedIds.has(trade._id)}
                        style="cursor:{alreadyLinkedIds.has(trade._id) ? 'not-allowed' : 'pointer'};accent-color:var(--accent);opacity:{alreadyLinkedIds.has(trade._id) ? 0.6 : 1}"
                      />
                    </td>
                    <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;color:var(--text-muted);white-space:nowrap;font-size:0.75rem;">{formatDate(trade.date)}</td>
                    <td style="padding:0.5rem 0.75rem;font-weight:600;color:var(--text-primary);font-size:0.8rem;">{trade.coin}</td>
                    <td style="padding:0.5rem 0.75rem;">
                      <span style="padding:0.1rem 0.4rem;border-radius:0.25rem;font-size:0.7rem;font-weight:600;
                        background:{trade.position === 'Long' ? 'color-mix(in srgb,var(--win) 15%,transparent)' : 'color-mix(in srgb,var(--loss) 15%,transparent)'};
                        color:{trade.position === 'Long' ? 'var(--win)' : 'var(--loss)'};">
                        {trade.position}
                      </span>
                    </td>
                    <td style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;font-weight:600;text-align:right;color:{pnlColor(trade.pnl)};">{formatCurrency(trade.pnl)}</td>
                    <td style="padding:0.5rem 0.75rem;">
                      <span style="font-size:0.7rem;font-weight:600;color:{trade.win ? 'var(--win)' : trade.loss ? 'var(--loss)' : 'var(--text-muted)'};">
                        {trade.win ? 'Win' : trade.loss ? 'Loss' : trade.be ? 'BE' : '—'}
                      </span>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </div>

        <!-- Pagination -->
        {#if !loadingTrades && allUserTrades.length > 0 && totalFilteredPages > 1}
          <div style="padding:0.625rem 1.25rem;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:center;gap:0.5rem;">
            <button onclick={() => modalSearchPage = Math.max(1, modalSearchPage - 1)} disabled={modalSearchPage <= 1} style="padding:0.25rem 0.625rem;border:1px solid var(--border);border-radius:0.25rem;background:transparent;color:var(--text-muted);font-size:0.8rem;cursor:pointer;opacity:{modalSearchPage <= 1 ? 0.4 : 1};" >← Prev</button>
            <span style="font-size:0.8rem;color:var(--text-muted);min-width:80px;text-align:center;">Page {modalSearchPage} of {totalFilteredPages}</span>
            <button onclick={() => modalSearchPage = Math.min(totalFilteredPages, modalSearchPage + 1)} disabled={modalSearchPage >= totalFilteredPages} style="padding:0.25rem 0.625rem;border:1px solid var(--border);border-radius:0.25rem;background:transparent;color:var(--text-muted);font-size:0.8rem;cursor:pointer;opacity:{modalSearchPage >= totalFilteredPages ? 0.4 : 1};" >Next →</button>
          </div>
        {/if}

        <!-- Modal footer -->
        <div style="padding:1rem 1.25rem;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:0.75rem;">
          <span style="font-size:0.8rem;color:var(--text-muted);">
            {linkedTrades.length} already linked · {getAvailableTrades().length} available
          </span>
          <div style="display:flex;gap:0.5rem;">
            <button onclick={closeModal} style="padding:0.5rem 1rem;border:1px solid var(--border);border-radius:0.5rem;background:transparent;color:var(--text-muted);font-size:0.85rem;cursor:pointer;">Cancel</button>
            <button onclick={submitSelection} disabled={!hasAnyUnlinkedSelected} style="padding:0.5rem 1.25rem;background:{hasAnyUnlinkedSelected ? 'var(--loss)' : 'var(--border)'};color:#fff;border:none;border-radius:0.5rem;font-size:0.85rem;font-weight:600;cursor:pointer;opacity:{hasAnyUnlinkedSelected ? 1 : 0.5};">
              Save Links ({selectedCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
