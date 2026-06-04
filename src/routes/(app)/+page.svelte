<script lang="ts">
  import { formatCurrency, formatDate } from '$lib/utils';
  import { onMount } from 'svelte';

  let { data } = $props();
  const stats = $derived(data.stats);
  const recentTrades = $derived(data.recentTrades);
  const recentLedger = $derived(data.recentLedger);
  const chartData = $derived((data as any).chartData ?? { monthlyPnl: [], coinPnl: [], winCount: 0, lossCount: 0, beCount: 0 });

  let monthlyCanvas = $state<HTMLCanvasElement | null>(null);
  let coinCanvas = $state<HTMLCanvasElement | null>(null);
  let wlbCanvas = $state<HTMLCanvasElement | null>(null);
  let monthlyChart: any;
  let coinChart: any;
  let wlbChart: any;

  onMount(() => {
    let destroyed = false;
    (async () => {
    const { Chart, registerables } = await import('chart.js');
    if (destroyed) return;
    Chart.register(...registerables);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
      || window.matchMedia('(prefers-color-scheme: dark)').matches;
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? '#8b949e' : '#6b7280';
    const accentColor = '#3b82f6';
    const winColor = '#22c55e';
    const lossColor = '#ef4444';

    // Monthly PnL (line)
    if (monthlyCanvas && chartData.monthlyPnl.length > 0) {
      monthlyChart = new Chart(monthlyCanvas, {
        type: 'line',
        data: {
          labels: chartData.monthlyPnl.map((m: any) => m.month),
          datasets: [
            {
              label: 'Cumulative PnL',
              data: chartData.monthlyPnl.map((m: any) => m.cumulative),
              borderColor: accentColor,
              backgroundColor: 'rgba(59,130,246,0.1)',
              fill: true,
              tension: 0.4,
              pointRadius: 3,
              pointHoverRadius: 5,
            },
            {
              label: 'Monthly PnL',
              data: chartData.monthlyPnl.map((m: any) => m.monthly),
              borderColor: winColor,
              backgroundColor: 'transparent',
              borderDash: [4, 4],
              tension: 0.3,
              pointRadius: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: textColor, font: { size: 11 } } } },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 } } },
            y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 }, callback: (v: any) => `$${v}` } },
          },
        },
      });
    }

    // PnL by Coin (bar)
    if (coinCanvas && chartData.coinPnl.length > 0) {
      coinChart = new Chart(coinCanvas, {
        type: 'bar',
        data: {
          labels: chartData.coinPnl.map((c: any) => c[0]),
          datasets: [{
            label: 'PnL ($)',
            data: chartData.coinPnl.map((c: any) => c[1]),
            backgroundColor: chartData.coinPnl.map((c: any) => c[1] >= 0 ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.7)'),
            borderRadius: 4,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 } } },
            y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 }, callback: (v: any) => `$${v}` } },
          },
        },
      });
    }

    // Win/Loss/BE (doughnut)
    if (wlbCanvas) {
      const total = chartData.winCount + chartData.lossCount + chartData.beCount;
      if (total > 0) {
        wlbChart = new Chart(wlbCanvas, {
          type: 'doughnut',
          data: {
            labels: ['Win', 'Loss', 'BE'],
            datasets: [{
              data: [chartData.winCount, chartData.lossCount, chartData.beCount],
              backgroundColor: ['rgba(34,197,94,0.8)', 'rgba(239,68,68,0.8)', 'rgba(107,114,128,0.6)'],
              borderWidth: 0,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
              legend: { position: 'bottom', labels: { color: textColor, font: { size: 11 }, padding: 12 } },
            },
          },
        });
      }
    }

    })();
    return () => {
      destroyed = true;
      monthlyChart?.destroy();
      coinChart?.destroy();
      wlbChart?.destroy();
    };
  });

  function pnlColor(pnl: number | null) {
    if (pnl == null) return 'var(--text-muted)';
    return pnl > 0 ? 'var(--win)' : pnl < 0 ? 'var(--loss)' : 'var(--text-muted)';
  }

  const statCards = $derived([
    { label: 'Total Trades', value: stats.totalTrades.toString(), accent: false },
    { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, accent: stats.winRate >= 50 },
    { label: 'Net PnL', value: formatCurrency(stats.netPnl), color: pnlColor(stats.netPnl) },
    { label: 'Avg PnL / Trade', value: formatCurrency(stats.avgPnl), color: pnlColor(stats.avgPnl) },
    { label: 'Total Deposited', value: `$${stats.totalDeposited.toFixed(2)}`, accent: false },
    { label: 'Total Withdrawn', value: `$${stats.totalWithdrawn.toFixed(2)}`, accent: false },
    { label: 'Net Contribution', value: `LKR ${stats.netContributionLkr.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, accent: false },
  ]);
</script>

<svelte:head><title>Dashboard — Qulem-Trade</title></svelte:head>

<div style="padding:1.5rem;">
  <!-- Header -->
  <div style="margin-bottom:1.5rem;">
    <h1 style="font-family:'JetBrains Mono',monospace;font-size:1.25rem;font-weight:600;color:var(--text-primary);">Dashboard</h1>
    <p style="color:var(--text-muted);font-size:0.875rem;margin-top:0.125rem;">Overview of your trading performance</p>
  </div>

  <!-- Stat cards -->
  {#if stats.totalTrades === 0}
    <!-- Empty state -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:3rem;text-align:center;margin-bottom:1.5rem;">
      <div style="font-size:2.5rem;margin-bottom:1rem;">📊</div>
      <h2 style="font-family:'JetBrains Mono',monospace;font-size:1rem;color:var(--text-primary);margin-bottom:0.5rem;">No trades yet</h2>
      <p style="color:var(--text-muted);font-size:0.875rem;margin-bottom:1.5rem;">Start by importing your Binance history or adding a trade manually.</p>
      <div style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap;">
        <a href="/trades/import" style="padding:0.625rem 1.25rem;background:var(--accent);color:#fff;border-radius:0.5rem;text-decoration:none;font-size:0.875rem;font-weight:500;">Import CSV</a>
        <a href="/trades/new" style="padding:0.625rem 1.25rem;border:1px solid var(--border);color:var(--text-muted);border-radius:0.5rem;text-decoration:none;font-size:0.875rem;">Add Trade</a>
      </div>
    </div>
  {:else}
    <!-- Stat cards grid -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.75rem;margin-bottom:1.5rem;">
      {#each statCards as card}
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1rem;">
          <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">{card.label}</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:1.25rem;font-weight:700;color:{card.color ?? (card.accent ? 'var(--win)' : 'var(--text-primary)')};line-height:1.2;">
            {card.value}
          </div>
        </div>
      {/each}
    </div>

    <!-- Charts row -->
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:0.75rem;margin-bottom:1.5rem;">
      <!-- Monthly PnL Trend -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1rem;">
        <div style="font-size:0.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem;">Monthly PnL Trend</div>
        {#if chartData.monthlyPnl.length > 0}
          <div style="height:180px;position:relative;">
            <canvas bind:this={monthlyCanvas}></canvas>
          </div>
        {:else}
          <div style="height:180px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:0.8rem;">No data yet</div>
        {/if}
      </div>

      <!-- PnL by Coin -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1rem;">
        <div style="font-size:0.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem;">PnL by Coin</div>
        {#if chartData.coinPnl.length > 0}
          <div style="height:180px;position:relative;">
            <canvas bind:this={coinCanvas}></canvas>
          </div>
        {:else}
          <div style="height:180px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:0.8rem;">No data yet</div>
        {/if}
      </div>

      <!-- Win / Loss / BE -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1rem;">
        <div style="font-size:0.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem;">Win / Loss / BE</div>
        {#if chartData.winCount + chartData.lossCount + chartData.beCount > 0}
          <div style="height:180px;position:relative;">
            <canvas bind:this={wlbCanvas}></canvas>
          </div>
        {:else}
          <div style="height:180px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:0.8rem;">No data yet</div>
        {/if}
      </div>
    </div>

    <!-- Recent activity -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
      <!-- Recent trades -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;overflow:hidden;">
        <div style="padding:0.875rem 1rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:0.8rem;font-weight:600;color:var(--text-primary);">Recent Trades</span>
          <a href="/trades" style="font-size:0.75rem;color:var(--accent);text-decoration:none;">View all →</a>
        </div>
        {#if recentTrades.length === 0}
          <div style="padding:1.5rem;text-align:center;color:var(--text-muted);font-size:0.875rem;">No trades yet</div>
        {:else}
          {#each recentTrades as trade}
            <a href="/trades/{trade.id}" style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 1rem;border-bottom:1px solid var(--border);text-decoration:none;transition:background 0.1s;"
              onmouseenter={(e) => (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb,var(--accent) 4%,transparent)'}
              onmouseleave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
              <div style="display:flex;align-items:center;gap:0.625rem;">
                <span style="font-weight:600;font-size:0.875rem;color:var(--text-primary);">{trade.coin}</span>
                <span style="font-size:0.75rem;padding:0.1rem 0.375rem;border-radius:0.25rem;
                  background:{trade.position === 'Long' ? 'color-mix(in srgb,var(--win) 12%,transparent)' : 'color-mix(in srgb,var(--loss) 12%,transparent)'};
                  color:{trade.position === 'Long' ? 'var(--win)' : 'var(--loss)'};font-weight:600;">
                  {trade.position}
                </span>
              </div>
              <div style="display:flex;align-items:center;gap:0.75rem;">
                <span style="font-family:'JetBrains Mono',monospace;font-size:0.875rem;font-weight:600;color:{pnlColor(trade.pnl)};">
                  {formatCurrency(trade.pnl)}
                </span>
                <span style="font-size:0.75rem;color:var(--text-muted);">{formatDate(trade.date)}</span>
              </div>
            </a>
          {/each}
        {/if}
      </div>

      <!-- Recent ledger -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;overflow:hidden;">
        <div style="padding:0.875rem 1rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:0.8rem;font-weight:600;color:var(--text-primary);">Recent Ledger</span>
          <a href="/ledger" style="font-size:0.75rem;color:var(--accent);text-decoration:none;">View all →</a>
        </div>
        {#if recentLedger.length === 0}
          <div style="padding:1.5rem;text-align:center;color:var(--text-muted);font-size:0.875rem;">No entries yet</div>
        {:else}
          {#each recentLedger as entry}
            <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 1rem;border-bottom:1px solid var(--border);">
              <div style="display:flex;align-items:center;gap:0.625rem;">
                <span style="font-size:0.875rem;color:{entry.type === 'deposit' ? 'var(--win)' : 'var(--loss)'};font-weight:600;">
                  {entry.type === 'deposit' ? '↓' : '↑'} {entry.type === 'deposit' ? 'Deposit' : 'Withdrawal'}
                </span>
              </div>
              <div style="display:flex;align-items:center;gap:0.75rem;">
                <span style="font-family:'JetBrains Mono',monospace;font-size:0.875rem;color:var(--text-primary);">
                  {entry.type === 'deposit' ? `$${(entry.usd_received ?? 0).toFixed(2)}` : `$${(entry.usd_quantity ?? 0).toFixed(2)}`}
                </span>
                <span style="font-size:0.75rem;color:var(--text-muted);">{formatDate(entry.date)}</span>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>
