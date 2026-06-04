<script lang="ts">
  import { formatDate } from '$lib/utils';
  let { data } = $props();

  function dotColor(session: any) {
    return session ? 'var(--win)' : 'var(--border)';
  }

  const today = new Date().toISOString().split('T')[0];
</script>

<svelte:head><title>Sessions — INEVITRADE</title></svelte:head>

<div style="padding:1.5rem;max-width:700px;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;">
    <div>
      <h1 style="font-family:'JetBrains Mono',monospace;font-size:1.25rem;font-weight:600;color:var(--text-primary);">Sessions</h1>
      <p style="color:var(--text-muted);font-size:0.875rem;margin-top:0.125rem;">Daily trading session log</p>
    </div>
    <a href="/sessions/{today}" style="padding:0.5rem 0.875rem;background:var(--accent);border-radius:0.5rem;color:#fff;text-decoration:none;font-size:0.875rem;font-weight:500;">
      + Today's Session
    </a>
  </div>

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
