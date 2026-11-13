<script lang="ts">
  import { formatDate } from '$lib/utils';
  let { data } = $props();
</script>

<svelte:head><title>Liquidations — Qulem-Trade</title></svelte:head>

<div class="page">
  <!-- Header -->
  <div class="page-header">
    <div>
      <h1 class="stat-value">Liquidations</h1>
      <p style="color:var(--text-muted);font-size:0.875rem;margin-top:0.125rem;">{data.total} total</p>
    </div>
    <a href="/liquidations/new" style="padding:0.5rem 0.875rem;background:var(--loss);border:none;border-radius:0.5rem;color:#fff;text-decoration:none;font-size:0.875rem;font-weight:500;">
      + Add Liquidation
    </a>
  </div>

  <!-- Total lost summary -->
  {#if data.totalLost > 0}
    <div style="background:color-mix(in srgb,var(--loss) 10%,transparent);border:1px solid var(--loss);border-radius:0.75rem;padding:1rem 1.25rem;margin-bottom:1.5rem;display:flex;align-items:center;justify-content:space-between;">
      <span style="font-size:0.875rem;color:var(--loss);font-weight:600;">Total Capital Lost to Liquidations</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:1.5rem;font-weight:700;color:var(--loss);">-${data.totalLost.toFixed(2)}</span>
    </div>
  {/if}

  <!-- Table -->
  <div class="card-flush">
    {#if data.liquidations.length === 0}
      <div style="padding:3rem;text-align:center;color:var(--text-muted);">
        No liquidations recorded. <a href="/liquidations/new" style="color:var(--accent);text-decoration:none;">Add one</a>.
      </div>
    {:else}
      <div class="scroll-x">
        <table class="table">
          <thead>
            <tr class="thead-row">
              {#each ['Date','Coin','Position','Strategy','Amount Lost','Reason','Notes','Actions'] as col}
                <th style="padding:0.625rem 0.75rem;text-align:left;font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">{col}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each data.liquidations as liq}
              <tr class="row-divider">
                <td style="padding:0.625rem 0.75rem;font-family:'JetBrains Mono',monospace;color:var(--text-muted);white-space:nowrap;">{formatDate(liq.date)}</td>
                <td style="padding:0.625rem 0.75rem;font-weight:600;color:var(--text-primary);">{liq.coin ?? '—'}</td>
                <td style="padding:0.625rem 0.75rem;">
                  {#if liq.position}
                    <span style="padding:0.125rem 0.5rem;border-radius:0.25rem;font-size:0.75rem;font-weight:600;
                      background:{liq.position === 'Long' ? 'color-mix(in srgb,var(--win) 15%,transparent)' : 'color-mix(in srgb,var(--loss) 15%,transparent)'};
                      color:{liq.position === 'Long' ? 'var(--win)' : 'var(--loss)'};">
                      {liq.position}
                    </span>
                  {:else}
                    <span style="color:var(--text-muted);">—</span>
                  {/if}
                </td>
                <td style="padding:0.625rem 0.75rem;color:var(--text-muted);">{liq.strategy ?? '—'}</td>
                <td style="padding:0.625rem 0.75rem;font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--loss);">
                  {liq.amount_lost != null ? `-$${liq.amount_lost.toFixed(2)}` : '—'}
                </td>
                <td style="padding:0.625rem 0.75rem;color:var(--text-muted);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{liq.reason ?? '—'}</td>
                <td style="padding:0.625rem 0.75rem;color:var(--text-muted);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{liq.notes ?? '—'}</td>
                <td style="padding:0.625rem 0.75rem;"><a href="/liquidations/{liq.id}?edit" class="link-muted">Edit</a></td>
              </tr>
            {/each}
          </tbody>
          <tfoot>
            <tr style="background:var(--bg);border-top:2px solid var(--border);">
              <td colspan="4" style="padding:0.625rem 0.75rem;font-size:0.75rem;color:var(--text-muted);font-weight:600;">{data.total} events</td>
              <td style="padding:0.625rem 0.75rem;font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--loss);">-${data.totalLost.toFixed(2)}</td>
              <td colspan="3"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    {/if}
  </div>
</div>
