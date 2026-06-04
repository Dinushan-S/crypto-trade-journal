<script lang="ts">
  import { formatCurrency, formatDate } from '$lib/utils';
  import { onMount } from 'svelte';

  let { data } = $props();
  const stats = $derived(data.stats);
  const recentTrades = $derived(data.recentTrades);
  const recentLedger = $derived(data.recentLedger);
  const chartData = $derived((data as any).chartData ?? { monthlyPnl: [], coinPnl: [], winCount: 0, lossCount: 0, beCount: 0, dailyStats: {} });
  const monthlyLedger = $derived((data as any).monthlyLedger ?? []);

  let ledgerPage = $state(0); // 0-based, 6 months per page
  const ledgerPageMonths = $derived(monthlyLedger.slice(ledgerPage * 6, ledgerPage * 6 + 6));
  const ledgerTotalPages = $derived(Math.ceil(monthlyLedger.length / 6));

  const ledgerAllTime = $derived({
    totalIn:   monthlyLedger.reduce((s: number, m: any) => s + m.depositedUsd, 0),
    totalOut:  monthlyLedger.reduce((s: number, m: any) => s + m.withdrawnUsd, 0),
    totalInLkr:  monthlyLedger.reduce((s: number, m: any) => s + m.depositedLkr, 0),
    totalOutLkr: monthlyLedger.reduce((s: number, m: any) => s + m.withdrawnLkr, 0),
    months: monthlyLedger.length,
  });

  function fmtMonth(ym: string): string {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleString('default', { month: 'short', year: '2-digit' }).toUpperCase();
  }

  function fmtLkr(n: number): string {
    if (n >= 1000000) return `LKR ${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `LKR ${Math.round(n / 1000)}k`;
    return `LKR ${n.toFixed(0)}`;
  }

  let monthlyCanvas = $state<HTMLCanvasElement | null>(null);
  let coinCanvas = $state<HTMLCanvasElement | null>(null);
  let wlbCanvas = $state<HTMLCanvasElement | null>(null);
  let monthlyChart: any;
  let coinChart: any;
  let wlbChart: any;

  // Calendar state
  const _now = new Date();
  let calendarMonth = $state(`${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}`); // YYYY-MM (local time)
  let expandedDay = $state<string | null>(null);

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

  function calendarPrevMonth() {
    const [y, m] = calendarMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1); // m-2 because Date months are 0-indexed
    calendarMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    expandedDay = null;
  }

  function calendarNextMonth() {
    const [y, m] = calendarMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    calendarMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    expandedDay = null;
  }

  function toggleDay(dateStr: string) {
    expandedDay = expandedDay === dateStr ? null : dateStr;
  }

  function formatMonthLabel(ym: string): string {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  function pnlIntensity(pnl: number, maxAbsPnl: number): number {
    // Returns 0.08–0.25 opacity for background color scaling
    if (maxAbsPnl === 0) return 0.1;
    return 0.08 + (Math.abs(pnl) / maxAbsPnl) * 0.17;
  }

  // Derived calendar grid data
  const calendarDays = $derived.by(() => {
    const [y, m] = calendarMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const firstDow = new Date(y, m - 1, 1).getDay(); // 0=Sun…6=Sat
    // Convert to Mon-first: Mon=0…Sun=6
    const leadingBlanks = firstDow === 0 ? 6 : firstDow - 1;

    const days = [];
    // Leading invisible placeholders
    for (let i = 0; i < leadingBlanks; i++) {
      days.push({ blank: true, date: '', dayNum: 0, stat: null });
    }
    // Actual days
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${calendarMonth}-${String(d).padStart(2, '0')}`;
      const stat = (chartData.dailyStats as Record<string, any>)[date] ?? null;
      days.push({ blank: false, date, dayNum: d, stat });
    }
    return days;
  });

  const calendarMonthSummary = $derived.by(() => {
    const days = calendarDays.filter(d => !d.blank && d.stat);
    const netPnl = days.reduce((s, d) => s + (d.stat?.netPnl ?? 0), 0);
    const trades = days.reduce((s, d) => s + (d.stat?.tradeCount ?? 0), 0);
    const allTrades = days.flatMap(d => d.stat?.trades ?? []);
    const wins = allTrades.filter((t: any) => t.pnl > 0).length;
    const nonBeTrades = allTrades.filter((t: any) => t.pnl !== 0);
    const winRate = nonBeTrades.length > 0 ? (wins / nonBeTrades.length) * 100 : 0;
    const dayPnls = days.map(d => d.stat?.netPnl ?? 0);
    const bestDay = dayPnls.length > 0 ? Math.max(...dayPnls) : 0;
    const worstDay = dayPnls.length > 0 ? Math.min(...dayPnls) : 0;
    return { netPnl, trades, winRate, bestDay, worstDay };
  });

  const calendarMaxAbsPnl = $derived.by(() => {
    const pnls = calendarDays
      .filter(d => !d.blank && d.stat)
      .map(d => Math.abs(d.stat?.netPnl ?? 0));
    return pnls.length > 0 ? Math.max(...pnls) : 0;
  });
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

    <!-- Period Analysis: Calendar Heatmap -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1rem;margin-bottom:1.5rem;">

      <!-- Header: month nav + summary strip -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.875rem;flex-wrap:wrap;gap:0.5rem;">
        <div style="display:flex;align-items:center;gap:0.625rem;">
          <button
            type="button"
            aria-label="Previous month"
            onclick={calendarPrevMonth}
            style="background:var(--bg);border:1px solid var(--border);color:var(--text-muted);border-radius:0.375rem;padding:3px 10px;font-size:0.75rem;cursor:pointer;">
            ← Prev
          </button>
          <span style="font-family:'JetBrains Mono',monospace;font-size:0.875rem;font-weight:700;color:var(--text-primary);min-width:140px;text-align:center;">
            {formatMonthLabel(calendarMonth)}
          </span>
          <button
            type="button"
            aria-label="Next month"
            onclick={calendarNextMonth}
            style="background:var(--bg);border:1px solid var(--border);color:var(--text-muted);border-radius:0.375rem;padding:3px 10px;font-size:0.75rem;cursor:pointer;">
            Next →
          </button>
        </div>
        <div style="display:flex;gap:1.25rem;font-size:0.75rem;">
          <div style="text-align:center;">
            <div style="color:var(--text-muted);font-size:0.65rem;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:1px;">Net PnL</div>
            <div style="font-family:'JetBrains Mono',monospace;font-weight:700;color:{calendarMonthSummary.netPnl >= 0 ? 'var(--win)' : 'var(--loss)'};">
              {calendarMonthSummary.netPnl >= 0 ? '+' : ''}{calendarMonthSummary.netPnl.toFixed(2)}
            </div>
          </div>
          <div style="text-align:center;">
            <div style="color:var(--text-muted);font-size:0.65rem;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:1px;">Trades</div>
            <div style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--text-primary);">{calendarMonthSummary.trades}</div>
          </div>
          <div style="text-align:center;">
            <div style="color:var(--text-muted);font-size:0.65rem;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:1px;">Win Rate</div>
            <div style="font-family:'JetBrains Mono',monospace;font-weight:700;color:{calendarMonthSummary.winRate >= 50 ? 'var(--win)' : 'var(--loss)'};">
              {calendarMonthSummary.winRate.toFixed(1)}%
            </div>
          </div>
          <div style="text-align:center;">
            <div style="color:var(--text-muted);font-size:0.65rem;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:1px;">Best Day</div>
            <div style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--win);">
              {calendarMonthSummary.bestDay > 0 ? '+' : ''}{calendarMonthSummary.bestDay.toFixed(2)}
            </div>
          </div>
          <div style="text-align:center;">
            <div style="color:var(--text-muted);font-size:0.65rem;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:1px;">Worst Day</div>
            <div style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--loss);">
              {calendarMonthSummary.worstDay.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      <!-- Day-of-week headers -->
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px;">
        {#each ['MON','TUE','WED','THU','FRI','SAT','SUN'] as dow}
          <div style="text-align:center;font-size:0.6rem;color:var(--text-muted);padding:3px 0;font-weight:600;letter-spacing:0.04em;">{dow}</div>
        {/each}
      </div>

      <!-- Calendar grid -->
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:0.75rem;">
        {#each calendarDays as day}
          {#if day.blank}
            <div style="height:56px;"></div>
          {:else if !day.stat}
            <div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;">
              <span style="font-size:0.6rem;color:var(--text-muted);">{day.dayNum}</span>
            </div>
          {:else}
            {@const isWin = day.stat.netPnl >= 0}
            {@const intensity = pnlIntensity(day.stat.netPnl, calendarMaxAbsPnl)}
            {@const isSelected = expandedDay === day.date}
            <div
              role="button"
              tabindex="0"
              onclick={() => toggleDay(day.date)}
              onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDay(day.date); } }}
              style="background:{isSelected ? (isWin ? 'color-mix(in srgb,var(--win) 22%,var(--surface))' : 'color-mix(in srgb,var(--loss) 22%,var(--surface))') : `color-mix(in srgb,${isWin ? 'var(--win)' : 'var(--loss)'} ${Math.round(intensity * 100)}%,var(--bg))`};
                border:{isSelected ? `1.5px solid ${isWin ? 'var(--win)' : 'var(--loss)'}` : `1px solid color-mix(in srgb,${isWin ? 'var(--win)' : 'var(--loss)'} 35%,transparent)`};
                border-radius:6px;height:56px;
                display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;
                cursor:pointer;transition:opacity 0.1s;"
              onmouseenter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.opacity = '0.8'; }}
              onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}>
              <span style="font-size:0.6rem;color:var(--text-muted);">{day.dayNum}</span>
              <span style="font-family:'JetBrains Mono',monospace;font-size:0.7rem;font-weight:700;color:{isWin ? 'var(--win)' : 'var(--loss)'};">
                {day.stat.netPnl >= 0 ? '+' : ''}{day.stat.netPnl.toFixed(2)}
              </span>
              <span style="font-size:0.6rem;color:var(--text-muted);">{day.stat.tradeCount} trade{day.stat.tradeCount !== 1 ? 's' : ''}</span>
            </div>
          {/if}
        {/each}
      </div>

      <!-- Expanded day trade panel -->
      {#if expandedDay && (chartData.dailyStats as Record<string, any>)[expandedDay]}
        {@const dayStat = (chartData.dailyStats as Record<string, any>)[expandedDay]}
        {@const [, , dd] = expandedDay.split('-')}
        {@const dayLabel = `${formatMonthLabel(calendarMonth).split(' ')[0]} ${parseInt(dd)}`}
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;padding:0.875rem;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.625rem;">
            <span style="font-size:0.75rem;font-weight:600;color:var(--text-primary);">
              {dayLabel} — {dayStat.tradeCount} trade{dayStat.tradeCount !== 1 ? 's' : ''} ·
              <span style="color:{dayStat.netPnl >= 0 ? 'var(--win)' : 'var(--loss)'};">
                {dayStat.netPnl >= 0 ? '+' : ''}{dayStat.netPnl.toFixed(2)}
              </span>
            </span>
            <button
              type="button"
              onclick={() => expandedDay = null}
              style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.75rem;padding:0;">
              ✕ Close
            </button>
          </div>
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:0.775rem;">
              <thead>
                <tr style="border-bottom:1px solid var(--border);">
                  {#each ['Coin','Side','Opened','Closed','Entry','Exit','PnL'] as col}
                    <th style="padding:4px 8px;text-align:{col === 'Entry' || col === 'Exit' || col === 'PnL' ? 'right' : 'left'};font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;font-weight:500;">{col}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each dayStat.trades as trade}
                  <tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:5px 8px;font-weight:600;color:var(--text-primary);">{trade.coin}</td>
                    <td style="padding:5px 8px;color:{trade.position === 'Long' ? 'var(--win)' : trade.position === 'Short' ? 'var(--loss)' : 'var(--text-muted)'};">{trade.position || '—'}</td>
                    <td style="padding:5px 8px;font-family:'JetBrains Mono',monospace;color:var(--text-muted);font-size:0.7rem;">{trade.date_opened ?? '—'}</td>
                    <td style="padding:5px 8px;font-family:'JetBrains Mono',monospace;color:var(--text-muted);font-size:0.7rem;">{trade.date_closed ?? '—'}</td>
                    <td style="padding:5px 8px;text-align:right;font-family:'JetBrains Mono',monospace;color:var(--text-muted);">{trade.entry_price != null ? trade.entry_price.toLocaleString() : '—'}</td>
                    <td style="padding:5px 8px;text-align:right;font-family:'JetBrains Mono',monospace;color:var(--text-muted);">{trade.exit_price != null ? trade.exit_price.toLocaleString() : '—'}</td>
                    <td style="padding:5px 8px;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:600;color:{trade.pnl >= 0 ? 'var(--win)' : 'var(--loss)'};">
                      {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(4)}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}

    </div>

    <!-- Deposits & Withdrawals -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1rem;margin-bottom:1.5rem;">

      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.875rem;flex-wrap:wrap;gap:0.5rem;">
        <div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:0.875rem;font-weight:700;color:var(--text-primary);">Deposits & Withdrawals</div>
          <div style="font-size:0.7rem;color:var(--text-muted);margin-top:1px;">Monthly capital flow summary</div>
        </div>
        {#if ledgerTotalPages > 1}
          <div style="display:flex;align-items:center;gap:0.5rem;">
            <button type="button" onclick={() => ledgerPage = Math.max(0, ledgerPage - 1)} disabled={ledgerPage === 0}
              style="background:var(--bg);border:1px solid var(--border);color:var(--text-muted);border-radius:0.375rem;padding:3px 10px;font-size:0.75rem;cursor:pointer;opacity:{ledgerPage === 0 ? 0.4 : 1};">← Prev</button>
            <span style="font-size:0.7rem;color:var(--text-muted);">{ledgerPage + 1} / {ledgerTotalPages}</span>
            <button type="button" onclick={() => ledgerPage = Math.min(ledgerTotalPages - 1, ledgerPage + 1)} disabled={ledgerPage === ledgerTotalPages - 1}
              style="background:var(--bg);border:1px solid var(--border);color:var(--text-muted);border-radius:0.375rem;padding:3px 10px;font-size:0.75rem;cursor:pointer;opacity:{ledgerPage === ledgerTotalPages - 1 ? 0.4 : 1};">Next →</button>
          </div>
        {/if}
      </div>

      {#if monthlyLedger.length === 0}
        <div style="text-align:center;padding:2rem;color:var(--text-muted);font-size:0.8rem;">No ledger entries yet. <a href="/ledger/new" style="color:var(--accent);text-decoration:none;">Add a deposit →</a></div>
      {:else}
        <!-- All-time summary strip -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem;margin-bottom:1rem;">
          {#each [
            { label: 'Total Deposited', usd: ledgerAllTime.totalIn,  lkr: ledgerAllTime.totalInLkr,  color: 'var(--win)' },
            { label: 'Total Withdrawn', usd: ledgerAllTime.totalOut, lkr: ledgerAllTime.totalOutLkr, color: 'var(--loss)' },
            { label: 'Net Flow',        usd: ledgerAllTime.totalIn - ledgerAllTime.totalOut, lkr: null, color: (ledgerAllTime.totalIn - ledgerAllTime.totalOut) >= 0 ? 'var(--win)' : 'var(--loss)' },
            { label: 'Months',          usd: null, lkr: null, months: ledgerAllTime.months, color: 'var(--text-primary)' },
          ] as s}
            <div style="background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;padding:0.625rem 0.75rem;">
              <div style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;">{s.label}</div>
              {#if s.months != null}
                <div style="font-family:'JetBrains Mono',monospace;font-size:1.1rem;font-weight:700;color:{s.color};">{s.months}</div>
              {:else}
                <div style="font-family:'JetBrains Mono',monospace;font-size:1rem;font-weight:700;color:{s.color};">
                  {(s.usd ?? 0) >= 0 && s.label === 'Net Flow' ? '+' : ''}{s.usd != null ? `$${(s.usd).toFixed(2)}` : '—'}
                </div>
                {#if s.lkr != null && s.lkr > 0}
                  <div style="font-size:0.65rem;color:var(--text-muted);margin-top:1px;">{fmtLkr(s.lkr)}</div>
                {/if}
              {/if}
            </div>
          {/each}
        </div>

        <!-- Monthly cards — 6 per row -->
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:0.5rem;">
          {#each ledgerPageMonths as m}
            {@const isInflow = m.netUsd >= 0}
            <div style="background:var(--bg);border:1px solid var(--border);border-left:3px solid {isInflow ? 'var(--win)' : 'var(--loss)'};border-radius:0.5rem;padding:0.625rem 0.75rem;display:flex;flex-direction:column;gap:0.25rem;">
              <!-- Month label -->
              <div style="font-family:'JetBrains Mono',monospace;font-size:0.65rem;font-weight:700;color:var(--text-muted);letter-spacing:0.04em;">{fmtMonth(m.month)}</div>

              <!-- Deposit row -->
              <div style="margin-top:0.25rem;">
                <div style="font-size:0.6rem;color:var(--text-muted);">↓ Dep</div>
                <div style="font-family:'JetBrains Mono',monospace;font-size:0.7rem;font-weight:600;color:var(--win);">${m.depositedUsd.toFixed(2)}</div>
                {#if m.depositedLkr > 0}
                  <div style="font-size:0.6rem;color:var(--text-muted);">{fmtLkr(m.depositedLkr)}</div>
                {/if}
              </div>

              <!-- Withdraw row -->
              <div>
                <div style="font-size:0.6rem;color:var(--text-muted);">↑ Wdr</div>
                <div style="font-family:'JetBrains Mono',monospace;font-size:0.7rem;font-weight:600;color:{m.withdrawnUsd > 0 ? 'var(--loss)' : 'var(--text-muted)'};">${m.withdrawnUsd.toFixed(2)}</div>
                {#if m.withdrawnLkr > 0}
                  <div style="font-size:0.6rem;color:var(--text-muted);">{fmtLkr(m.withdrawnLkr)}</div>
                {/if}
              </div>

              <!-- Divider + net -->
              <div style="border-top:1px solid var(--border);margin-top:0.25rem;padding-top:0.25rem;">
                <div style="font-size:0.6rem;color:var(--text-muted);">Net</div>
                <div style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;font-weight:700;color:{isInflow ? 'var(--win)' : 'var(--loss)'};">
                  {isInflow ? '+' : ''}{m.netUsd.toFixed(2)}
                </div>
                <div style="font-size:0.6rem;font-weight:600;color:{isInflow ? 'var(--win)' : 'var(--loss)'};">{isInflow ? '▲' : '▼'} {isInflow ? 'IN' : 'OUT'}</div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
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
