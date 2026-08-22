<script lang="ts">
  import { goto } from '$app/navigation';
  import { untrack } from 'svelte';
  import { formatCurrency, formatDate, periodRange, type Period } from '$lib/utils';

  let { data } = $props();

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
    selectionMode = !selectionMode;
    if (!selectionMode) selectedSet.clear();
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      sortedTrades.forEach((t: any) => selectedSet.add(t.id));
    } else {
      selectedSet.clear();
    }
  }

  function toggleTradeSelect(tradeId: string, checked: boolean) {
    if (checked) selectedSet.add(tradeId);
    else selectedSet.delete(tradeId);
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




  // Summary stats for visible trades
  let totalPnl = $derived(data.trades.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0));
  let wins = $derived(data.trades.filter((t: any) => t.win).length);
  let winRate = $derived(data.trades.length > 0 ? ((wins / data.trades.length) * 100).toFixed(1) : '0.0');

  function applyFilters() {
    selectedSet.clear();
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
    selectedSet.clear();
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
  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;">
    <div>
      <h1
        style="font-family:'JetBrains Mono',monospace;font-size:1.25rem;font-weight:600;color:var(--text-primary);"
      >
        Trade Log
      </h1>
      <p style="color:var(--text-muted);font-size:0.875rem;margin-top:0.125rem;">
        {data.total} total trades
      </p>
    </div>
    <div style="display:flex;gap:0.5rem;">
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
      <a
        href="/trades/new"
        style="padding:0.5rem 0.875rem;background:var(--accent);border:none;border-radius:0.5rem;color:#fff;text-decoration:none;font-size:0.875rem;font-weight:500;display:inline-flex;align-items:center;gap:0.375rem;"
      >
        + New Trade
      </a>
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
          <span style="font-size:0.75rem;color:var(--text-muted);">Coin: {selectedTrades[0].coin}</span>
        {/if}
        {#if mixedFields.positions}
          <span style="font-size:0.75rem;color:var(--loss);border:1px solid var(--loss);padding:0.15rem 0.5rem;border-radius:0.25rem;">Mixed position</span>
        {:else if selectedTrades[0] && selectedTrades[0].position}
          <span style="font-size:0.75rem;color:var(--text-muted);">Pos: {selectedTrades[0].position}</span>
        {/if}
        <span style="font-size:0.8rem;font-weight:600;color:{selectedAmountLost > 0 ? 'var(--loss)' : 'var(--text-muted)'};">
          Net PnL: {formatCurrency(selectedNetPnl)}
        </span>
      </div>
      <div style="display:flex;gap:0.5rem;align-items:center;">
        <a href="/liquidations/new" style="font-size:0.8rem;color:var(--text-muted);text-decoration:underline;cursor:pointer;">Cancel</a>
        <a
          href="/liquidations/new?tradeIds={encodeURIComponent(Array.from(selectedSet).join(','))}"
          style="padding:0.5rem 1rem;background:var(--loss);color:#fff;border:none;border-radius:0.5rem;font-size:0.85rem;font-weight:600;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:0.375rem;"
        >
          Create Liquidation →
        </a>
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
        style="display:block;font-size:0.7rem;color:var(--text-muted);margin-bottom:0.25rem;text-transform:uppercase;letter-spacing:0.05em;"
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
        style="display:block;font-size:0.7rem;color:var(--text-muted);margin-bottom:0.25rem;text-transform:uppercase;letter-spacing:0.05em;"
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
        style="display:block;font-size:0.7rem;color:var(--text-muted);margin-bottom:0.25rem;text-transform:uppercase;letter-spacing:0.05em;"
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
        style="display:block;font-size:0.7rem;color:var(--text-muted);margin-bottom:0.25rem;text-transform:uppercase;letter-spacing:0.05em;"
        >Position</label
      >
      <select
        bind:value={position}
        style="padding:0.375rem 0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:0.375rem;color:var(--text-primary);font-size:0.8rem;"
      >
        <option value="all">All</option>
        <option value="Long">Long</option>
        <option value="Short">Short</option>
      </select>
    </div>
    <div>
      <label
        style="display:block;font-size:0.7rem;color:var(--text-muted);margin-bottom:0.25rem;text-transform:uppercase;letter-spacing:0.05em;"
        >Result</label
      >
      <select
        bind:value={result}
        style="padding:0.375rem 0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:0.375rem;color:var(--text-primary);font-size:0.8rem;"
      >
        <option value="all">All</option>
        <option value="win">Win</option>
        <option value="loss">Loss</option>
        <option value="be">BE</option>
      </select>
    </div>
    <div>
      <label
        style="display:block;font-size:0.7rem;color:var(--text-muted);margin-bottom:0.25rem;text-transform:uppercase;letter-spacing:0.05em;"
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
        style="display:block;font-size:0.7rem;color:var(--text-muted);margin-bottom:0.25rem;text-transform:uppercase;letter-spacing:0.05em;"
        >Source</label
      >
      <select
        bind:value={source}
        style="padding:0.375rem 0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:0.375rem;color:var(--text-primary);font-size:0.8rem;"
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
    style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;overflow:hidden;"
  >
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:0.8125rem;">
        <thead>
          <tr style="background:var(--bg);border-bottom:1px solid var(--border);">
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
          </tr>
        </thead>
        <tbody>
          {#if data.trades.length === 0}
            <tr>
              <td colspan="{selectionMode ? 17 : 16}" style="padding:3rem;text-align:center;color:var(--text-muted);">
                No trades found.
                <a href="/trades/new" style="color:var(--accent);text-decoration:none;"
                  >Add your first trade</a
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
              <td colspan="5"></td>
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
        <span style="font-size:0.8rem;color:var(--text-muted);"
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
</div>

<style>
  .selection-mode-row:hover td {
    background: transparent;
  }
</style>
