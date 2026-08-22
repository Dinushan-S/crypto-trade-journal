<script lang="ts">
  import { goto } from '$app/navigation';
  import { untrack } from 'svelte';
  import { formatCurrency, formatDate } from '$lib/utils';
  import { deriveMarketSessions, formatSessionTime, sessionBadgeColor, SESSION_LABELS, type MarketSession, type ViewTz } from '$lib/utils/sessions';

  let { data } = $props();

  function dotColor(session: any) {
    return session ? 'var(--win)' : 'var(--border)';
  }
  const today = new Date().toISOString().split('T')[0];

  let sessionRaw = $state(untrack(() => (data as any).filters?.session ?? ''));
  let result = $state(untrack(() => (data as any).filters?.result ?? 'all'));
  let viewTz = $state<ViewTz>(untrack(() => (data as any).viewTz ?? 'utc'));
  let selectedSessions = $state<string[]>(untrack(() => sessionRaw ? sessionRaw.split(',').filter(Boolean) : []));
  let mySessionCfg = $state(untrack(() => (data as any).mySession ?? { start: '04:30', end: '12:30' }));
  let countsMap = $derived(Object.fromEntries(((data as any).sessionCounts ?? []).map((s: any) => [s.session, s.count])));
  let hbMax = $derived(Math.max(1, ...(((data as any).hourlyBuckets ?? []) as any[]).map((x: any) => x.count)));

  function toggleSession(s: string) {
    let next: string[];
    if (s === 'all') next = [];
    else {
      const set = new Set(selectedSessions);
      if (set.has(s)) set.delete(s); else set.add(s);
      next = Array.from(set);
    }
    selectedSessions = next;
    const params = new URLSearchParams();
    if (next.length > 0) params.set('session', next.join(','));
    if (result !== 'all') params.set('result', result);
    if (viewTz !== 'utc') params.set('tz', viewTz);
    const q = params.toString();
    goto(q ? `/sessions?${q}` : '/sessions');
  }
  function applyFilters() {
    const params = new URLSearchParams();
    if (selectedSessions.length > 0) params.set('session', selectedSessions.join(','));
    if (result !== 'all') params.set('result', result);
    if (viewTz !== 'utc') params.set('tz', viewTz);
    const q = params.toString();
    goto(q ? `/sessions?${q}` : '/sessions');
  }
  $effect(() => {
    const raw = (data as any).filters?.session ?? '';
    const parsed = raw ? raw.split(',').filter(Boolean) : [];
    if (parsed.join(',') !== selectedSessions.join(',')) selectedSessions = parsed;
  });
  function resetFilters() {
    selectedSessions = [];
    result = 'all';
    viewTz = 'utc';
    goto('/sessions');
  }
  const resultLabel = (t: any) => (t.win ? 'Win' : t.loss ? 'Loss' : t.be ? 'BE' : '—');
  const resultColor = (t: any) => t.win ? 'var(--win)' : t.loss ? 'var(--loss)' : 'var(--text-muted)';
  function pnlColor(pnl: number | null | undefined) {
    if (pnl == null) return 'var(--text-muted)';
    if (pnl > 0) return 'var(--win)';
    if (pnl < 0) return 'var(--loss)';
    return 'var(--text-muted)';
  }
</script>

<svelte:head><title>Sessions — Qulem-Trade</title></svelte:head>

<div class="sessions-page" style="padding:1.5rem;max-width:100%;width:100%;box-sizing:border-box;">
  <div class="page-header">
    <div>
      <h1 class="stat-value">Sessions</h1>
      <p style="color:var(--text-muted);font-size:0.875rem;margin-top:0.125rem;">Market sessions · trades by session · daily journal</p>
    </div>
    <a href="/sessions/{today}" style="padding:0.5rem 0.875rem;background:var(--accent);border-radius:0.5rem;color:#fff;text-decoration:none;font-size:0.875rem;font-weight:500;">
      + Today's Session
    </a>
  </div>

  <!-- Market session analytics -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1rem;margin-bottom:1rem;width:100%;box-sizing:border-box;">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.75rem;">
      <h2 style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">Trades by Session</h2>
      <span class="muted-xs">{(data as any).totalTrades ?? 0} filtered · {(data as any).allTradesCount ?? 0} total</span>
    </div>

    <div style="display:flex;flex-wrap:wrap;gap:0.375rem;align-items:center;margin-bottom:0.75rem;">
      <span style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-right:0.25rem;">Session:</span>
      <button onclick={() => toggleSession('all')} style="padding:0.3rem 0.7rem;border-radius:999px;font-size:0.75rem;font-weight:600;cursor:pointer;border:1px solid {selectedSessions.length===0 ? 'var(--accent)' : 'var(--border)'};background:{selectedSessions.length===0 ? 'var(--accent)' : 'var(--surface)'};color:{selectedSessions.length===0 ? '#fff' : 'var(--text-muted)'};">All</button>
      {#each [['asian','Asian'],['london','London'],['ny','NY'],['overnight','Overnight'],['my','My Session'],['unscheduled','Unscheduled']] as [key,label]}
        {@const active = selectedSessions.includes(key)}
        <button onclick={() => toggleSession(key)} style="padding:0.3rem 0.7rem;border-radius:999px;font-size:0.75rem;font-weight:600;cursor:pointer;border:1px solid {active ? sessionBadgeColor(key as MarketSession) : 'var(--border)'};background:{active ? `color-mix(in srgb, ${sessionBadgeColor(key as MarketSession)} 15%, transparent)` : 'var(--surface)'};color:{active ? sessionBadgeColor(key as MarketSession) : 'var(--text-muted)'};">
          {label} <span style="opacity:0.7;">{countsMap[key] ?? 0}</span>
        </button>
      {/each}
    </div>

    <div style="display:flex;flex-wrap:wrap;gap:0.75rem;align-items:flex-end;margin-bottom:0.75rem;">
      <div>
        <label class="field-label">Result</label>
        <select bind:value={result} onchange={applyFilters} class="input-sm">
          <option value="all">All</option>
          <option value="win">Win</option>
          <option value="loss">Loss</option>
          <option value="be">BE</option>
        </select>
      </div>
      <div>
        <label class="field-label">View TZ</label>
        <select bind:value={viewTz} onchange={applyFilters} class="input-sm">
          <option value="utc">UTC (global-correct)</option>
          <option value="colombo">Colombo (+05:30)</option>
        </select>
      </div>
      <button onclick={applyFilters} style="padding:0.375rem 0.875rem;background:var(--accent);color:#fff;border:none;border-radius:0.375rem;font-size:0.8rem;font-weight:500;cursor:pointer;">Apply</button>
      <button onclick={resetFilters} style="padding:0.375rem 0.75rem;background:transparent;color:var(--text-muted);border:1px solid var(--border);border-radius:0.375rem;font-size:0.8rem;cursor:pointer;">Reset</button>
      <span style="font-size:0.7rem;color:var(--text-muted);margin-left:0.25rem;">My Session {mySessionCfg.start}–{mySessionCfg.end} UTC · <a href="/settings" style="color:var(--accent);text-decoration:none;">edit in Settings</a></span>
    </div>

    {#if (data as any).sessionStats}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.625rem;margin-bottom:0.875rem;">
        {#each (data as any).sessionStats as s}
          {@const isFiltered = selectedSessions.length===0 || selectedSessions.includes(s.session)}
          <div onclick={() => toggleSession(s.session)} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && toggleSession(s.session)} style="background:var(--bg);border:1px solid {isFiltered ? sessionBadgeColor(s.session as MarketSession) : 'var(--border)'};border-radius:0.6rem;padding:0.6rem 0.75rem;opacity:{isFiltered ? 1 : 0.55};cursor:pointer;">
            <div style="font-size:0.7rem;font-weight:700;color:{sessionBadgeColor(s.session as MarketSession)};text-transform:uppercase;letter-spacing:0.04em;">{(SESSION_LABELS as any)[s.session] ?? s.session}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.2rem;">{s.count} trades · {s.winRate.toFixed(1)}% WR</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:0.8rem;font-weight:700;color:{s.netPnl >=0 ? 'var(--win)' : 'var(--loss)'};margin-top:0.15rem;">{formatCurrency(s.netPnl)}</div>
            <div style="font-size:0.68rem;color:var(--text-muted);">avg {formatCurrency(s.avgPnl)} · PF {s.profitFactor == null ? '—' : s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2)}</div>
          </div>
        {/each}
      </div>
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:0.6rem;padding:0.75rem 1rem;overflow-x:auto;">
        <div style="font-size:0.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">Hourly buckets (UTC) — filtered trades only</div>
        <div style="display:flex;gap:2px;align-items:flex-end;height:72px;">
          {#each (data as any).hourlyBuckets as b}
            {@const hbH = b.count ? (b.count / hbMax) * 64 : 4}
            {@const hbWr = b.count ? (b.wins / b.count) : 0}
            <div title="{b.hour}:00 — {b.count} trades, {(hbWr*100).toFixed(0)}% WR, {formatCurrency(b.netPnl)}" style="flex:1;min-width:8px;height:{hbH}px;background:{b.netPnl>0 ? 'var(--win)' : b.netPnl<0 ? 'var(--loss)' : 'var(--border)'};opacity:{0.35 + hbWr*0.65};border-radius:3px 3px 0 0;"></div>
          {/each}
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.6rem;color:var(--text-muted);margin-top:0.25rem;">
          <span>00</span><span>06</span><span>12</span><span>18</span><span>23 UTC</span>
        </div>
      </div>
    {/if}
  </div>

  <!-- Trades by session table -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;overflow:hidden;margin-bottom:1.25rem;width:100%;box-sizing:border-box;">
    <div class="scroll-x">
      <table class="table">
        <thead>
          <tr class="thead-row">
            <th class="th">Date</th>
            <th class="th">Time</th>
            <th class="th">Session</th>
            <th class="th">Coin</th>
            <th class="th">Pos</th>
            <th class="th">PnL</th>
            <th class="th">Result</th>
          </tr>
        </thead>
        <tbody>
          {#if (data as any).trades?.length === 0}
            <tr><td colspan="7" style="padding:2rem;text-align:center;color:var(--text-muted);">No trades match this session filter.</td></tr>
          {:else}
            {#each (data as any).trades ?? [] as trade}
              <tr onclick={() => goto(`/trades/${trade.id}`)} style="border-bottom:1px solid var(--border);cursor:pointer;">
                <td style="padding:0.625rem 0.75rem;color:var(--text-primary);font-family:'JetBrains Mono',monospace;white-space:nowrap;">{formatDate(trade.date)}</td>
                <td style="padding:0.625rem 0.75rem;font-family:'JetBrains Mono',monospace;color:var(--text-muted);font-size:0.75rem;white-space:nowrap;">{formatSessionTime(trade.time, viewTz)}</td>
                <td style="padding:0.625rem 0.75rem;white-space:nowrap;">
                  {#each deriveMarketSessions(trade.time, mySessionCfg) as s}
                    <span style="display:inline-block;padding:0.1rem 0.35rem;border-radius:0.25rem;font-size:0.65rem;font-weight:700;margin-right:0.2rem;background:color-mix(in srgb, {sessionBadgeColor(s as MarketSession)} 14%, transparent);color:{sessionBadgeColor(s as MarketSession)};border:1px solid color-mix(in srgb, {sessionBadgeColor(s as MarketSession)} 30%, transparent);">{(SESSION_LABELS as any)[s] ?? s}</span>
                  {/each}
                </td>
                <td style="padding:0.625rem 0.75rem;font-weight:600;color:var(--text-primary);">{trade.coin}</td>
                <td style="padding:0.625rem 0.75rem;"><span style="padding:0.125rem 0.5rem;border-radius:0.25rem;font-size:0.75rem;font-weight:600;background:{trade.position==='Long' ? 'color-mix(in srgb,var(--win) 15%,transparent)' : 'color-mix(in srgb,var(--loss) 15%,transparent)'};color:{trade.position==='Long' ? 'var(--win)' : 'var(--loss)'};">{trade.position}</span></td>
                <td style="padding:0.625rem 0.75rem;font-family:'JetBrains Mono',monospace;font-weight:600;color:{pnlColor(trade.pnl)};">{formatCurrency(trade.pnl)}</td>
                <td style="padding:0.625rem 0.75rem;"><span style="font-size:0.75rem;font-weight:600;color:{resultColor(trade)};">{resultLabel(trade)}</span></td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
    {#if (data as any).totalTrades > 200}
      <div style="padding:0.6rem 0.75rem;border-top:1px solid var(--border);font-size:0.75rem;color:var(--text-muted);">Showing 200 of {(data as any).totalTrades} — narrow filter to see more.</div>
    {/if}
  </div>

  <!-- Daily journal sessions -->
  <h2 style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">Daily Journal</h2>
  {#if data.sessions.length === 0}
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:3rem;text-align:center;">
      <div style="font-size:2rem;margin-bottom:1rem;">📅</div>
      <p style="color:var(--text-muted);font-size:0.875rem;margin-bottom:1rem;">No sessions logged yet.</p>
      <a href="/sessions/{today}" style="padding:0.625rem 1.25rem;background:var(--accent);color:#fff;border-radius:0.5rem;text-decoration:none;font-size:0.875rem;font-weight:500;">Start Today's Session</a>
    </div>
  {:else}
    <div style="display:flex;flex-direction:column;gap:0.5rem;">
      {#each data.sessions as day}
        <a
          href="/sessions/{day.date}"
          style="display:flex;align-items:center;justify-content:space-between;padding:0.875rem 1rem;background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;text-decoration:none;transition:border-color 0.15s;"
          onmouseenter={(e) => (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'}
          onmouseleave={(e) => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
        >
          <div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:0.875rem;font-weight:600;color:var(--text-primary);">{formatDate(day.date)}</div>
            {#if day.pre?.market_bias}
              <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.125rem;">Bias: {day.pre.market_bias}</div>
            {/if}
          </div>
          <div style="display:flex;gap:1rem;align-items:center;">
            {#each [['pre','👨‍💻 Pre'], ['tcl','☁️ TCL'], ['post','🧠 Post']] as [type, label]}
              <div style="display:flex;flex-direction:column;align-items:center;gap:0.25rem;">
                <div style="width:10px;height:10px;border-radius:50%;background:{dotColor(day[type as 'pre'|'tcl'|'post'])};"></div>
                <span style="font-size:0.65rem;color:var(--text-muted);">{label}</span>
              </div>
            {/each}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
