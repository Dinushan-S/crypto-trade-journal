<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { enhance } from '$app/forms';
  import { formatDate } from '$lib/utils';

  let { data, form } = $props();
  let editing = $state(false);
  let saving = $state(false);
  let showDeleteConfirm = $state(false);

  const entry = $derived(data.entry as any);
  const isDeposit = entry?.type === 'deposit';

  $effect(() => {
    if (form?.deleted) goto('/ledger');
    if (form?.success) {
      editing = false;
    }
  });

  // Computed values for display
  function lkrTotalSent(e: any) {
    return (e.fiat_sent ?? 0) + ((e.usd_fee ?? 0) * (e.usd_rate ?? 0));
  }
  function usdReleased(e: any) {
    return (e.usd_quantity ?? 0) - (e.fee ?? 0.07);
  }
  function expectedFiat(e: any) {
    return usdReleased(e) * (e.usd_rate ?? 0);
  }
  function effectiveRate(e: any) {
    if (!e.usd_received || !e.fiat_sent) return null;
    return e.fiat_sent / e.usd_received;
  }

  const inputStyle = 'padding:0.4rem 0.625rem;background:var(--bg);border:1px solid var(--accent);border-radius:0.375rem;color:var(--text-primary);font-size:0.875rem;width:100%;box-sizing:border-box;outline:none;font-family:inherit;';
  const labelStyle = 'display:block;font-size:0.7rem;font-weight:600;color:var(--text-muted);margin-bottom:0.25rem;text-transform:uppercase;letter-spacing:0.05em;';
  const computedStyle = 'padding:0.5rem 0.75rem;background:color-mix(in srgb,var(--accent) 8%,transparent);border:1px solid color-mix(in srgb,var(--accent) 30%,transparent);border-radius:0.5rem;color:var(--accent);font-size:0.875rem;width:100%;box-sizing:border-box;font-family:"JetBrains Mono",monospace;';

  const depositFields: [string, string, string][] = [
    ['Date', 'date', 'date'],
    ['Time', 'time', 'time'],
    ['My Bank', 'my_bank', 'text'],
    ['Recipient (P2P)', 'recipient_bank', 'text'],
    ['LKR Sent', 'fiat_sent', 'number'],
    ['USD Fee ($)', 'usd_fee', 'number'],
    ['Rate (LKR/USDT)', 'usd_rate', 'number'],
    ['USD Received', 'usd_received', 'number'],
  ];

  const withdrawalFields: [string, string, string][] = [
    ['Date', 'date', 'date'],
    ['Time', 'time', 'time'],
    ['Sender (P2P)', 'sender_bank', 'text'],
    ['Receiver Bank', 'receiver_bank', 'text'],
    ['USD Quantity', 'usd_quantity', 'number'],
    ['Fee (USDT)', 'fee', 'number'],
    ['Rate (LKR/USDT)', 'usd_rate', 'number'],
    ['Actual LKR Received', 'fiat_amount', 'number'],
  ];

  const detailRows = $derived<[string, string | null | undefined][]>([
    ['Type', entry.type ? (isDeposit ? '↓ Deposit' : '↑ Withdrawal') : null],
    ['Date', formatDate(entry.date)],
    ['Time', entry.time ?? null],
    ...(isDeposit ? [
      ['My Bank', entry.my_bank ?? null],
      ['Recipient (P2P)', entry.recipient_bank ?? entry.counterparty ?? null],
      ['LKR Sent', entry.fiat_sent != null ? entry.fiat_sent.toLocaleString('en-US') : null],
      ['Bank Fee', entry.usd_fee != null ? `$${entry.usd_fee}` : null],
      ['Total LKR Sent', lkrTotalSent(entry).toLocaleString('en-US', {maximumFractionDigits:2})],
      ['USD Received', entry.usd_received != null ? `$${entry.usd_received.toFixed(2)}` : null],
      ['Rate', entry.usd_rate != null ? entry.usd_rate.toFixed(2) : null],
      ['Eff. Rate', effectiveRate(entry) != null ? effectiveRate(entry)?.toFixed(2) : null],
    ] : [
      ['Sender (P2P)', entry.sender_bank ?? entry.counterparty ?? null],
      ['Receiver Bank', entry.receiver_bank ?? null],
      ['USD Quantity', entry.usd_quantity != null ? `$${entry.usd_quantity.toFixed(2)}` : null],
      ['Fee', entry.fee != null ? entry.fee.toString() : null],
      ['Released USD', usdReleased(entry).toFixed(2)],
      ['Rate', entry.usd_rate != null ? entry.usd_rate.toFixed(2) : null],
      ['Expected LKR', expectedFiat(entry).toLocaleString('en-US', {maximumFractionDigits:0})],
      ['Actual LKR', entry.fiat_amount != null ? entry.fiat_amount.toLocaleString('en-US') : null],
    ]),
    ['Source', entry.source === 'c2c_import' ? '📥 Import' : '✏️ Manual'],
    ['Order Number', entry.order_number ?? null],
  ]);
</script>

<svelte:head><title>{isDeposit ? 'Deposit' : 'Withdrawal'} — Qulem-Trade</title></svelte:head>

<div style="padding:1.5rem;max-width:900px;">
  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:0.75rem;">
    <div style="display:flex;align-items:center;gap:1rem;">
      <a href="/ledger" style="color:var(--text-muted);text-decoration:none;font-size:0.875rem;">← Ledger</a>
      <div>
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <h1 style="font-family:'JetBrains Mono',monospace;font-size:1.5rem;font-weight:700;color:var(--text-primary);">
            {isDeposit ? '↓ Deposit' : '↑ Withdrawal'}
          </h1>
          <span style="padding:0.25rem 0.625rem;border-radius:0.375rem;font-size:0.8rem;font-weight:700;
            background:{isDeposit ? 'color-mix(in srgb,var(--win) 15%,transparent)' : 'color-mix(in srgb,var(--loss) 15%,transparent)'};
            color:{isDeposit ? 'var(--win)' : 'var(--loss)'};">
            {isDeposit ? 'DEPOSIT' : 'WITHDRAWAL'}
          </span>
        </div>
        <p style="color:var(--text-muted);font-size:0.8rem;margin-top:0.125rem;">{formatDate(entry.date)} · {entry.source === 'c2c_import' ? '📥 Imported' : '✏️ Manual'}</p>
      </div>
    </div>
    <div style="display:flex;gap:0.5rem;align-items:center;">
      <button onclick={() => editing = !editing} style="padding:0.5rem 0.875rem;border:1px solid var(--border);border-radius:0.5rem;background:transparent;color:var(--text-muted);font-size:0.875rem;cursor:pointer;">
        {editing ? '✕ Cancel' : '✏️ Edit'}
      </button>
      <button onclick={() => showDeleteConfirm = true} style="padding:0.5rem 0.875rem;border:1px solid var(--loss);border-radius:0.5rem;background:transparent;color:var(--loss);font-size:0.875rem;cursor:pointer;">
        Delete
      </button>
    </div>
  </div>

  <!-- Edit form or read-only detail view -->
  {#if editing}
    <form method="POST" action="?/update" use:enhance={() => {
      saving = true;
      return async ({ update }) => {
        saving = false;
        await update();
        await invalidateAll();
      };
    }}>
      <input type="hidden" name="id" value={entry.id} />
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1.5rem;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
          {#each (isDeposit ? depositFields : withdrawalFields) as [label, name, type]}
            <div>
              <label style={labelStyle}>{label}</label>
              <input {type} {name} value={entry[name] ?? ''} style={inputStyle} />
            </div>
          {/each}
        </div>

        <!-- Computed fields -->
        {#if isDeposit}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
            <div>
              <label style={labelStyle}>Total LKR Sent (computed)</label>
              <div style={computedStyle}>{lkrTotalSent(entry).toLocaleString('en-US', {maximumFractionDigits:2})}</div>
            </div>
            <div>
              <label style={labelStyle}>Effective Rate (computed)</label>
              <div style={computedStyle}>{effectiveRate(entry)?.toFixed(2) ?? '—'}</div>
            </div>
          </div>
        {:else}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
            <div>
              <label style={labelStyle}>USD Released (computed)</label>
              <div style={computedStyle}>${usdReleased(entry).toFixed(2)}</div>
            </div>
            <div>
              <label style={labelStyle}>Expected LKR (computed)</label>
              <div style={computedStyle}>{expectedFiat(entry).toLocaleString('en-US', {maximumFractionDigits:0})}</div>
            </div>
          </div>
        {/if}

        <!-- Notes -->
        <div style="margin-bottom:1rem;">
          <label style={labelStyle}>Notes</label>
          <textarea name="notes" rows="3" style="{inputStyle}resize:vertical;">{entry.notes ?? ''}</textarea>
        </div>

        <!-- Optional fields -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
          <div>
            <label style={labelStyle}>Order Number</label>
            <input type="text" name="order_number" value={entry.order_number ?? ''} style={inputStyle} placeholder="Optional" />
          </div>
          <div>
            <label style={labelStyle}>Counterparty</label>
            <input type="text" name="counterparty" value={entry.counterparty ?? ''} style={inputStyle} placeholder="Optional" />
          </div>
        </div>

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

      {#if entry.notes}
        <div style="margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid var(--border);">
          <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">Notes</div>
          <p style="font-size:0.875rem;color:var(--text-primary);line-height:1.6;white-space:pre-wrap;">{entry.notes}</p>
        </div>
      {/if}
    </div>
  {/if}
</div>
