<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();

  // Prefill from load() if coming from Trade Log selection
  let initial = $state(data.prefill);
  let date = $state(initial?.date || new Date().toISOString().split('T')[0]);
  let coin = $state(initial?.coin ?? '');
  let position = $state<'Long' | 'Short' | ''>((initial?.position as 'Long' | 'Short' | '') ?? '');
  let amount_lost = $state<number | null>(initial?.amount_lost ?? null);
  let strategy = $state(initial?.strategy ?? '');
  let reason = $state('');
  let notes = $state('');
  let mistake = $state('');
  let loading = $state(false);

  // If coming from Trade Log, show trade count badge
  const isLinkedMode = initial !== null && initial.count > 0;

  // Trade picker state (works in both linked and standalone modes)
  let search = $state('');
  let pickerOpen = $state(false);
  let selectedTradeIds = $state(new Set<string>(data.tradeIds ?? []));

  // All trades the user can pick from: pre-selected (from Trade Log) + available (not yet linked)
  const allPickerTrades = $derived.by(() => {
    const byId = new Map<string, any>();
    for (const t of data.selectedTradeDocs ?? []) byId.set(t._id, t);
    for (const t of data.availableTrades ?? []) byId.set(t._id, t);
    return [...byId.values()];
  });

  const availableTrades = $derived(
    allPickerTrades.filter(
      (t: any) =>
        !selectedTradeIds.has(t._id) &&
        (search === '' ||
          `${t.date} ${t.coin ?? ''} ${t.position ?? ''} ${t.strategy ?? ''}`
            .toLowerCase()
            .includes(search.toLowerCase()))
    )
  );

  const selectedTrades = $derived(
    allPickerTrades.filter((t: any) => selectedTradeIds.has(t._id))
  );

  // Derived net PnL of selected trades → auto-fill amount lost when not manually set
  let manualAmount = $state(false);
  const selectedNetPnl = $derived(
    selectedTrades.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0)
  );

  function toggleTrade(id: string) {
    if (selectedTradeIds.has(id)) selectedTradeIds.delete(id);
    else selectedTradeIds.add(id);
    // Re-derive amount lost from selection unless user typed a custom value
    if (!manualAmount) {
      const net = selectedTrades.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0);
      amount_lost = Math.max(0, -net) || null;
    }
  }

  function markAmountManual() {
    manualAmount = true;
  }
</script>

<svelte:head><title>Add Liquidation — Qulem-Trade</title></svelte:head>

<div style="padding:1.5rem;max-width:600px;">
  <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;">
    <a href="/liquidations" class="link-muted">← Liquidations</a>
    <h1 class="stat-value">Log Liquidation</h1>
  </div>

  <!-- Trade summary banner (linked mode only) -->
  {#if isLinkedMode}
    <div style="background:color-mix(in srgb,var(--accent) 8%,transparent);border:1px solid color-mix(in srgb,var(--accent) 40%,transparent);border-radius:0.75rem;padding:1rem 1.25rem;margin-bottom:1.5rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
      <div style="display:flex;align-items:center;gap:0.75rem;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
        <span style="font-size:0.9rem;font-weight:600;color:var(--text-primary);">{initial!.count} trade{initial!.count > 1 ? 's' : ''} linked</span>
      </div>
      <a href="/trades" style="font-size:0.8rem;color:var(--accent);text-decoration:underline;">View in Trade Log →</a>
    </div>
  {/if}

  <form method="POST" use:enhance={() => { loading = true; return async ({ update }) => { loading = false; await update(); }; }}>
    {#if form?.error}
      <div style="background:color-mix(in srgb,var(--loss) 12%,transparent);border:1px solid var(--loss);border-radius:0.75rem;padding:0.75rem 1rem;margin-bottom:1rem;color:var(--loss);font-size:0.875rem;">
        ⚠ {form.error}
      </div>
    {/if}

    <input type="hidden" name="tradeIds" value={Array.from(selectedTradeIds).join(',')} />
    <input type="hidden" name="position" value={position} />

    <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1.5rem;">
      <!-- Trade picker -->
      <div style="margin-bottom:1.25rem;">
          <label class="form-label">Link Trades (Optional)</label>
          <div style="position:relative;">
            <input
              type="text"
              bind:value={search}
              onfocus={() => pickerOpen = true}
              placeholder="Search trades by date, coin, position…"
              class="input"
            />
            {#if pickerOpen}
              <div style="position:absolute;top:calc(100% + 0.25rem);left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:0.5rem;box-shadow:0 8px 24px rgba(0,0,0,0.15);z-index:20;max-height:240px;overflow-y:auto;">
                {#if availableTrades.length === 0}
                  <div style="padding:0.75rem 1rem;font-size:0.8rem;color:var(--text-muted);">
                    {selectedTradeIds.size > 0 ? 'No more matching trades.' : 'No trades found. Add trades in the Trade Log first.'}
                  </div>
                {:else}
                  {#each availableTrades as t}
                    <button
                      type="button"
                      onclick={() => { toggleTrade(t._id); pickerOpen = false; }}
                      style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;width:100%;padding:0.5rem 0.875rem;background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text-primary);font-size:0.8125rem;cursor:pointer;text-align:left;"
                    >
                      <span style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:var(--text-muted);white-space:nowrap;">{t.date}</span>
                      <span style="font-weight:600;">{t.coin ?? '—'}</span>
                      <span class="muted-xs">{t.position ?? ''}</span>
                      <span style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:{t.pnl > 0 ? 'var(--win)' : t.pnl < 0 ? 'var(--loss)' : 'var(--text-muted)'};">
                        {t.pnl != null ? `$${t.pnl.toFixed(2)}` : '—'}
                      </span>
                    </button>
                  {/each}
                {/if}
              </div>
            {/if}
          </div>

          {#if selectedTrades.length > 0}
            <div style="display:flex;flex-wrap:wrap;gap:0.375rem;margin-top:0.5rem;">
              {#each selectedTrades as t}
                <span style="display:inline-flex;align-items:center;gap:0.375rem;padding:0.25rem 0.5rem;border:1px solid color-mix(in srgb,var(--accent) 40%,transparent);border-radius:0.375rem;background:color-mix(in srgb,var(--accent) 8%,transparent);font-size:0.75rem;color:var(--text-primary);">
                  {t.date} · {t.coin} · {t.position ?? ''} · {t.pnl != null ? `$${t.pnl.toFixed(2)}` : '—'}
                  <button type="button" onclick={() => toggleTrade(t._id)} style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.875rem;line-height:1;padding:0;">✕</button>
                </span>
              {/each}
            </div>
            <div style="margin-top:0.375rem;font-size:0.75rem;color:var(--text-muted);">
              Net PnL of selected: <strong style="color:{selectedNetPnl >= 0 ? 'var(--win)' : 'var(--loss)'};">{selectedNetPnl >= 0 ? '+' : ''}{selectedNetPnl.toFixed(2)}</strong>
            </div>
          {/if}
        </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
        <div>
          <label class="form-label">Date</label>
          <input type="date" name="date" bind:value={date} class="input" required />
        </div>
        <div>
          <label class="form-label">Coin</label>
          <input name="coin" bind:value={coin} placeholder="BTC" class="input" />
        </div>
        <div>
          <label class="form-label">Position</label>
          <div style="display:flex;gap:0.5rem;">
            {#each (['Long', 'Short', ''] as const) as p}
              <button
                type="button"
                onclick={() => position = p}
                style="flex:1;padding:0.5rem 0.375rem;border-radius:0.5rem;border:1px solid {position === p ? (p === 'Long' ? 'var(--win)' : p === 'Short' ? 'var(--loss)' : 'var(--border)') : 'var(--border)'};background:{position === p ? (p === 'Long' ? 'color-mix(in srgb,var(--win) 15%,transparent)' : p === 'Short' ? 'color-mix(in srgb,var(--loss) 15%,transparent)' : 'color-mix(in srgb,var(--accent) 10%,transparent)') : 'transparent'};color:{p === 'Long' ? 'var(--win)' : p === 'Short' ? 'var(--loss)' : 'var(--text-muted)'};font-size:0.75rem;font-weight:600;cursor:pointer;transition:all 0.15s;">
                {p === '' ? 'N/A' : p}
              </button>
            {/each}
          </div>
        </div>
        <div>
          <label class="form-label">Amount Lost ($)</label>
          <input type="number" name="amount_lost" bind:value={amount_lost} step="any" onfocus={markAmountManual} placeholder="500.00" class="input" />
        </div>
        <div>
          <label class="form-label">Strategy</label>
          <input name="strategy" bind:value={strategy} placeholder="e.g. Breakout" class="input" />
        </div>
        <div>
          <label class="form-label">Reason</label>
          <input name="reason" bind:value={reason} placeholder="e.g. No stop loss, overleveraged" class="input" />
        </div>
        <div class="span-full">
          <label class="form-label">Mistake</label>
          <input name="mistake" bind:value={mistake} placeholder="What went wrong?" class="input" style="resize:vertical;font-family:inherit;" />
        </div>
        <div class="span-full">
          <label class="form-label">Notes</label>
          <textarea name="notes" bind:value={notes} rows="3" placeholder="What happened? What did you learn?" class="input" style="resize:vertical;font-family:inherit;"></textarea>
        </div>
      </div>
      <div style="margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid var(--border);display:flex;gap:0.75rem;">
        <button type="submit" disabled={loading || !date} style="padding:0.625rem 1.5rem;background:var(--loss);color:#fff;border:none;border-radius:0.5rem;font-weight:600;font-size:0.875rem;cursor:pointer;opacity:{loading || !date ? 0.5 : 1};">
          {loading ? 'Saving…' : 'Log Liquidation'}
        </button>
        <a href="/liquidations" style="padding:0.625rem 1rem;border:1px solid var(--border);border-radius:0.5rem;background:transparent;color:var(--text-muted);font-size:0.875rem;text-decoration:none;display:inline-flex;align-items:center;">Cancel</a>
      </div>
    </div>
  </form>
</div>
