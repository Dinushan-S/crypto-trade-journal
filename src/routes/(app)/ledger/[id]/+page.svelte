<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { enhance } from '$app/forms';
  import { formatDate } from '$lib/utils';

  let { data, form } = $props();
  let editing = $state(false);
  let saving = $state(false);
  let showDeleteConfirm = $state(false);

  const entry = $derived(data.entry as any);
  const tracking = $derived((data as any).tracking as any);
  const allocations = $derived(((data as any).allocations ?? []) as any[]);
  const isDeposit = $derived(entry?.type === 'deposit');

  // Rebalance state: map depositId → USD amount
  let rebalanceInputs = $state<Record<string, string>>({});
  let newDepositId = $state('');
  let newDepositUsd = $state('');
  const availableDeposits = $derived(((data as any).availableDeposits ?? []) as any[]);
  $effect(() => {
    const map: Record<string, string> = {};
    for (const a of allocations) map[a.depositId] = String(a.releasedUsd);
    rebalanceInputs = map;
  });

  const rebalanceAllocationsJson = $derived(
    JSON.stringify([
      ...allocations.map((a) => ({ depositId: a.depositId, releasedUsd: Number(rebalanceInputs[a.depositId] ?? a.releasedUsd) })),
      ...(newDepositId && Number(newDepositUsd) > 0 ? [{ depositId: newDepositId, releasedUsd: Number(newDepositUsd) }] : []),
    ])
  );

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

  const detailRows = $derived<any[]>([
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

      {#if !isDeposit}
        <div style="margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid var(--border);">
          <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;font-weight:600;margin-bottom:0.75rem;">Release Allocations</div>
          {#if allocations.length > 0}
            <form method="POST" action="?/rebalance" use:enhance={() => async ({ update }: any) => {
              await update();
              await invalidateAll();
            }}>
              <div style="display:flex;flex-direction:column;gap:0.5rem;margin-bottom:0.75rem;">
                {#each allocations as a}
                  <div style="display:flex;align-items:center;gap:0.5rem;">
                    <span style="font-size:0.85rem;color:var(--text-primary);flex:1;">Deposit <span style="font-family:'JetBrains Mono',monospace;color:var(--accent);">{a.depositId.slice(-6)}</span></span>
                    <input type="number" min="0" step="any" value={rebalanceInputs[a.depositId] ?? ''}
                      oninput={(ev) => {
                        rebalanceInputs = { ...rebalanceInputs, [a.depositId]: (ev.currentTarget as HTMLInputElement).value };
                      }}
                      style="width:120px;padding:0.4rem 0.625rem;background:var(--bg);border:1px solid var(--border);border-radius:0.375rem;color:var(--text-primary);font-size:0.875rem;" />
                  </div>
                {/each}
                {#if availableDeposits.length > 0}
                  <div style="display:flex;align-items:center;gap:0.5rem;padding-top:0.5rem;border-top:1px dashed var(--border);">
                    <span style="font-size:0.85rem;color:var(--text-muted);flex:1;">Add another deposit</span>
                    <select bind:value={newDepositId} style="padding:0.4rem 0.625rem;background:var(--bg);border:1px solid var(--border);border-radius:0.375rem;color:var(--text-primary);font-size:0.8rem;">
                      <option value="">—</option>
                      {#each availableDeposits as d}
                        <option value={d.id}>{formatDate(d.date)} (${(d.remainingUsd ?? 0).toFixed(0)} left)</option>
                      {/each}
                    </select>
                    <input type="number" min="0" step="any" placeholder="USD" bind:value={newDepositUsd}
                      style="width:120px;padding:0.4rem 0.625rem;background:var(--bg);border:1px solid var(--border);border-radius:0.375rem;color:var(--text-primary);font-size:0.875rem;" />
                  </div>
                {/if}
              </div>
              <input type="hidden" name="allocations" value={rebalanceAllocationsJson} />
              <button type="submit" style="padding:0.5rem 1rem;background:var(--accent);color:#fff;border:none;border-radius:0.375rem;font-size:0.85rem;font-weight:600;cursor:pointer;">Save Allocations</button>
            </form>
          {:else if availableDeposits.length > 0}
            <form method="POST" action="?/rebalance" use:enhance={() => async ({ update }: any) => {
              await update();
              await invalidateAll();
            }}>
              <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;">
                <span style="font-size:0.85rem;color:var(--text-muted);flex:1;">Link a deposit</span>
                <select bind:value={newDepositId} style="padding:0.4rem 0.625rem;background:var(--bg);border:1px solid var(--border);border-radius:0.375rem;color:var(--text-primary);font-size:0.8rem;">
                  <option value="">—</option>
                  {#each availableDeposits as d}
                    <option value={d.id}>{formatDate(d.date)} (${(d.remainingUsd ?? 0).toFixed(0)} left)</option>
                  {/each}
                </select>
                <input type="number" min="0" step="any" placeholder="USD" bind:value={newDepositUsd}
                  style="width:120px;padding:0.4rem 0.625rem;background:var(--bg);border:1px solid var(--border);border-radius:0.375rem;color:var(--text-primary);font-size:0.875rem;" />
              </div>
              <input type="hidden" name="allocations" value={rebalanceAllocationsJson} />
              <button type="submit" style="padding:0.5rem 1rem;background:var(--accent);color:#fff;border:none;border-radius:0.375rem;font-size:0.85rem;font-weight:600;cursor:pointer;">Link Deposit</button>
            </form>
          {:else}
            <p style="font-size:0.85rem;color:var(--text-muted);">No deposits linked yet. Use the Release action on the ledger page to allocate this withdrawal.</p>
          {/if}
        </div>
      {/if}

      {#if isDeposit}
        <div style="margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid var(--border);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;flex-wrap:wrap;gap:0.5rem;">
            <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Lock Tracking</div>
            {#if tracking?.fullyWithdrawn}
              <span style="font-size:0.75rem;padding:0.2rem 0.5rem;border-radius:0.25rem;background:color-mix(in srgb,var(--win) 15%,transparent);color:var(--win);font-weight:700;">Fully Withdrawn ✓</span>
            {/if}
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.75rem;margin-bottom:0.75rem;">
            <div style="background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;padding:0.625rem;">
              <div style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">Locked USD</div>
              <div style="font-family:'JetBrains Mono',monospace;font-size:0.95rem;font-weight:700;color:var(--text-primary);">{tracking?.lockedUsd != null ? `$${tracking.lockedUsd.toFixed(2)}` : '—'}</div>
              {#if tracking?.lockedLkr != null}<div style="font-size:0.7rem;color:var(--text-muted);">LKR {tracking.lockedLkr.toLocaleString('en-US', {maximumFractionDigits:0})}</div>{/if}
            </div>
            <div style="background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;padding:0.625rem;">
              <div style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">Released USD</div>
              <div style="font-family:'JetBrains Mono',monospace;font-size:0.95rem;font-weight:700;color:var(--text-primary);">{tracking?.releasedUsd > 0 ? `$${tracking.releasedUsd.toFixed(2)}` : '—'}</div>
              {#if tracking?.releasedLkr > 0}<div style="font-size:0.7rem;color:var(--text-muted);">LKR {tracking.releasedLkr.toLocaleString('en-US', {maximumFractionDigits:0})}</div>{/if}
            </div>
            <div style="background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;padding:0.625rem;">
              <div style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">Remaining USD</div>
              <div style="font-family:'JetBrains Mono',monospace;font-size:0.95rem;font-weight:700;color:{tracking?.remainingUsd === 0 ? 'var(--win)' : 'var(--text-primary)'};">{tracking?.remainingUsd != null ? `$${tracking.remainingUsd.toFixed(2)}` : '—'}</div>
              {#if tracking?.remainingLkr != null}<div style="font-size:0.7rem;color:var(--text-muted);">LKR {tracking.remainingLkr.toLocaleString('en-US', {maximumFractionDigits:0})}</div>{/if}
            </div>
          </div>
          <form method="POST" action="?/lock" use:enhance={() => async ({ update }: any) => {
            await update();
            await invalidateAll();
          }}>
            <div style="display:flex;gap:0.5rem;align-items:center;">
              <input type="number" name="lockedUsd" min="0" step="any" placeholder={tracking?.lockedUsd != null ? `Locked: $${tracking.lockedUsd}` : 'Set lock amount ($)'}
                style="width:180px;padding:0.4rem 0.625rem;background:var(--bg);border:1px solid var(--accent);border-radius:0.375rem;color:var(--text-primary);font-size:0.875rem;" />
              <button type="submit" style="padding:0.4rem 1rem;background:var(--accent);color:#fff;border:none;border-radius:0.375rem;font-size:0.85rem;font-weight:600;cursor:pointer;">
                {tracking?.lockedUsd != null ? 'Update Lock' : 'Set Lock'}
              </button>
            </div>
          </form>
        </div>
      {/if}
    </div>
  {/if}
</div>
