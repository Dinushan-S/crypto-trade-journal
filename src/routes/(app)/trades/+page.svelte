<script lang="ts">
  import { goto } from '$app/navigation';
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import { untrack } from 'svelte';
  import { formatCurrency, formatDate, periodRange, type Period } from '$lib/utils';

  let { data, form } = $props();

  // Local filter state (mirrors URL params — seeded once from server data)
  let coin = $state(untrack(() => data.filters.coin));
  let position = $state(untrack(() => data.filters.position));
  let result = $state(untrack(() => data.filters.result));
  let strategy = $state(untrack(() => data.filters.strategy));
  let source = $state(untrack(() => data.filters.source));
  let dateFrom = $state(untrack(() => data.filters.dateFrom));
  let dateTo = $state(untrack(() => data.filters.dateTo));

  // Sort state (client-side)
  let sortCol = $state('date');
  let sortAsc = $state(false);

  // Selection mode state
  let selectionMode = $state(false);
  let selectionPurpose = $state<'liquidation' | 'combine'>('liquidation');
  let selectedSet = $state(new Set<string>());

  let sortedTrades = $derived((() => {
    const t = [...data.trades];
    t.sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortCol] ?? '';
      const bv = (b as Record<string, unknown>)[sortCol] ?? '';
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
    return t;
  })());

  function toggleSelectionMode() {
    selectionPurpose = 'liquidation';
    selectionMode = !selectionMode;
    selectedSet = new Set();
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      selectedSet = new Set(sortedTrades.map(t => t.id));
    } else {
      selectedSet = new Set();
    }
  }

  function toggleTradeSelect(tradeId: string, checked: boolean) {
    const next = new Set(selectedSet);
    if (checked) next.add(tradeId);
    else next.delete(tradeId);
    selectedSet = next;
  }

  const selectedCount = $derived(selectedSet.size);

  const selectedTrades = $derived(
    data.trades.filter((t: any) => selectedSet.has(t.id))
  );

  const selectedNetPnl = $derived(
    selectedTrades.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0)
  );

  const selectedFees = $derived(
    selectedTrades.reduce((s: number, t: any) => s + (t.fee ?? 0), 0)
  );

  const allSelected = $derived(
    selectedTrades.length > 0 && selectedSet.size === sortedTrades.length
  );

  const selectedAmountLost = $derived(Math.max(0, -selectedNetPnl));

  const mixedFields = $derived({
    coins: new Set(selectedTrades.map((t: any) => t.coin)).size > 1 ? true : false,
    positions: new Set(selectedTrades.map((t: any) => t.position)).size > 1 ? true : false,
    strategies: selectedTrades.every((t: any) => t.strategy)
      ? new Set(selectedTrades.map((t: any) => t.strategy)).size > 1 ? true : false
      : false,
  });

  function createLiquidation() {
    if (selectedSet.size === 0) return;
    const tradeIds = Array.from(selectedSet).join(',');
    goto(`/liquidations/new?tradeIds=${encodeURIComponent(tradeIds)}`);
  }

  // Quick add / quick edit modal
  let addOpen = $state(false);
  let editTrade = $state<any | null>(null);
  let modalMode = $state<'quick' | 'full'>('quick');

  const tfOptions = ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'];

  const closeModal = () => {
    addOpen = false;
    editTrade = null;
    modalMode = 'quick';
  };

  let saving = $state(false);
  const submitEnhance = () => {
    saving = true;
    return async ({ result, update }: any) => {
      saving = false;
      await update({ reset: false });
      if (result.type === 'success') closeModal();
    };
  };

  $effect(() => {
    if (form?.error) {
      alert(form.error);
    }
  });

  // Escape closes the modal
  $effect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function openAdd() {
    addOpen = true;
    editTrade = null;
    tfSel = [];
    modalMode = 'full';
  }

  // /trades?add opens the add modal (replaces the old /trades/new page)
  $effect(() => {
    if (page.url.searchParams.has('add')) {
      openAdd();
      goto('/trades', { replaceState: true, noScroll: true, keepFocus: true });
    }
  });
  function openEdit(t: any) {
    if (t.is_group) { goto(`/trades/${t.id}?edit`); return; }
    editTrade = t;
    tfSel = t.timeframes ?? [];
    addOpen = true;
    modalMode = 'quick';
  }

  let tfSel = $state<string[]>([]);
  function toggleTf(tf: string) {
    tfSel = tfSel.includes(tf) ? tfSel.filter((x) => x !== tf) : [...tfSel, tf];
  }

  // Summary stats for visible trades
  let totalPnl = $derived(data.trades.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0));
  let wins = $derived(data.trades.filter((t: any) => t.win).length);
  let completedCount = $derived(data.trades.filter((t: any) => !t.is_group || t.status === 'Closed').length);
  let winRate = $derived(completedCount > 0 ? ((wins / completedCount) * 100).toFixed(1) : '0.0');

  function applyFilters() {
    selectedSet = new Set();
    const params = new URLSearchParams();
    if (coin) params.set('coin', coin);
    if (position !== 'all') params.set('position', position);
    if (result !== 'all') params.set('result', result);
    if (strategy) params.set('strategy', strategy);
    if (source !== 'all') params.set('source', source);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    goto(`/trades?${params.toString()}`);
  }

  // Quick date period presets — 'custom' just leaves the From/To inputs alone
  let period = $state<Period>('custom');
  function setPeriod(p: Period) {
    period = p;
    if (p === 'custom') return;
    ({ from: dateFrom, to: dateTo } = periodRange(p));
    applyFilters();
  }

  function resetFilters() {
    selectedSet = new Set();
    coin = '';
    position = 'all';
    result = 'all';
    strategy = '';
    source = 'all';
    dateFrom = '';
    dateTo = '';
    period = 'custom';
    goto('/trades');
  }

  function toggleSort(col: string) {
    if (sortCol === col) sortAsc = !sortAsc;
    else {
      sortCol = col;
      sortAsc = true;
    }
  }

  function sortIcon(col: string) {
    if (sortCol !== col) return '↕';
    return sortAsc ? '↑' : '↓';
  }

  function isIncomplete(trade: any) {
    return trade.source === 'futures_import' && (!trade.strategy || !trade.reason);
  }

  const resultLabel = (t: any) => (t.win ? 'Win' : t.loss ? 'Loss' : t.be ? 'BE' : '—');
  const resultColor = (t: any) =>
    t.win ? 'var(--win)' : t.loss ? 'var(--loss)' : 'var(--text-muted)';

  function pnlColor(pnl: number | null | undefined): string {
    if (pnl == null) return 'var(--text-muted)';
    if (pnl > 0) return 'var(--win)';
    if (pnl < 0) return 'var(--loss)';
    return 'var(--text-muted)';
  }

  const columns: Array<[string, string]> = [
    ['#', ''],
    ['Date', 'date'],
    ['Coin', 'coin'],
    ['Pos', 'position'],
    ['Entry', 'entry_price'],
    ['SL', 'stop_loss'],
    ['Strategy', 'strategy'],
    ['TF', ''],
    ['Risk%', 'risk_pct'],
    ['Range%', 'range_pct'],
    ['PnL', 'pnl'],
    ['Result', ''],
    ['Conf', 'confidence'],
    ['Duration', 'duration'],
    ['Closed', 'date_closed'],
    ['Reason', 'reason']
  ];
</script>

<svelte:head><title>Trades — Qulem-Trade</title></svelte:head>

<div style="padding:1.5rem;max-width:100%;">
  {#if page.url.searchParams.has('notes')}<p style="margin-bottom:1rem;">Combination undone. <a href="/trades/{page.url.searchParams.get('notes')}">View retained shared journal notes</a>.</p>{/if}
  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;">
    <div>
      <h1
        class="stat-value"
      >
        Trade Log
      </h1>
      <p style="color:var(--text-muted);font-size:0.875rem;margin-top:0.125rem;">
        {data.total} total trades
      </p>
    </div>
    <div style="display:flex;gap:0.5rem;">
      <button class="btn-ghost" onclick={() => { selectionMode = !(selectionMode && selectionPurpose === 'combine'); selectionPurpose = 'combine'; selectedSet = new Set(); }}>{selectionMode && selectionPurpose === 'combine' ? 'Cancel Selection' : 'Combine Trades'}</button>
      <button
        onclick={toggleSelectionMode}
        style="padding:0.5rem 0.875rem;background:{selectionMode ? 'var(--accent)' : 'transparent'};border:{selectionMode ? 'none' : '1px solid var(--border)'};border-radius:0.5rem;color:{selectionMode ? '#fff' : 'var(--text-muted)'};text-decoration:none;font-size:0.875rem;display:inline-flex;align-items:center;gap:0.375rem;cursor:pointer;"
      >
        📋 Create Liquidation
      </button>
      <a
        href="/trades/import"
        style="padding:0.5rem 0.875rem;border:1px solid var(--border);border-radius:0.5rem;color:var(--text-muted);text-decoration:none;font-size:0.875rem;background:transparent;display:inline-flex;align-items:center;gap:0.375rem;"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        Import CSV
      </a>
      <button
        onclick={openAdd}
        style="padding:0.5rem 0.875rem;background:var(--accent);border:none;border-radius:0.5rem;color:#fff;font-size:0.875rem;font-weight:500;display:inline-flex;align-items:center;gap:0.375rem;cursor:pointer;"
      >
        + New Trade
      </button>
    </div>
  </div>

  <!-- Sticky summary bar (visible in selection mode) -->
  {#if selectionMode && selectedCount > 0}
    <div style="position:sticky;top:0;z-index:10;background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:0.875rem 1rem;margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
      <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
        <span style="font-size:0.85rem;font-weight:700;color:var(--accent);">
          {selectedCount} selected
        </span>
        {#if mixedFields.coins}
          <span style="font-size:0.75rem;color:var(--loss);border:1px solid var(--loss);padding:0.15rem 0.5rem;border-radius:0.25rem;">Mixed coins</span>
        {:else if selectedTrades[0]}
          <span class="muted-xs">Coin: {selectedTrades[0].coin}</span>
        {/if}
        {#if mixedFields.positions}
          <span style="font-size:0.75rem;color:var(--loss);border:1px solid var(--loss);padding:0.15rem 0.5rem;border-radius:0.25rem;">Mixed position</span>
        {:else if selectedTrades[0] && selectedTrades[0].position}
          <span class="muted-xs">Pos: {selectedTrades[0].position}</span>
        {/if}
        <span style="font-size:0.8rem;font-weight:600;color:{selectedAmountLost > 0 ? 'var(--loss)' : 'var(--text-muted)'};">
          Net PnL: {formatCurrency(selectedNetPnl)}
        </span>
      </div>
      <div style="display:flex;gap:0.5rem;align-items:center;">
        <button class="btn-ghost" onclick={() => { selectionMode = false; selectedSet = new Set(); }}>Cancel</button>
        {#if selectionPurpose === 'combine'}
          <button class="btn-primary" disabled={selectedCount < 2 || mixedFields.coins || mixedFields.positions} onclick={() => goto(`/trades/combine?ids=${encodeURIComponent(Array.from(selectedSet).join(','))}`)}>Next: Review {selectedCount} Trades</button>
        {:else}
        <a
          href="/liquidations/new?tradeIds={encodeURIComponent(Array.from(selectedSet).join(','))}"
          style="padding:0.5rem 1rem;background:var(--loss);color:#fff;border:none;border-radius:0.5rem;font-size:0.85rem;font-weight:600;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:0.375rem;"
        >
          Create Liquidation →
        </a>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Filters -->
  <div
    style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1rem;margin-bottom:1rem;display:flex;flex-wrap:wrap;gap:0.75rem;align-items:flex-end;"
  >
    <div style="display:flex;gap:0.25rem;align-self:flex-end;">
      {#each [['day','Today'],['week','This Week'],['month','This Month'],['custom','Custom']] as [p, label]}
        <button
          onclick={() => setPeriod(p as Period)}
          style="padding:0.375rem 0.625rem;border:1px solid {period === p ? 'var(--accent)' : 'var(--border)'};border-radius:0.375rem;background:{period === p ? 'color-mix(in srgb,var(--accent) 12%,transparent)' : 'var(--bg)'};color:{period === p ? 'var(--accent)' : 'var(--text-muted)'};font-size:0.8rem;cursor:pointer;"
        >{label}</button>
      {/each}
    </div>
    <div>
      <label
        class="field-label"
        >From</label
      >
      <input
        type="date"
        bind:value={dateFrom}
        oninput={() => (period = 'custom')}
        style="padding:0.375rem 0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:0.375rem;color:var(--text-primary);font-size:0.8rem;width:130px;"
      />
    </div>
    <div>
      <label
        class="field-label"
        >To</label
      >
      <input
        type="date"
        bind:value={dateTo}
        oninput={() => (period = 'custom')}
        style="padding:0.375rem 0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:0.375rem;color:var(--text-primary);font-size:0.8rem;width:130px;"
      />
    </div>
    <div>
      <label
        class="field-label"
        >Coin</label
      >
      <input
        type="text"
        bind:value={coin}
        placeholder="BTC, ETH…"
        style="padding:0.375rem 0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:0.375rem;color:var(--text-primary);font-size:0.8rem;width:110px;"
      />
    </div>
    <div>
      <label
        class="field-label"
        >Position</label
      >
      <select
        bind:value={position}
        class="input-sm"
      >
        <option value="all">All</option>
        <option value="Long">Long</option>
        <option value="Short">Short</option>
      </select>
    </div>
    <div>
      <label
        class="field-label"
        >Result</label
      >
      <select
        bind:value={result}
        class="input-sm"
      >
        <option value="all">All</option>
        <option value="win">Win</option>
        <option value="loss">Loss</option>
        <option value="be">BE</option>
      </select>
    </div>
    <div>
      <label
        class="field-label"
        >Strategy</label
      >
      <input
        type="text"
        bind:value={strategy}
        placeholder="Search…"
        style="padding:0.375rem 0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:0.375rem;color:var(--text-primary);font-size:0.8rem;width:110px;"
      />
    </div>
    <div>
      <label
        class="field-label"
        >Source</label
      >
      <select
        bind:value={source}
        class="input-sm"
      >
        <option value="all">All</option>
        <option value="manual">Manual</option>
        <option value="imported">Imported</option>
      </select>
    </div>
    <div style="display:flex;gap:0.5rem;">
      <button
        onclick={applyFilters}
        style="padding:0.375rem 0.875rem;background:var(--accent);color:#fff;border:none;border-radius:0.375rem;font-size:0.8rem;font-weight:500;cursor:pointer;"
        >Apply</button
      >
      <button
        onclick={resetFilters}
        style="padding:0.375rem 0.75rem;background:transparent;color:var(--text-muted);border:1px solid var(--border);border-radius:0.375rem;font-size:0.8rem;cursor:pointer;"
        >Reset</button
      >
    </div>
  </div>

  <!-- Table -->
  <div
    class="card-flush"
  >
    <div class="scroll-x">
      <table class="table">
        <thead>
          <tr class="thead-row">
            {#if selectionMode}
              <th style="padding:0.625rem 0.75rem;text-align:center;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;min-width:40px;">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onchange={(e) => toggleSelectAll((e.target as HTMLInputElement).checked)}
                  style="cursor:pointer;accent-color:var(--accent);"
                />
              </th>
            {/if}
            {#each columns as [label, col]}
              <th
                onclick={() => col && toggleSort(col)}
                style="padding:0.625rem 0.75rem;text-align:left;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;cursor:{col
                  ? 'pointer'
                  : 'default'};user-select:none;"
              >
                {label}{col ? ` ${sortIcon(col)}` : ''}
              </th>
            {/each}
            <th style="padding:0.625rem 0.75rem;text-align:left;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#if data.trades.length === 0}
            <tr>
              <td colspan="{selectionMode ? 17 : 16}" style="padding:3rem;text-align:center;color:var(--text-muted);">
                No trades found.
                <button
                  onclick={openAdd}
                  style="background:none;border:none;color:var(--accent);font-size:inherit;text-decoration:underline;cursor:pointer;"
                  >Add your first trade</button
                >
                or
                <a href="/trades/import" style="color:var(--accent);text-decoration:none;"
                  >import CSV</a
                >.
              </td>
            </tr>
          {:else}
            {#each sortedTrades as trade, i}
              <tr
                class:selection-mode-row={selectionMode}
                onclick={() => !selectionMode && goto(`/trades/${trade.id}`)}
                style="border-bottom:1px solid var(--border);transition:background 0.1s;{selectionMode ? 'cursor:default' : 'cursor:pointer'}"
                onmouseenter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  if (selectionMode) {
                    el.style.background = selectedSet.has(trade.id)
                      ? 'color-mix(in srgb, var(--accent) 15%, transparent)'
                      : 'color-mix(in srgb, var(--accent) 4%, transparent)';
                  } else {
                    el.style.background = 'color-mix(in srgb, var(--accent) 4%, transparent)';
                  }
                }}
                onmouseleave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  if (selectionMode) {
                    el.style.background = selectedSet.has(trade.id)
                      ? 'color-mix(in srgb, var(--accent) 10%, transparent)'
                      : 'transparent';
                  } else {
                    el.style.background = 'transparent';
                  }
                }}
              >
                {#if selectionMode}
                  <td
                    style="padding:0.625rem 0.75rem;text-align:center;"
                    onclick={(e) => {
                      e.stopPropagation();
                      toggleTradeSelect(trade.id, !selectedSet.has(trade.id));
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSet.has(trade.id)}
                      aria-label={`Select ${trade.coin} trade ${trade.id}`}
                      onclick={(e) => e.stopPropagation()}
                      onchange={(e) => toggleTradeSelect(trade.id, (e.target as HTMLInputElement).checked)}
                      style="cursor:pointer;accent-color:var(--accent);"
                    />
                  </td>
                {/if}
                <td
                  style="padding:0.625rem 0.75rem;color:var(--text-muted);font-family:'JetBrains Mono',monospace;"
                  >{i + 1}</td
                >
                <td
                  style="padding:0.625rem 0.75rem;color:var(--text-primary);font-family:'JetBrains Mono',monospace;white-space:nowrap;"
                  >{formatDate(trade.date)}</td
                >
                <td style="padding:0.625rem 0.75rem;font-weight:600;color:var(--text-primary);">
                  {trade.coin}
                  {#if trade.is_group}<span class="muted-xs"> · {trade.close_count} closes · {trade.status}</span>{/if}
                  {#if isIncomplete(trade)}
                    <span
                      style="margin-left:0.25rem;padding:0.1rem 0.375rem;background:color-mix(in srgb,#f59e0b 20%,transparent);color:#f59e0b;border-radius:0.25rem;font-size:0.65rem;font-weight:600;"
                      >!</span
                    >
                  {/if}
                </td>
                <td style="padding:0.625rem 0.75rem;">
                  <span
                    style="padding:0.125rem 0.5rem;border-radius:0.25rem;font-size:0.75rem;font-weight:600;background:{trade.position ===
                    'Long'
                      ? 'color-mix(in srgb,var(--win) 15%,transparent)'
                      : 'color-mix(in srgb,var(--loss) 15%,transparent)'};color:{trade.position ===
                    'Long'
                      ? 'var(--win)'
                      : 'var(--loss)'};"
                  >
                    {trade.position}
                  </span>
                </td>
                <td
                  style="padding:0.625rem 0.75rem;font-family:'JetBrains Mono',monospace;color:var(--text-primary);"
                  >{trade.entry_price ?? '—'}</td
                >
                <td
                  style="padding:0.625rem 0.75rem;font-family:'JetBrains Mono',monospace;color:var(--text-muted);"
                  >{trade.stop_loss ?? '—'}</td
                >
                <td
                  style="padding:0.625rem 0.75rem;color:var(--text-muted);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
                  >{trade.strategy ?? '—'}</td
                >
                <td style="padding:0.625rem 0.75rem;color:var(--text-muted);font-size:0.75rem;"
                  >{trade.timeframes?.join(', ') ?? '—'}</td
                >
                <td
                  style="padding:0.625rem 0.75rem;font-family:'JetBrains Mono',monospace;color:var(--text-muted);"
                  >{trade.risk_pct != null ? `${trade.risk_pct}%` : '—'}</td
                >
                <td
                  style="padding:0.625rem 0.75rem;font-family:'JetBrains Mono',monospace;color:var(--text-muted);"
                  >{trade.range_pct != null ? `${trade.range_pct}%` : '—'}</td
                >
                <td
                  style="padding:0.625rem 0.75rem;font-family:'JetBrains Mono',monospace;font-weight:600;color:{pnlColor(trade.pnl)};"
                >
                  {formatCurrency(trade.pnl)}
                </td>
                <td style="padding:0.625rem 0.75rem;">
                  <span style="font-size:0.75rem;font-weight:600;color:{resultColor(trade)};"
                    >{resultLabel(trade)}</span
                  >
                </td>
                <td
                  style="padding:0.625rem 0.75rem;font-family:'JetBrains Mono',monospace;color:var(--text-muted);"
                  >{trade.confidence ?? '—'}</td
                >
                <td style="padding:0.625rem 0.75rem;color:var(--text-muted);"
                  >{trade.duration ?? '—'}</td
                >
                <td
                  style="padding:0.625rem 0.75rem;font-family:'JetBrains Mono',monospace;color:var(--text-muted);white-space:nowrap;"
                  >{formatDate(trade.date_closed)}</td
                >
                <td
                  style="padding:0.625rem 0.75rem;color:var(--text-muted);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
                  >{trade.reason ?? '—'}</td
                >
                <td
                  style="padding:0.625rem 0.75rem;white-space:nowrap;"
                  onclick={(e) => e.stopPropagation()}
                >
                  <button
                    onclick={() => openEdit(trade)}
                    style="padding:0.2rem 0.5rem;border:1px solid var(--border);border-radius:0.25rem;background:transparent;color:var(--text-muted);font-size:0.7rem;cursor:pointer;"
                    >✏️</button
                  >
                  <form method="POST" action="?/delete" use:enhance style="display:inline;">
                    <input type="hidden" name="id" value={trade.id} />
                    <button
                      type="submit"
                      onclick={(e) => {
                        if (!confirm(`Delete ${trade.coin} trade on ${trade.date}?`)) e.preventDefault();
                      }}
                      style="padding:0.2rem 0.5rem;border:1px solid var(--border);border-radius:0.25rem;background:transparent;color:var(--loss);font-size:0.7rem;cursor:pointer;"
                      >🗑️</button
                    >
                  </form>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
        {#if data.trades.length > 0}
          <tfoot>
            <tr style="background:var(--bg);border-top:2px solid var(--border);">
              <td
                colspan="{selectionMode ? 2 : 2}"
                style="padding:0.625rem 0.75rem;font-size:0.75rem;color:var(--text-muted);font-weight:600;"
                >{data.total} trades</td
              >
              <td
                colspan="8"
                style="padding:0.625rem 0.75rem;font-size:0.75rem;color:var(--text-muted);"
                >Win rate: <span style="color:var(--text-primary);font-weight:600;">{winRate}%</span
                ></td
              >
              <td
                style="padding:0.625rem 0.75rem;font-family:'JetBrains Mono',monospace;font-weight:700;color:{totalPnl >= 0
                  ? 'var(--win)'
                  : 'var(--loss)'};"
              >
                {formatCurrency(totalPnl)}
              </td>
              <td colspan="4"></td>
            </tr>
          </tfoot>
        {/if}
      </table>
    </div>

    <!-- Pagination -->
    {#if data.total > 50}
      <div
        style="padding:0.75rem 1rem;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;"
      >
        <span class="muted-sm"
          >Page {data.page} of {Math.ceil(data.total / 50)}</span
        >
        <div style="display:flex;gap:0.5rem;">
          {#if data.page > 1}
            <a
              href="/trades?{new URLSearchParams({ ...data.filters, page: String(data.page - 1) })}"
              style="padding:0.375rem 0.75rem;border:1px solid var(--border);border-radius:0.375rem;color:var(--text-muted);text-decoration:none;font-size:0.8rem;"
              >← Prev</a
            >
          {/if}
          {#if data.page * 50 < data.total}
            <a
              href="/trades?{new URLSearchParams({ ...data.filters, page: String(data.page + 1) })}"
              style="padding:0.375rem 0.75rem;border:1px solid var(--border);border-radius:0.375rem;color:var(--text-muted);text-decoration:none;font-size:0.8rem;"
              >Next →</a
            >
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <!-- Quick Add / Quick Edit Modal -->
  {#if addOpen}
    <div
      style="position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:50;"
      onclick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
    >
      <div
        style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1.5rem;width:min(720px,94vw);max-height:90vh;overflow-y:auto;"
      >
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem;">
          <h2 style="font-family:'JetBrains Mono',monospace;font-size:1.1rem;font-weight:600;color:var(--text-primary);">
            {editTrade ? `Edit ${editTrade.coin}` : 'Add Trade'}
          </h2>
          <button onclick={closeModal} style="background:none;border:none;color:var(--text-muted);font-size:1.25rem;cursor:pointer;line-height:1;">✕</button>
        </div>

        <!-- Mode toggle -->
        <div style="display:inline-flex;background:var(--surface);border:1px solid var(--border);border-radius:0.5rem;padding:0.25rem;margin-bottom:1.25rem;">
          {#each (['quick', 'full'] as const) as m}
            <button
              type="button"
              onclick={() => modalMode = m}
              style="padding:0.375rem 1rem;border-radius:0.375rem;border:none;cursor:pointer;font-size:0.875rem;font-weight:500;transition:all 0.15s;
                background:{modalMode === m ? 'var(--accent)' : 'transparent'};
                color:{modalMode === m ? '#fff' : 'var(--text-muted)'};"
            >
              {m === 'quick' ? '⚡ Quick' : '📋 Full'}
            </button>
          {/each}
        </div>

        <form
          method="POST"
          action={editTrade ? '?/quickUpdate' : '?/add'}
          use:enhance={submitEnhance}
        >
          <input type="hidden" name="liquidated_present" value="1" />
          <label style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;">
            <input type="checkbox" name="liquidated" checked={editTrade?.liquidated ?? false} />
            Liquidated
          </label>
          <p class="muted-sm" style="margin-bottom:1rem;">Uses the trade's negative PnL as the amount lost. Unchecking unlinks the trade; manually entered events remain in Liquidations.</p>
          {#if editTrade}
            <input type="hidden" name="id" value={editTrade.id} />
          {/if}
          {#if modalMode === 'quick'}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.875rem;">
              <div>
                <label class="form-label">Coin</label>
                <input name="coin" required value={editTrade?.coin ?? ''} placeholder="BTC" class="input" />
              </div>
              <div>
                <label class="form-label">Position</label>
                <select name="position" class="input">
                  {#each (['Long', 'Short'] as const) as p}
                    <option value={p} selected={editTrade?.position === p}>{p}</option>
                  {/each}
                </select>
              </div>
              <div>
                <label class="form-label">Date</label>
                <input type="date" name="date" value={editTrade?.date ?? new Date().toISOString().split('T')[0]} class="input" required />
              </div>
              <div>
                <label class="form-label">Time</label>
                <input type="time" name="time" step="any" value={editTrade?.time ?? ''} class="input" />
              </div>
              <div>
                <label class="form-label">Entry Price</label>
                <input type="number" name="entry_price" value={editTrade?.entry_price ?? ''} step="any" placeholder="0.00" class="input" />
              </div>
              <div>
                <label class="form-label">PnL ($)</label>
                <input type="number" name="pnl" value={editTrade?.pnl ?? ''} step="any" placeholder="+0.00" class="input" />
              </div>
              <div>
                <label class="form-label">Strategy</label>
                <input name="strategy" value={editTrade?.strategy ?? ''} placeholder="Breakout, Retest…" class="input" />
              </div>
              <div>
                <label class="form-label">Reason</label>
                <input name="reason" value={editTrade?.reason ?? ''} placeholder="Setup notes…" class="input" />
              </div>
            </div>
          {:else}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.875rem;">
              <div>
                <label class="form-label">Coin</label>
                <input name="coin" required value={editTrade?.coin ?? ''} placeholder="BTC" class="input" />
              </div>
              <div>
                <label class="form-label">Position</label>
                <select name="position" class="input">
                  {#each (['Long', 'Short'] as const) as p}
                    <option value={p} selected={editTrade?.position === p}>{p}</option>
                  {/each}
                </select>
              </div>
              <div>
                <label class="form-label">Date</label>
                <input type="date" name="date" value={editTrade?.date ?? new Date().toISOString().split('T')[0]} class="input" required />
              </div>
              <div>
                <label class="form-label">Time</label>
                <input type="time" name="time" value={editTrade?.time ?? ''} class="input" />
              </div>
              <div>
                <label class="form-label">Entry Price</label>
                <input type="number" name="entry_price" value={editTrade?.entry_price ?? ''} step="any" placeholder="0.00" class="input" />
              </div>
              <div>
                <label class="form-label">Exit Price</label>
                <input type="number" name="exit_price" value={editTrade?.exit_price ?? ''} step="any" placeholder="0.00" class="input" />
              </div>
              <div>
                <label class="form-label">Stop Loss</label>
                <input type="number" name="stop_loss" value={editTrade?.stop_loss ?? ''} step="any" placeholder="0.00" class="input" />
              </div>
              <div>
                <label class="form-label">Quantity</label>
                <input type="number" name="quantity" value={editTrade?.quantity ?? ''} step="any" placeholder="0" class="input" />
              </div>
              <div>
                <label class="form-label">PnL ($)</label>
                <input type="number" name="pnl" value={editTrade?.pnl ?? ''} step="any" placeholder="+0.00" class="input" />
              </div>
              <div>
                <label class="form-label">Fee ($)</label>
                <input type="number" name="fee" value={editTrade?.fee ?? ''} step="any" placeholder="0.00" class="input" />
              </div>
              <div>
                <label class="form-label">Strategy</label>
                <input name="strategy" value={editTrade?.strategy ?? ''} placeholder="e.g. Breakout, Retest" class="input" />
              </div>
              <div>
                <label class="form-label">Leverage</label>
                <input name="leverage" value={editTrade?.leverage ?? ''} placeholder="e.g. 10x" class="input" />
              </div>
              <div>
                <label class="form-label">Confidence (1-5)</label>
                <input type="number" name="confidence" min="1" max="5" value={editTrade?.confidence ?? ''} placeholder="3" class="input" />
              </div>
              <div>
                <label class="form-label">Risk %</label>
                <input type="number" name="risk_pct" value={editTrade?.risk_pct ?? ''} step="any" placeholder="1.0" class="input" />
              </div>
              <div>
                <label class="form-label">Range %</label>
                <input type="number" name="range_pct" value={editTrade?.range_pct ?? ''} step="any" placeholder="2.5" class="input" />
              </div>
              <div>
                <label class="form-label">Limit Type</label>
                <input name="limit_type" value={editTrade?.limit_type ?? ''} placeholder="Limit / Market / Stop" class="input" />
              </div>
              <div>
                <label class="form-label">Duration</label>
                <input name="duration" value={editTrade?.duration ?? ''} placeholder="e.g. 2h 30m" class="input" />
              </div>
              <div>
                <label class="form-label">Date Closed</label>
                <input type="date" name="date_closed" value={editTrade?.date_closed ?? ''} class="input" />
              </div>
              <div>
                <label class="form-label">Closed Reason</label>
                <input name="closed_reason" value={editTrade?.closed_reason ?? ''} placeholder="Why closed…" class="input" />
              </div>

              <input type="hidden" name="timeframes_present" value="1" />
              <!-- Timeframes -->
              <div class="span-full">
                <label class="form-label">Timeframes</label>
                <div style="display:flex;flex-wrap:wrap;gap:0.375rem;margin-top:0.25rem;">
                  {#each tfOptions as tf}
                    {@const active = tfSel.includes(tf)}
                    <label style="padding:0.25rem 0.625rem;border-radius:0.375rem;border:1px solid {active ? 'var(--accent)' : 'var(--border)'};background:{active ? 'color-mix(in srgb,var(--accent) 15%,transparent)' : 'transparent'};color:{active ? 'var(--accent)' : 'var(--text-muted)'};font-size:0.75rem;font-family:'JetBrains Mono',monospace;cursor:pointer;">
                      <input type="checkbox" name="timeframes" value={tf} checked={active} onchange={() => toggleTf(tf)} style="display:none;" />
                      {tf}
                    </label>
                  {/each}
                </div>
              </div>

              <div class="span-full">
                <label class="form-label">Reason / Setup</label>
                <textarea name="reason" rows="3" placeholder="Why did you take this trade?" class="input" style="resize:vertical;font-family:inherit;">{editTrade?.reason ?? ''}</textarea>
              </div>
              <div class="span-full">
                <label class="form-label">Pre Notes</label>
                <textarea name="pre_notes" rows="3" placeholder="Before entry thoughts…" class="input" style="resize:vertical;font-family:inherit;">{editTrade?.pre_notes ?? ''}</textarea>
              </div>
              <div class="span-full">
                <label class="form-label">Post Notes</label>
                <textarea name="post_notes" rows="3" placeholder="After exit thoughts…" class="input" style="resize:vertical;font-family:inherit;">{editTrade?.post_notes ?? ''}</textarea>
              </div>
            </div>
          {/if}

          <div style="margin-top:1.25rem;padding-top:1.25rem;border-top:1px solid var(--border);display:flex;gap:0.75rem;justify-content:flex-end;">
            <button
              type="button"
              onclick={closeModal}
              style="padding:0.5rem 1rem;border:1px solid var(--border);border-radius:0.5rem;background:transparent;color:var(--text-muted);font-size:0.875rem;cursor:pointer;"
              >Cancel</button
            >
            <button
              type="submit"
              disabled={saving}
              style="padding:0.5rem 1.25rem;background:var(--accent);color:#fff;border:none;border-radius:0.5rem;font-weight:600;font-size:0.875rem;cursor:pointer;"
              >{saving ? 'Saving...' : editTrade ? 'Save Changes' : '+ Add Trade'}</button
            >
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  .selection-mode-row:hover td {
    background: transparent;
  }
</style>
