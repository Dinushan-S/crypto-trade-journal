<script lang="ts">
  import { enhance } from '$app/forms';

  let date = $state(new Date().toISOString().split('T')[0]);
  let coin = $state('');
  let position = $state<'Long' | 'Short' | ''>('');
  let amount_lost = $state<number | null>(null);
  let strategy = $state('');
  let reason = $state('');
  let notes = $state('');
  let loading = $state(false);

  const inputStyle = `padding:0.5rem 0.75rem;background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;color:var(--text-primary);font-size:0.875rem;width:100%;box-sizing:border-box;outline:none;`;
  const labelStyle = `display:block;font-size:0.7rem;font-weight:600;color:var(--text-muted);margin-bottom:0.25rem;text-transform:uppercase;letter-spacing:0.05em;`;
</script>

<svelte:head><title>Add Liquidation — Qulem-Trade</title></svelte:head>

<div style="padding:1.5rem;max-width:600px;">
  <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;">
    <a href="/liquidations" style="color:var(--text-muted);text-decoration:none;font-size:0.875rem;">← Liquidations</a>
    <h1 style="font-family:'JetBrains Mono',monospace;font-size:1.25rem;font-weight:600;color:var(--text-primary);">Log Liquidation</h1>
  </div>

  <form method="POST" use:enhance={() => { loading = true; return async ({ update }) => { loading = false; update(); }; }}>
    <input type="hidden" name="position" value={position} />

    <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1.5rem;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
        <div>
          <label style={labelStyle}>Date</label>
          <input type="date" name="date" bind:value={date} style={inputStyle} required />
        </div>
        <div>
          <label style={labelStyle}>Coin</label>
          <input name="coin" bind:value={coin} placeholder="BTC" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Position</label>
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
          <label style={labelStyle}>Amount Lost ($)</label>
          <input type="number" name="amount_lost" bind:value={amount_lost} step="any" placeholder="500.00" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Strategy</label>
          <input name="strategy" bind:value={strategy} placeholder="e.g. Breakout" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Reason</label>
          <input name="reason" bind:value={reason} placeholder="e.g. No stop loss, overleveraged" style={inputStyle} />
        </div>
        <div style="grid-column:1/-1;">
          <label style={labelStyle}>Notes</label>
          <textarea name="notes" bind:value={notes} rows="3" placeholder="What happened? What did you learn?" style="{inputStyle}resize:vertical;font-family:inherit;"></textarea>
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
