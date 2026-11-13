<script lang="ts">
  import { enhance } from '$app/forms';
  import { untrack } from 'svelte';
  import { formatCurrency } from '$lib/utils';
  import type { Doc } from '../../../../../convex/_generated/dataModel';
  let { data, form } = $props();
  let primaryId = $state(untrack(() => data.trades.find(t => t.is_group)?._id ?? data.trades[0]._id));
  const primary = $derived(data.trades.find(t => t._id === primaryId)!);
  const closes = $derived<Doc<'trades'>[]>(data.trades.flatMap(t => 'partial_closes' in t && Array.isArray(t.partial_closes) ? t.partial_closes : [t]));
  const closedQuantity = $derived(closes.reduce((s, c) => s + (c.quantity ?? 0), 0));
  const defaultQuantity = $derived(Math.max(closedQuantity, ...data.trades.map(t => t.original_quantity ?? 0)));
  const pnl = $derived(closes.reduce((s, c) => s + (c.pnl ?? 0), 0));
  const fees = $derived(closes.reduce((s, c) => s + (c.fee ?? 0), 0));
  const problem = $derived(
    data.trades.some(t => t.parent_trade_id) ? 'A selected close already belongs to a combined trade.' :
    data.trades.filter(t => t.is_group).length > 1 ? 'Select at most one existing combined trade.' :
    data.trades.some(t => t.coin !== primary.coin || t.position !== primary.position || t.source !== primary.source) ? 'Choose trades with the same coin, direction and source.' :
    closes.some(t => !t.quantity || t.quantity < 0 || t.pnl == null || !t.date_closed) ? 'Every close needs a positive quantity, PnL and closing date. Open its details to complete them first.' : '');
  let saving = $state(false);
</script>

<svelte:head><title>Combine Trades - Qulem-Trade</title></svelte:head>
<div class="page">
  <div class="page-header"><h1 class="stat-value">Review &amp; Combine Trades</h1><a href="/trades" class="btn-ghost">Back to Trades</a></div>
  <p class="muted-sm" style="margin-bottom:1rem;">Confirm these closes belong to the same position. Original records, notes and liquidation links are preserved. You can undo the combination later.</p>
  {#if problem || form?.error}<p role="alert" style="color:var(--loss);margin-bottom:1rem;">{problem || form?.error}</p>{/if}
  <div class="card-flush scroll-x" style="margin-bottom:1rem;">
    <table class="table">
      <thead><tr class="thead-row"><th>Trade</th><th>Entry / date</th><th>Closed / time</th><th>Quantity</th><th>Exit</th><th>P&amp;L</th><th>Fee</th><th>Journal details</th></tr></thead>
      <tbody>{#each closes as c}<tr>
        <td><a href="/trades/{c._id}" target="_blank" rel="noreferrer">{c.coin} {c.position}</a><br /><small>{c.order_id ?? 'Manual'}</small></td>
        <td>{c.entry_price ?? 'Unknown'}<br />{c.date} {c.source === 'futures_import' ? '(import date)' : c.time ?? ''}</td>
        <td>{c.date_closed ?? 'Missing'}<br />{c.time_closed ?? (c.source === 'futures_import' ? c.time : '') ?? ''}</td>
        <td>{c.quantity ?? 'Missing'}</td><td>{c.exit_price ?? 'Unknown'}</td><td>{formatCurrency(c.pnl)}</td><td>{formatCurrency(c.fee)}</td>
        <td><details><summary>{c.strategy || 'View notes'}</summary><p style="white-space:pre-wrap;">{[c.reason, c.pre_notes, c.post_notes].filter(Boolean).join('\n\n') || 'No notes'}</p><p>Leverage: {c.leverage ?? 'Unknown'} · Liquidated: {c.liquidated ? 'Yes' : 'No'}</p></details></td>
      </tr>{/each}</tbody>
    </table>
  </div>
  <p style="margin-bottom:1rem;">{closes.length} closes · Closed quantity: {closedQuantity} · Realized P&amp;L: {formatCurrency(pnl)} · Recorded fees: {formatCurrency(fees)} · After recorded fees: {formatCurrency(pnl - fees)}</p>
  <form method="POST" use:enhance={() => { saving = true; return async ({ update }) => { saving = false; await update({ reset: false }); }; }}>
    {#each data.trades as t}<input type="hidden" name="ids" value={t._id} />{/each}
    <div class="card" style="padding:1.25rem;">
      <label class="form-label" for="primary">Copy shared details from</label>
      <select id="primary" name="primaryId" bind:value={primaryId} class="input">
        {#each data.trades as t}<option value={t._id}>{t.coin} · {t.date} · {t.order_id ?? (t.is_group ? 'Combined trade' : 'Manual')} · {t.strategy ?? 'No strategy'}</option>{/each}
      </select>
      <p class="muted-sm" style="margin:0.75rem 0;">Review shared fields below. Imported dates can be closing dates; enter the actual opening date. A larger original quantity keeps the position partially open. Missing fees are not estimated.</p>
      <div class="fields">
        <label>Original position quantity<input class="input" type="number" name="original_quantity" step="any" min={closedQuantity} value={defaultQuantity} required /></label>
        <label>Entry date<input class="input" type="date" name="date" value={primary.date} required /></label>
        <label>Entry time<input class="input" type="time" name="time" step="1" value={primary.is_group || primary.source !== 'futures_import' ? primary.time ?? '' : ''} /></label>
        <label>Entry price<input class="input" type="number" name="entry_price" step="any" min="0" value={primary.entry_price ?? ''} /></label>
        <label>Leverage<input class="input" name="leverage" value={primary.leverage ?? ''} placeholder="e.g. 10x" /></label>
        <label>Strategy<input class="input" name="strategy" value={primary.strategy ?? ''} /></label>
      </div>
      {#each [['reason','Reason / setup'], ['pre_notes','Pre notes'], ['post_notes','Post notes']] as [key, label]}
        <label class="form-label" for={key}>{label}</label><textarea id={key} class="input" name={key} rows="3" value={primary[key as 'reason' | 'pre_notes' | 'post_notes'] ?? ''}></textarea>
      {/each}
      <button class="btn-primary" style="margin-top:1rem;" disabled={saving || !!problem}>{saving ? 'Combining...' : 'Combine into One Trade'}</button>
    </div>
  </form>
</div>
<style>.fields { display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin:1rem 0; } th,td {padding:0.75rem;text-align:left;vertical-align:top;} label {font-size:0.85rem;} small {color:var(--text-muted);}</style>
