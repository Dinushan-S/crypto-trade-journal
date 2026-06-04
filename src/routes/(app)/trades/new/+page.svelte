<script lang="ts">
  import { goto } from '$app/navigation';
  import { createSupabaseClient } from '$lib/supabase';
  import { user } from '$lib/stores/auth';

  const supabase = createSupabaseClient();

  let mode = $state<'quick' | 'full'>('quick');
  let loading = $state(false);
  let error = $state('');

  // Form fields
  let coin = $state('');
  let position = $state<'Long' | 'Short'>('Long');
  let date = $state(new Date().toISOString().split('T')[0]);
  let time = $state(new Date().toTimeString().slice(0, 5));
  let entry_price = $state<number | null>(null);
  let stop_loss = $state<number | null>(null);
  let quantity = $state<number | null>(null);
  let pnl = $state<number | null>(null);
  let fee = $state<number | null>(null);
  let date_closed = $state('');
  let duration = $state('');
  let strategy = $state('');
  let leverage = $state('');
  let confidence = $state<number | null>(null);
  let risk_pct = $state<number | null>(null);
  let range_pct = $state<number | null>(null);
  let limit_type = $state('');
  let reason = $state('');
  let pre_notes = $state('');
  let post_notes = $state('');

  // Win/Loss/BE (auto from PnL but overridable)
  let win = $state(false);
  let loss = $state(false);
  let be = $state(false);
  let resultOverridden = $state(false);

  // Timeframes multi-select
  const tfOptions = ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'];
  let selectedTf = $state<string[]>([]);

  function toggleTf(tf: string) {
    selectedTf = selectedTf.includes(tf)
      ? selectedTf.filter(t => t !== tf)
      : [...selectedTf, tf];
  }

  // Auto-set result from PnL
  $effect(() => {
    if (!resultOverridden && pnl !== null) {
      if (pnl > 0) { win = true; loss = false; be = false; }
      else if (pnl < 0) { win = false; loss = true; be = false; }
      else { win = false; loss = false; be = true; }
    }
  });

  async function submit() {
    if (!coin.trim() || !date) { error = 'Coin and date are required.'; return; }
    loading = true;
    error = '';
    const { error: err } = await supabase.from('trades').insert({
      user_id: $user?.id,
      coin: coin.trim().toUpperCase(),
      position,
      date,
      time: time || null,
      entry_price: entry_price ?? null,
      stop_loss: stop_loss ?? null,
      quantity: quantity ?? null,
      pnl: pnl ?? null,
      fee: fee ?? null,
      date_closed: date_closed || null,
      duration: duration || null,
      strategy: strategy || null,
      timeframes: selectedTf.length > 0 ? selectedTf : null,
      leverage: leverage || null,
      confidence: confidence ?? null,
      risk_pct: risk_pct ?? null,
      range_pct: range_pct ?? null,
      limit_type: limit_type || null,
      reason: reason || null,
      pre_notes: pre_notes || null,
      post_notes: post_notes || null,
      win,
      loss,
      be,
      source: 'manual'
    });
    if (err) { error = err.message; loading = false; return; }
    goto('/trades');
  }

  const inputStyle = `padding:0.5rem 0.75rem;background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;color:var(--text-primary);font-size:0.875rem;width:100%;box-sizing:border-box;outline:none;`;
  const labelStyle = `display:block;font-size:0.7rem;font-weight:600;color:var(--text-muted);margin-bottom:0.25rem;text-transform:uppercase;letter-spacing:0.05em;`;
</script>

<svelte:head><title>New Trade — Qulem-Trade</title></svelte:head>

<div style="padding:1.5rem;max-width:960px;">
  <!-- Header -->
  <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;">
    <a href="/trades" style="color:var(--text-muted);text-decoration:none;font-size:0.875rem;">← Back</a>
    <h1 style="font-family:'JetBrains Mono',monospace;font-size:1.25rem;font-weight:600;color:var(--text-primary);">Add Trade</h1>
  </div>

  <!-- Mode toggle -->
  <div style="display:inline-flex;background:var(--surface);border:1px solid var(--border);border-radius:0.5rem;padding:0.25rem;margin-bottom:1.5rem;">
    {#each (['quick', 'full'] as const) as m}
      <button
        onclick={() => mode = m}
        style="padding:0.375rem 1rem;border-radius:0.375rem;border:none;cursor:pointer;font-size:0.875rem;font-weight:500;transition:all 0.15s;
          background:{mode === m ? 'var(--accent)' : 'transparent'};
          color:{mode === m ? '#fff' : 'var(--text-muted)'};">
        {m === 'quick' ? '⚡ Quick' : '📋 Full'}
      </button>
    {/each}
  </div>

  {#if error}
    <div style="background:color-mix(in srgb,var(--loss) 15%,transparent);border:1px solid var(--loss);border-radius:0.5rem;padding:0.75rem;margin-bottom:1rem;color:var(--loss);font-size:0.875rem;">
      {error}
    </div>
  {/if}

  <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1.5rem;">
    {#if mode === 'quick'}
      <!-- QUICK MODE -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;max-width:480px;">
        <div style="grid-column:1/-1;">
          <label style={labelStyle}>Coin</label>
          <input bind:value={coin} placeholder="BTC" style={inputStyle} />
        </div>
        <div style="grid-column:1/-1;">
          <label style={labelStyle}>Position</label>
          <div style="display:flex;gap:0.5rem;">
            {#each (['Long', 'Short'] as const) as p}
              <button
                onclick={() => position = p}
                style="flex:1;padding:0.5rem;border-radius:0.5rem;border:2px solid {position === p ? (p === 'Long' ? 'var(--win)' : 'var(--loss)') : 'var(--border)'};background:{position === p ? (p === 'Long' ? 'color-mix(in srgb,var(--win) 15%,transparent)' : 'color-mix(in srgb,var(--loss) 15%,transparent)') : 'transparent'};color:{position === p ? (p === 'Long' ? 'var(--win)' : 'var(--loss)') : 'var(--text-muted)'};font-weight:600;cursor:pointer;transition:all 0.15s;">
                {p === 'Long' ? '▲ Long' : '▼ Short'}
              </button>
            {/each}
          </div>
        </div>
        <div>
          <label style={labelStyle}>Entry Price</label>
          <input type="number" bind:value={entry_price} placeholder="0.00" step="any" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>PnL ($)</label>
          <input type="number" bind:value={pnl} placeholder="+0.00" step="any" style="{inputStyle}color:{pnl == null ? 'var(--text-primary)' : pnl > 0 ? 'var(--win)' : pnl < 0 ? 'var(--loss)' : 'var(--text-muted)'};" />
        </div>
        <div>
          <label style={labelStyle}>Date</label>
          <input type="date" bind:value={date} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Time</label>
          <input type="time" bind:value={time} style={inputStyle} />
        </div>
      </div>
    {:else}
      <!-- FULL MODE -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;">
        <!-- Column 1 -->
        <div style="display:flex;flex-direction:column;gap:1rem;">
          <div>
            <label style={labelStyle}>Coin</label>
            <input bind:value={coin} placeholder="BTC" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Position</label>
            <div style="display:flex;gap:0.5rem;">
              {#each (['Long', 'Short'] as const) as p}
                <button onclick={() => position = p} style="flex:1;padding:0.5rem;border-radius:0.5rem;border:2px solid {position === p ? (p === 'Long' ? 'var(--win)' : 'var(--loss)') : 'var(--border)'};background:{position === p ? (p === 'Long' ? 'color-mix(in srgb,var(--win) 15%,transparent)' : 'color-mix(in srgb,var(--loss) 15%,transparent)') : 'transparent'};color:{position === p ? (p === 'Long' ? 'var(--win)' : 'var(--loss)') : 'var(--text-muted)'};font-weight:600;cursor:pointer;transition:all 0.15s;">
                  {p === 'Long' ? '▲ Long' : '▼ Short'}
                </button>
              {/each}
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" bind:value={date} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Time</label>
              <input type="time" bind:value={time} style={inputStyle} />
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
            <div>
              <label style={labelStyle}>Entry Price</label>
              <input type="number" bind:value={entry_price} step="any" placeholder="0.00" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Stop Loss</label>
              <input type="number" bind:value={stop_loss} step="any" placeholder="0.00" style={inputStyle} />
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
            <div>
              <label style={labelStyle}>Quantity</label>
              <input type="number" bind:value={quantity} step="any" placeholder="0" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>PnL ($)</label>
              <input type="number" bind:value={pnl} step="any" placeholder="+0.00" style="{inputStyle}color:{pnl == null ? 'var(--text-primary)' : pnl > 0 ? 'var(--win)' : pnl < 0 ? 'var(--loss)' : 'var(--text-muted)'};" />
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
            <div>
              <label style={labelStyle}>Fee ($)</label>
              <input type="number" bind:value={fee} step="any" placeholder="0.00" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Date Closed</label>
              <input type="date" bind:value={date_closed} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Duration</label>
            <input bind:value={duration} placeholder="e.g. 2h 30m" style={inputStyle} />
          </div>
        </div>

        <!-- Column 2 -->
        <div style="display:flex;flex-direction:column;gap:1rem;">
          <div>
            <label style={labelStyle}>Strategy</label>
            <input bind:value={strategy} placeholder="e.g. Breakout, Retest" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Timeframes</label>
            <div style="display:flex;flex-wrap:wrap;gap:0.375rem;margin-top:0.25rem;">
              {#each tfOptions as tf}
                <button
                  onclick={() => toggleTf(tf)}
                  style="padding:0.25rem 0.625rem;border-radius:0.375rem;border:1px solid {selectedTf.includes(tf) ? 'var(--accent)' : 'var(--border)'};background:{selectedTf.includes(tf) ? 'color-mix(in srgb,var(--accent) 15%,transparent)' : 'transparent'};color:{selectedTf.includes(tf) ? 'var(--accent)' : 'var(--text-muted)'};font-size:0.75rem;font-family:'JetBrains Mono',monospace;cursor:pointer;transition:all 0.15s;">
                  {tf}
                </button>
              {/each}
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
            <div>
              <label style={labelStyle}>Leverage</label>
              <input bind:value={leverage} placeholder="e.g. 10x" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Confidence (1-5)</label>
              <div style="display:flex;gap:0.25rem;margin-top:0.375rem;">
                {#each [1,2,3,4,5] as n}
                  <button onclick={() => confidence = confidence === n ? null : n} style="width:2rem;height:2rem;border-radius:0.375rem;border:1px solid {(confidence ?? 0) >= n ? 'var(--accent)' : 'var(--border)'};background:{(confidence ?? 0) >= n ? 'var(--accent)' : 'transparent'};color:{(confidence ?? 0) >= n ? '#fff' : 'var(--text-muted)'};font-size:0.8rem;font-weight:600;cursor:pointer;transition:all 0.15s;">{n}</button>
                {/each}
              </div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
            <div>
              <label style={labelStyle}>Risk %</label>
              <input type="number" bind:value={risk_pct} step="any" placeholder="1.0" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Range %</label>
              <input type="number" bind:value={range_pct} step="any" placeholder="2.5" style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Limit Type</label>
            <input bind:value={limit_type} placeholder="Limit / Market / Stop" style={inputStyle} />
          </div>
          <!-- Result override -->
          <div>
            <label style={labelStyle}>Result (auto from PnL)</label>
            <div style="display:flex;gap:0.5rem;">
              {#each ([['Win', true, false, false], ['Loss', false, true, false], ['BE', false, false, true]] as const) as [label, w, l, b]}
                <button
                  onclick={() => { win = w; loss = l; be = b; resultOverridden = true; }}
                  style="flex:1;padding:0.375rem;border-radius:0.375rem;border:1px solid {(label === 'Win' && win) || (label === 'Loss' && loss) || (label === 'BE' && be) ? (label === 'Win' ? 'var(--win)' : label === 'Loss' ? 'var(--loss)' : 'var(--border)') : 'var(--border)'};background:{(label === 'Win' && win) ? 'color-mix(in srgb,var(--win) 15%,transparent)' : (label === 'Loss' && loss) ? 'color-mix(in srgb,var(--loss) 15%,transparent)' : 'transparent'};color:{label === 'Win' ? 'var(--win)' : label === 'Loss' ? 'var(--loss)' : 'var(--text-muted)'};font-size:0.75rem;font-weight:600;cursor:pointer;transition:all 0.15s;">
                  {label}
                </button>
              {/each}
            </div>
          </div>
        </div>

        <!-- Full-width textareas -->
        <div style="grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;">
          <div>
            <label style={labelStyle}>Reason / Setup</label>
            <textarea bind:value={reason} rows={3} placeholder="Why did you take this trade?" style="{inputStyle}resize:vertical;font-family:inherit;"></textarea>
          </div>
          <div>
            <label style={labelStyle}>Pre Notes</label>
            <textarea bind:value={pre_notes} rows={3} placeholder="Before entry thoughts…" style="{inputStyle}resize:vertical;font-family:inherit;"></textarea>
          </div>
          <div>
            <label style={labelStyle}>Post Notes</label>
            <textarea bind:value={post_notes} rows={3} placeholder="After exit thoughts…" style="{inputStyle}resize:vertical;font-family:inherit;"></textarea>
          </div>
        </div>
      </div>
    {/if}

    <!-- Submit -->
    <div style="margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid var(--border);display:flex;gap:0.75rem;">
      <button
        onclick={submit}
        disabled={loading || !coin}
        style="padding:0.625rem 1.5rem;background:var(--accent);color:#fff;border:none;border-radius:0.5rem;font-weight:600;font-size:0.875rem;cursor:pointer;opacity:{loading || !coin ? 0.5 : 1};transition:opacity 0.15s;">
        {loading ? 'Saving…' : '+ Add Trade'}
      </button>
      <a href="/trades" style="padding:0.625rem 1rem;background:transparent;color:var(--text-muted);border:1px solid var(--border);border-radius:0.5rem;font-size:0.875rem;text-decoration:none;display:inline-flex;align-items:center;">
        Cancel
      </a>
    </div>
  </div>
</div>
