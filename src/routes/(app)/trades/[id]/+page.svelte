<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { enhance } from '$app/forms';
  import { formatCurrency, formatDate } from '$lib/utils';

  let { data, form } = $props();
  let editing = $state(false);
  let saving = $state(false);
  let showDeleteConfirm = $state(false);

  const trade = $derived(data.trade as any);

  $effect(() => {
    if (form?.deleted) goto('/trades');
    if (form?.success) {
      editing = false;
    }
  });

  const inputStyle = 'padding:0.4rem 0.625rem;background:var(--bg);border:1px solid var(--accent);border-radius:0.375rem;color:var(--text-primary);font-size:0.875rem;width:100%;box-sizing:border-box;outline:none;font-family:inherit;';

  const editFields: [string, string, string][] = [
    ['Coin', 'coin', 'text'],
    ['Position', 'position', 'text'],
    ['Date', 'date', 'date'],
    ['Time', 'time', 'time'],
    ['Entry Price', 'entry_price', 'number'],
    ['Exit Price', 'exit_price', 'number'],
    ['Stop Loss', 'stop_loss', 'number'],
    ['PnL', 'pnl', 'number'],
    ['Fee', 'fee', 'number'],
    ['Quantity', 'quantity', 'number'],
    ['Strategy', 'strategy', 'text'],
    ['Leverage', 'leverage', 'text'],
    ['Confidence', 'confidence', 'number'],
    ['Risk %', 'risk_pct', 'number'],
    ['Range %', 'range_pct', 'number'],
    ['Limit Type', 'limit_type', 'text'],
    ['Duration', 'duration', 'text'],
    ['Date Closed', 'date_closed', 'date'],
    ['Closed Reason', 'closed_reason', 'text'],
  ];

  const textareaFields: [string, string][] = [
    ['Reason', 'reason'],
    ['Pre Notes', 'pre_notes'],
    ['Post Notes', 'post_notes'],
  ];

  const timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'];

  const detailRows = $derived<[string, string | null | undefined][]>([
    ['Strategy', trade.strategy],
    ['Timeframes', trade.timeframes?.join(', ')],
    ['Leverage', trade.leverage],
    ['Risk %', trade.risk_pct != null ? `${trade.risk_pct}%` : null],
    ['Range %', trade.range_pct != null ? `${trade.range_pct}%` : null],
    ['Quantity', trade.quantity],
    ['Fee', trade.fee != null ? `$${trade.fee}` : null],
    ['Duration', trade.duration],
    ['Date Closed', formatDate(trade.date_closed)],
    ['Closed Reason', trade.closed_reason],
    ['Limit Type', trade.limit_type],
    ['Order ID', trade.order_id],
  ]);
</script>

<svelte:head><title>{trade.coin} Trade — Qulem-Trade</title></svelte:head>

<div style="padding:1.5rem;max-width:900px;">
  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:0.75rem;">
    <div style="display:flex;align-items:center;gap:1rem;">
      <a href="/trades" style="color:var(--text-muted);text-decoration:none;font-size:0.875rem;">← Trades</a>
      <div>
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <h1 style="font-family:'JetBrains Mono',monospace;font-size:1.5rem;font-weight:700;color:var(--text-primary);">{trade.coin}</h1>
          <span style="padding:0.25rem 0.625rem;border-radius:0.375rem;font-size:0.8rem;font-weight:700;
            background:{trade.position === 'Long' ? 'color-mix(in srgb,var(--win) 15%,transparent)' : 'color-mix(in srgb,var(--loss) 15%,transparent)'};
            color:{trade.position === 'Long' ? 'var(--win)' : 'var(--loss)'};">
            {trade.position}
          </span>
          {#if trade.win}
            <span style="padding:0.25rem 0.625rem;border-radius:0.375rem;font-size:0.75rem;font-weight:700;background:color-mix(in srgb,var(--win) 15%,transparent);color:var(--win);">WIN</span>
          {:else if trade.loss}
            <span style="padding:0.25rem 0.625rem;border-radius:0.375rem;font-size:0.75rem;font-weight:700;background:color-mix(in srgb,var(--loss) 15%,transparent);color:var(--loss);">LOSS</span>
          {:else if trade.be}
            <span style="padding:0.25rem 0.625rem;border-radius:0.375rem;font-size:0.75rem;font-weight:700;background:color-mix(in srgb,var(--text-muted) 15%,transparent);color:var(--text-muted);">BE</span>
          {/if}
        </div>
        <p style="color:var(--text-muted);font-size:0.8rem;margin-top:0.125rem;">{formatDate(trade.date)} · {trade.source === 'futures_import' ? '📥 Imported' : '✏️ Manual'}</p>
      </div>
    </div>
    <div style="display:flex;gap:0.5rem;align-items:center;">
      <a href="/mistakes/new?trade_id={trade.id}" style="padding:0.5rem 0.875rem;border:1px solid var(--accent);border-radius:0.5rem;background:color-mix(in srgb, var(--accent) 12%, transparent);color:var(--accent);font-size:0.875rem;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:0.375rem;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M3.88 18.88 10.94 4.76a1.2 1.2 0 0 1 2.12 0l7.06 14.12A1.2 1.2 0 0 1 19.06 20.5H4.94a1.2 1.2 0 0 1-1.06-1.62z"/></svg>
        Log Mistake
      </a>
      <button onclick={() => editing = !editing} style="padding:0.5rem 0.875rem;border:1px solid var(--border);border-radius:0.5rem;background:transparent;color:var(--text-muted);font-size:0.875rem;cursor:pointer;">
        {editing ? '✕ Cancel' : '✏️ Edit'}
      </button>
      <button onclick={() => showDeleteConfirm = true} style="padding:0.5rem 0.875rem;border:1px solid var(--loss);border-radius:0.5rem;background:transparent;color:var(--loss);font-size:0.875rem;cursor:pointer;">
        Delete
      </button>
    </div>
  </div>

  <!-- Delete confirm modal -->
  {#if showDeleteConfirm}
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:50;">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1.5rem;max-width:400px;width:90%;">
        <h2 style="font-family:'JetBrains Mono',monospace;font-size:1rem;color:var(--text-primary);margin-bottom:0.75rem;">Delete Trade?</h2>
        <p style="color:var(--text-muted);font-size:0.875rem;margin-bottom:1.25rem;">This will permanently delete the {trade.coin} trade. This cannot be undone.</p>
        <div style="display:flex;gap:0.75rem;">
          <form method="POST" action="?/delete" use:enhance>
            <button type="submit" style="padding:0.5rem 1rem;background:var(--loss);color:#fff;border:none;border-radius:0.5rem;font-size:0.875rem;font-weight:600;cursor:pointer;">Delete</button>
          </form>
          <button onclick={() => showDeleteConfirm = false} style="padding:0.5rem 1rem;border:1px solid var(--border);border-radius:0.5rem;background:transparent;color:var(--text-muted);font-size:0.875rem;cursor:pointer;">Cancel</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- PnL hero -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1.25rem;margin-bottom:1rem;display:flex;gap:2rem;flex-wrap:wrap;">
    <div>
      <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;">PnL</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:1.75rem;font-weight:700;color:{trade.pnl == null ? 'var(--text-muted)' : trade.pnl > 0 ? 'var(--win)' : trade.pnl < 0 ? 'var(--loss)' : 'var(--text-muted)'};">
        {formatCurrency(trade.pnl)}
      </div>
    </div>
    {#if trade.entry_price}
      <div>
        <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;">Entry</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:1.5rem;font-weight:600;color:var(--text-primary);">{trade.entry_price}</div>
      </div>
    {/if}
    {#if trade.stop_loss}
      <div>
        <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;">Stop Loss</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:1.5rem;font-weight:600;color:var(--loss);">{trade.stop_loss}</div>
      </div>
    {/if}
    {#if trade.exit_price}
      <div>
        <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;">Exit Price</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:1.5rem;font-weight:600;color:var(--text-primary);">{trade.exit_price}</div>
      </div>
    {/if}
    {#if trade.confidence}
      <div>
        <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;">Confidence</div>
        <div style="font-size:1.25rem;">{'★'.repeat(trade.confidence)}{'☆'.repeat(5 - trade.confidence)}</div>
      </div>
    {/if}
  </div>

  <!-- Edit form or detail view -->
  {#if editing}
    <form method="POST" action="?/update" use:enhance={() => {
      saving = true;
      return async ({ update }) => {
        saving = false;
        await update();
        await invalidateAll();
      };
    }}>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1.5rem;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
          {#each editFields as [label, name, type]}
            <div>
              <label style="display:block;font-size:0.7rem;font-weight:600;color:var(--text-muted);margin-bottom:0.25rem;text-transform:uppercase;letter-spacing:0.05em;">{label}</label>
              <input {type} {name} value={trade[name] ?? ''} style={inputStyle} />
            </div>
          {/each}
        </div>

        <!-- Timeframes -->
        <div style="margin-bottom:1rem;">
          <div style="font-size:0.7rem;font-weight:600;color:var(--text-muted);margin-bottom:0.5rem;text-transform:uppercase;letter-spacing:0.05em;">Timeframes</div>
          <div style="display:flex;flex-wrap:wrap;gap:0.375rem;">
            {#each timeframes as tf}
              {@const active = (trade.timeframes ?? []).includes(tf)}
              <label style="padding:0.25rem 0.625rem;border-radius:0.375rem;border:1px solid {active ? 'var(--accent)' : 'var(--border)'};background:{active ? 'color-mix(in srgb,var(--accent) 15%,transparent)' : 'transparent'};color:{active ? 'var(--accent)' : 'var(--text-muted)'};font-size:0.75rem;font-family:'JetBrains Mono',monospace;cursor:pointer;">
                <input type="checkbox" name="timeframes" value={tf} checked={active} style="display:none;" />
                {tf}
              </label>
            {/each}
          </div>
        </div>

        <!-- Textareas -->
        {#each textareaFields as [label, name]}
          <div style="margin-bottom:1rem;">
            <label style="display:block;font-size:0.7rem;font-weight:600;color:var(--text-muted);margin-bottom:0.25rem;text-transform:uppercase;letter-spacing:0.05em;">{label}</label>
            <textarea {name} rows="3" style="{inputStyle}resize:vertical;">{trade[name] ?? ''}</textarea>
          </div>
        {/each}

        <div style="display:flex;gap:0.75rem;padding-top:1rem;border-top:1px solid var(--border);">
          <button type="submit" disabled={saving} style="padding:0.625rem 1.25rem;background:var(--accent);color:#fff;border:none;border-radius:0.5rem;font-weight:600;font-size:0.875rem;cursor:pointer;opacity:{saving ? 0.5 : 1};">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button type="button" onclick={() => editing = false} style="padding:0.625rem 1rem;border:1px solid var(--border);border-radius:0.5rem;background:transparent;color:var(--text-muted);font-size:0.875rem;cursor:pointer;">Cancel</button>
        </div>
      </div>
    </form>
  {:else}
    <!-- Read-only detail view -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1.5rem;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">
        {#each detailRows as [label, val]}
          <div>
            <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;">{label}</div>
            <div style="font-size:0.875rem;color:{val ? 'var(--text-primary)' : 'var(--text-muted)'};">{val ?? '—'}</div>
          </div>
        {/each}
      </div>

      {#if trade.reason}
        <div style="margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid var(--border);">
          <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">Reason / Setup</div>
          <p style="font-size:0.875rem;color:var(--text-primary);line-height:1.6;white-space:pre-wrap;">{trade.reason}</p>
        </div>
      {/if}
      {#if trade.pre_notes}
        <div style="margin-top:1.25rem;">
          <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">Pre Notes</div>
          <p style="font-size:0.875rem;color:var(--text-primary);line-height:1.6;white-space:pre-wrap;">{trade.pre_notes}</p>
        </div>
      {/if}
      {#if trade.post_notes}
        <div style="margin-top:1.25rem;">
          <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">Post Notes</div>
          <p style="font-size:0.875rem;color:var(--text-primary);line-height:1.6;white-space:pre-wrap;">{trade.post_notes}</p>
        </div>
      {/if}
    </div>
  {/if}
</div>
