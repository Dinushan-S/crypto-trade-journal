<script lang="ts">
  import { enhance } from '$app/forms';

  let type = $state<'deposit' | 'withdrawal'>('deposit');
  let date = $state(new Date().toISOString().split('T')[0]);
  let time = $state(new Date().toTimeString().slice(0, 5));
  let my_bank = $state('');
  let recipient_bank = $state('');
  let sender_bank = $state('');
  let receiver_bank = $state('');
  let fiat_sent = $state<number | null>(null);
  let usd_fee = $state<number>(0);
  let usd_rate = $state<number | null>(null);
  let usd_received = $state<number | null>(null);
  let usd_quantity = $state<number | null>(null);
  let fee = $state<number>(0.07);
  let fiat_amount = $state<number | null>(null);
  let notes = $state('');
  let loading = $state(false);

  // Live computed previews
  let lkrTotalSent = $derived((fiat_sent ?? 0) + (usd_fee * (usd_rate ?? 0)));
  let usdReleased = $derived((usd_quantity ?? 0) - fee);
  let expectedFiat = $derived(usdReleased * (usd_rate ?? 0));
  let effectiveRate = $derived(usd_received && fiat_sent ? fiat_sent / usd_received : null);

  const inputStyle = `padding:0.5rem 0.75rem;background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;color:var(--text-primary);font-size:0.875rem;width:100%;box-sizing:border-box;outline:none;`;
  const labelStyle = `display:block;font-size:0.7rem;font-weight:600;color:var(--text-muted);margin-bottom:0.25rem;text-transform:uppercase;letter-spacing:0.05em;`;
  const computedStyle = `padding:0.5rem 0.75rem;background:color-mix(in srgb,var(--accent) 8%,transparent);border:1px solid color-mix(in srgb,var(--accent) 30%,transparent);border-radius:0.5rem;color:var(--accent);font-size:0.875rem;width:100%;box-sizing:border-box;font-family:'JetBrains Mono',monospace;`;
</script>

<svelte:head><title>Add Ledger Entry — Qulem-Trade</title></svelte:head>

<div style="padding:1.5rem;max-width:700px;">
  <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;">
    <a href="/ledger" style="color:var(--text-muted);text-decoration:none;font-size:0.875rem;">← Ledger</a>
    <h1 style="font-family:'JetBrains Mono',monospace;font-size:1.25rem;font-weight:600;color:var(--text-primary);">Add Entry</h1>
  </div>

  <form method="POST" use:enhance={() => { loading = true; return async ({ update }) => { loading = false; update(); }; }}>
    <input type="hidden" name="type" value={type} />

    <!-- Type toggle -->
    <div style="display:inline-flex;background:var(--surface);border:1px solid var(--border);border-radius:0.5rem;padding:0.25rem;margin-bottom:1.5rem;">
      {#each (['deposit', 'withdrawal'] as const) as t}
        <button type="button" onclick={() => type = t} style="padding:0.5rem 1.25rem;border-radius:0.375rem;border:none;cursor:pointer;font-size:0.875rem;font-weight:500;transition:all 0.15s;
          background:{type === t ? (t === 'deposit' ? 'var(--win)' : 'var(--loss)') : 'transparent'};
          color:{type === t ? '#fff' : 'var(--text-muted)'};">
          {t === 'deposit' ? '↓ Deposit' : '↑ Withdrawal'}
        </button>
      {/each}
    </div>

    <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1.5rem;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
        <div>
          <label style={labelStyle}>Date</label>
          <input type="date" name="date" bind:value={date} style={inputStyle} required />
        </div>
        <div>
          <label style={labelStyle}>Time</label>
          <input type="time" name="time" bind:value={time} style={inputStyle} />
        </div>

        {#if type === 'deposit'}
          <div>
            <label style={labelStyle}>My Bank</label>
            <input name="my_bank" bind:value={my_bank} placeholder="e.g. BOC" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Recipient (P2P)</label>
            <input name="recipient_bank" bind:value={recipient_bank} placeholder="Counterparty name" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>LKR Sent</label>
            <input type="number" name="fiat_sent" bind:value={fiat_sent} step="any" placeholder="5000" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>USD Fee ($)</label>
            <input type="number" name="usd_fee" bind:value={usd_fee} step="any" placeholder="0" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Rate (LKR/USDT)</label>
            <input type="number" name="usd_rate" bind:value={usd_rate} step="any" placeholder="320" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>USD Received</label>
            <input type="number" name="usd_received" bind:value={usd_received} step="any" placeholder="15.62" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Total LKR Sent (computed)</label>
            <div style={computedStyle}>{lkrTotalSent.toLocaleString('en-US', {maximumFractionDigits:2})}</div>
          </div>
          <div>
            <label style={labelStyle}>Effective Rate (computed)</label>
            <div style={computedStyle}>{effectiveRate?.toFixed(2) ?? '—'}</div>
          </div>
        {:else}
          <div>
            <label style={labelStyle}>Sender (P2P)</label>
            <input name="sender_bank" bind:value={sender_bank} placeholder="Counterparty name" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Receiver Bank</label>
            <input name="receiver_bank" bind:value={receiver_bank} placeholder="e.g. ComBank" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>USD Quantity</label>
            <input type="number" name="usd_quantity" bind:value={usd_quantity} step="any" placeholder="50" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Fee (USDT)</label>
            <input type="number" name="fee" bind:value={fee} step="any" placeholder="0.07" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Rate (LKR/USDT)</label>
            <input type="number" name="usd_rate" bind:value={usd_rate} step="any" placeholder="320" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Actual LKR Received</label>
            <input type="number" name="fiat_amount" bind:value={fiat_amount} step="any" placeholder="15990" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>USD Released (computed)</label>
            <div style={computedStyle}>${usdReleased.toFixed(4)}</div>
          </div>
          <div>
            <label style={labelStyle}>Expected LKR (computed)</label>
            <div style={computedStyle}>{expectedFiat.toLocaleString('en-US', {maximumFractionDigits:0})}</div>
          </div>
        {/if}

        <div style="grid-column:1/-1;">
          <label style={labelStyle}>Notes</label>
          <textarea name="notes" bind:value={notes} rows="2" placeholder="Optional notes…" style="{inputStyle}resize:vertical;font-family:inherit;"></textarea>
        </div>
      </div>

      <div style="margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid var(--border);display:flex;gap:0.75rem;">
        <button type="submit" disabled={loading || !date} style="padding:0.625rem 1.5rem;background:var(--accent);color:#fff;border:none;border-radius:0.5rem;font-weight:600;font-size:0.875rem;cursor:pointer;opacity:{loading || !date ? 0.5 : 1};">
          {loading ? 'Saving…' : '+ Add Entry'}
        </button>
        <a href="/ledger" style="padding:0.625rem 1rem;border:1px solid var(--border);border-radius:0.5rem;background:transparent;color:var(--text-muted);font-size:0.875rem;text-decoration:none;display:inline-flex;align-items:center;">Cancel</a>
      </div>
    </div>
  </form>
</div>
