<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();

  let activeTab = $state<'pre' | 'tcl' | 'post'>('pre');
  let saving = $state(false);
  let saved = $state(false);

  const tabs: { key: 'pre' | 'tcl' | 'post'; label: string; emoji: string }[] = [
    { key: 'pre', label: 'Pre-Market', emoji: '👨‍💻' },
    { key: 'tcl', label: 'Mid-Day', emoji: '☁️' },
    { key: 'post', label: 'Post-Market', emoji: '🧠' },
  ];

  function formatDate(dateStr: string) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  function hasData(session: any) {
    return session != null;
  }

  $effect(() => {
    if (form?.success) {
      saved = true;
      setTimeout(() => { saved = false; }, 2000);
    }
  });
</script>

<svelte:head><title>Session {data.date} — Qulem-Trade</title></svelte:head>

<div style="padding:1.5rem;max-width:760px;">
  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;">
    <div>
      <a href="/sessions" style="font-size:0.75rem;color:var(--text-muted);text-decoration:none;display:flex;align-items:center;gap:0.25rem;margin-bottom:0.375rem;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        Sessions
      </a>
      <h1 style="font-family:'JetBrains Mono',monospace;font-size:1.125rem;font-weight:600;color:var(--text-primary);">{formatDate(data.date)}</h1>
    </div>
    {#if saved}
      <div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.875rem;background:color-mix(in srgb,var(--win) 12%,transparent);border:1px solid color-mix(in srgb,var(--win) 30%,transparent);border-radius:0.5rem;color:var(--win);font-size:0.8rem;font-weight:500;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        Saved
      </div>
    {/if}
  </div>

  <!-- Tabs -->
  <div style="display:flex;gap:0.375rem;margin-bottom:1.25rem;background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:0.375rem;">
    {#each tabs as tab}
      {@const done = hasData(data[tab.key])}
      <button
        onclick={() => activeTab = tab.key}
        style="
          flex:1;display:flex;align-items:center;justify-content:center;gap:0.5rem;
          padding:0.5rem 0.75rem;border-radius:0.5rem;border:none;cursor:pointer;
          font-size:0.875rem;font-weight:{activeTab === tab.key ? '600' : '400'};
          background:{activeTab === tab.key ? 'var(--bg)' : 'transparent'};
          color:{activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)'};
          transition:all 0.15s;
        "
      >
        <span>{tab.emoji}</span>
        <span>{tab.label}</span>
        {#if done}
          <span style="width:6px;height:6px;border-radius:50%;background:var(--win);flex-shrink:0;"></span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Pre-market form -->
  {#if activeTab === 'pre'}
    <form method="POST" action="?/save" use:enhance={() => {
      saving = true;
      return async ({ update }) => { await update(); saving = false; };
    }}>
      <input type="hidden" name="session_type" value="pre" />

      <div style="display:flex;flex-direction:column;gap:1rem;">
        <!-- Market Bias -->
        <div class="card">
          <label class="section-label">
            Market Bias
          </label>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
            {#each ['Bullish', 'Bearish', 'Neutral', 'Ranging'] as bias}
              {@const checked = data.pre?.market_bias === bias}
              <label style="display:flex;align-items:center;gap:0.375rem;padding:0.375rem 0.75rem;border-radius:0.5rem;border:1px solid {checked ? 'var(--accent)' : 'var(--border)'};background:{checked ? 'color-mix(in srgb,var(--accent) 10%,transparent)' : 'transparent'};cursor:pointer;font-size:0.875rem;color:{checked ? 'var(--accent)' : 'var(--text-muted)'};">
                <input type="radio" name="market_bias" value={bias} checked={checked} style="display:none;" />
                {bias}
              </label>
            {/each}
          </div>
        </div>

        <!-- Key Levels -->
        <div class="card">
          <label class="section-label">
            Key Levels
          </label>
          <textarea
            name="key_levels"
            placeholder="Support / resistance levels, liquidation zones, important price areas..."
            value={data.pre?.key_levels ?? ''}
            style="width:100%;min-height:80px;background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;padding:0.625rem 0.75rem;color:var(--text-primary);font-size:0.875rem;font-family:'JetBrains Mono',monospace;resize:vertical;box-sizing:border-box;"
          ></textarea>
        </div>

        <!-- Watchlist -->
        <div class="card">
          <label class="section-label">
            Watchlist
          </label>
          <textarea
            name="watchlist"
            placeholder="Coins/pairs to watch today and why..."
            value={data.pre?.watchlist ?? ''}
            class="textarea"
          ></textarea>
        </div>

        <!-- Plan -->
        <div class="card">
          <label class="section-label">
            Trading Plan
          </label>
          <textarea
            name="plan"
            placeholder="Entry criteria, risk parameters, max trades, session targets..."
            value={data.pre?.plan ?? ''}
            style="width:100%;min-height:100px;background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;padding:0.625rem 0.75rem;color:var(--text-primary);font-size:0.875rem;resize:vertical;box-sizing:border-box;"
          ></textarea>
        </div>

        <!-- Notes -->
        <div class="card">
          <label class="section-label">
            Additional Notes
          </label>
          <textarea
            name="notes"
            placeholder="News events, macro context, anything else relevant..."
            value={data.pre?.notes ?? ''}
            class="textarea"
          ></textarea>
        </div>

        <button
          type="submit"
          disabled={saving}
          style="padding:0.625rem 1.25rem;background:var(--accent);color:#fff;border:none;border-radius:0.5rem;font-size:0.875rem;font-weight:500;cursor:pointer;align-self:flex-end;opacity:{saving ? 0.7 : 1};"
        >
          {saving ? 'Saving…' : 'Save Pre-Market'}
        </button>
      </div>
    </form>

  <!-- Mid-day (TCL) form -->
  {:else if activeTab === 'tcl'}
    <form method="POST" action="?/save" use:enhance={() => {
      saving = true;
      return async ({ update }) => { await update(); saving = false; };
    }}>
      <input type="hidden" name="session_type" value="tcl" />

      <div style="display:flex;flex-direction:column;gap:1rem;">
        <div class="card">
          <label class="section-label">
            Market Observations
          </label>
          <textarea
            name="observations"
            placeholder="How is the market behaving? Any changes from pre-market expectations?"
            value={data.tcl?.observations ?? ''}
            style="width:100%;min-height:100px;background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;padding:0.625rem 0.75rem;color:var(--text-primary);font-size:0.875rem;resize:vertical;box-sizing:border-box;"
          ></textarea>
        </div>

        <div class="card">
          <label class="section-label">
            Active Trades
          </label>
          <textarea
            name="active_trades"
            placeholder="Current open positions, their status, and management notes..."
            value={data.tcl?.active_trades ?? ''}
            style="width:100%;min-height:80px;background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;padding:0.625rem 0.75rem;color:var(--text-primary);font-size:0.875rem;font-family:'JetBrains Mono',monospace;resize:vertical;box-sizing:border-box;"
          ></textarea>
        </div>

        <div class="card">
          <label class="section-label">
            Adjustments
          </label>
          <textarea
            name="adjustments"
            placeholder="Plan changes, SL/TP moves, position sizing adjustments..."
            value={data.tcl?.adjustments ?? ''}
            class="textarea"
          ></textarea>
        </div>

        <div class="card">
          <label class="section-label">
            Notes
          </label>
          <textarea
            name="notes"
            placeholder="Anything else worth noting mid-session..."
            value={data.tcl?.notes ?? ''}
            class="textarea"
          ></textarea>
        </div>

        <button
          type="submit"
          disabled={saving}
          style="padding:0.625rem 1.25rem;background:var(--accent);color:#fff;border:none;border-radius:0.5rem;font-size:0.875rem;font-weight:500;cursor:pointer;align-self:flex-end;opacity:{saving ? 0.7 : 1};"
        >
          {saving ? 'Saving…' : 'Save Mid-Day'}
        </button>
      </div>
    </form>

  <!-- Post-market form -->
  {:else}
    <form method="POST" action="?/save" use:enhance={() => {
      saving = true;
      return async ({ update }) => { await update(); saving = false; };
    }}>
      <input type="hidden" name="session_type" value="post" />

      <div style="display:flex;flex-direction:column;gap:1rem;">
        <div class="card">
          <label class="section-label">
            Session Review
          </label>
          <textarea
            name="review"
            placeholder="How did the session go? Did you follow the plan? What worked?"
            value={data.post?.review ?? ''}
            style="width:100%;min-height:100px;background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;padding:0.625rem 0.75rem;color:var(--text-primary);font-size:0.875rem;resize:vertical;box-sizing:border-box;"
          ></textarea>
        </div>

        <div class="card">
          <label class="section-label">
            Mistakes
          </label>
          <textarea
            name="mistakes"
            placeholder="What went wrong? Emotional trades, rule breaks, missed setups..."
            value={data.post?.mistakes ?? ''}
            class="textarea"
          ></textarea>
        </div>

        <div class="card">
          <label class="section-label">
            Lessons Learned
          </label>
          <textarea
            name="lessons"
            placeholder="What would you do differently? Key takeaways for next session..."
            value={data.post?.lessons ?? ''}
            class="textarea"
          ></textarea>
        </div>

        <!-- Emotion Rating -->
        <div class="card">
          <label class="section-label">
            Emotional Control Rating
          </label>
          <div style="display:flex;gap:0.5rem;">
            {#each [1, 2, 3, 4, 5] as rating}
              {@const checked = data.post?.emotion_rating === rating}
              {@const labels = ['', 'Poor', 'Below Avg', 'Average', 'Good', 'Excellent']}
              <label style="
                flex:1;display:flex;flex-direction:column;align-items:center;gap:0.375rem;
                padding:0.625rem;border-radius:0.5rem;border:1px solid {checked ? 'var(--accent)' : 'var(--border)'};
                background:{checked ? 'color-mix(in srgb,var(--accent) 10%,transparent)' : 'transparent'};
                cursor:pointer;
              ">
                <input type="radio" name="emotion_rating" value={rating} checked={checked} style="display:none;" />
                <span style="font-family:'JetBrains Mono',monospace;font-size:1.125rem;font-weight:700;color:{checked ? 'var(--accent)' : 'var(--text-primary)'};">{rating}</span>
                <span style="font-size:0.65rem;color:var(--text-muted);text-align:center;">{labels[rating]}</span>
              </label>
            {/each}
          </div>
        </div>

        <div class="card">
          <label class="section-label">
            Notes
          </label>
          <textarea
            name="notes"
            placeholder="Any other post-session thoughts..."
            value={data.post?.notes ?? ''}
            class="textarea"
          ></textarea>
        </div>

        <button
          type="submit"
          disabled={saving}
          style="padding:0.625rem 1.25rem;background:var(--accent);color:#fff;border:none;border-radius:0.5rem;font-size:0.875rem;font-weight:500;cursor:pointer;align-self:flex-end;opacity:{saving ? 0.7 : 1};"
        >
          {saving ? 'Saving…' : 'Save Post-Market'}
        </button>
      </div>
    </form>
  {/if}
</div>
