<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();

  let selectedTradeId = $state(data.prefilledTradeId);
  let tradeDate = $state(data.selectedTrade?.date || new Date().toISOString().split('T')[0]);
  let tradeTime = $state('');
  let coin = $state(data.selectedTrade?.coin || '');
  let whyTookTrade = $state(data.selectedTrade?.reason || '');
  let mistakeDetails = $state('');
  let lessonLearned = $state('');
  let category = $state('FOMO');
  let severity = $state('medium');

  const categories = [
    'FOMO',
    'Over-leveraging',
    'Moved Stop Loss',
    'Early Exit',
    'Revenge Trade',
    'Execution Error',
    'No Plan',
    'Chasing Price',
    'Ignored Bias',
    'Other'
  ];

  const severities = [
    { value: 'low', label: 'Low', color: '#3b82f6' },
    { value: 'medium', label: 'Medium', color: '#f59e0b' },
    { value: 'high', label: 'High', color: '#f97316' },
    { value: 'critical', label: 'Critical', color: '#ef4444' }
  ];

  function handleTradeChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    const tId = target.value;
    selectedTradeId = tId;

    if (tId) {
      const found = data.trades.find((t: any) => t.id === tId);
      if (found) {
        tradeDate = found.date;
        coin = found.coin || '';
        if (found.reason && !whyTookTrade) {
          whyTookTrade = found.reason;
        }
      }
    }
  }
</script>

<svelte:head>
  <title>Log New Mistake — Qulem-Trade</title>
</svelte:head>

<div style="padding:1.5rem;max-width:760px;margin:0 auto;">
  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;">
    <div>
      <h1 class="stat-value-lg">
        Log Trading Mistake
      </h1>
      <p style="color:var(--text-muted);font-size:0.875rem;margin-top:0.25rem;">
        Document what happened, analyze the root cause, and establish rules for next time.
      </p>
    </div>
    <a
      href="/mistakes"
      style="color:var(--text-muted);text-decoration:none;font-size:0.875rem;padding:0.5rem 0.875rem;border:1px solid var(--border);border-radius:0.5rem;"
    >
      Cancel
    </a>
  </div>

  {#if form?.error}
    <div style="background:color-mix(in srgb, var(--loss) 15%, transparent);border:1px solid var(--loss);border-radius:0.5rem;padding:0.875rem 1rem;color:var(--loss);font-size:0.875rem;margin-bottom:1.5rem;">
      {form.error}
    </div>
  {/if}

  <form method="POST" use:enhance style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1.5rem;display:flex;flex-direction:column;gap:1.25rem;">
    <!-- Optional Linked Trade -->
    <div>
      <label class="form-label-lg" for="trade_id">
        Link to Existing Trade (Optional)
      </label>
      <select
        name="trade_id"
        id="trade_id"
        value={selectedTradeId}
        onchange={handleTradeChange}
        class="input-wide"
      >
        <option value="">-- Standalone Mistake (No Trade Linked) --</option>
        {#each data.trades as t}
          <option value={t.id}>
            {t.date} | {t.coin || 'Trade'} ({t.position}) - PnL: {t.pnl !== null ? `$${t.pnl}` : 'N/A'}
          </option>
        {/each}
      </select>
    </div>

    <!-- Date, Time, Coin row -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;">
      <div>
        <label class="form-label-lg" for="trade_date">
          Trade Date *
        </label>
        <input
          type="date"
          name="trade_date"
          id="trade_date"
          bind:value={tradeDate}
          required
          class="input-wide"
        />
      </div>

      <div>
        <label class="form-label-lg" for="trade_time">
          Trade Time
        </label>
        <input
          type="time"
          name="trade_time"
          id="trade_time"
          bind:value={tradeTime}
          class="input-wide"
        />
      </div>

      <div>
        <label class="form-label-lg" for="coin">
          Coin / Asset
        </label>
        <input
          type="text"
          name="coin"
          id="coin"
          placeholder="e.g. BTC, ETH, SOL"
          bind:value={coin}
          style="width:100%;padding:0.625rem 0.875rem;background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;color:var(--text-primary);font-size:0.875rem;font-family:'JetBrains Mono',monospace;"
        />
      </div>
    </div>

    <!-- Category Selector -->
    <div>
      <label style="display:block;font-size:0.8125rem;font-weight:600;color:var(--text-muted);margin-bottom:0.5rem;">
        Mistake Category *
      </label>
      <input type="hidden" name="category" value={category} />
      <div style="display:flex;flex-wrap:wrap;gap:0.5rem;">
        {#each categories as cat}
          <button
            type="button"
            onclick={() => (category = cat)}
            style="padding:0.4rem 0.75rem;border-radius:0.375rem;font-size:0.8125rem;font-weight:600;cursor:pointer;transition:all 0.15s;border:1px solid {category === cat ? 'var(--accent)' : 'var(--border)'};background:{category === cat ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--bg)'};color:{category === cat ? 'var(--accent)' : 'var(--text-muted)'};"
          >
            {cat}
          </button>
        {/each}
      </div>
    </div>

    <!-- Severity Selector -->
    <div>
      <label style="display:block;font-size:0.8125rem;font-weight:600;color:var(--text-muted);margin-bottom:0.5rem;">
        Severity Rating
      </label>
      <input type="hidden" name="severity" value={severity} />
      <div style="display:flex;gap:0.75rem;">
        {#each severities as s}
          <button
            type="button"
            onclick={() => (severity = s.value)}
            style="flex:1;padding:0.5rem;border-radius:0.375rem;font-size:0.8125rem;font-weight:700;cursor:pointer;transition:all 0.15s;border:1px solid {severity === s.value ? s.color : 'var(--border)'};background:{severity === s.value ? `color-mix(in srgb, ${s.color} 15%, transparent)` : 'var(--bg)'};color:{severity === s.value ? s.color : 'var(--text-muted)'};"
          >
            {s.label}
          </button>
        {/each}
      </div>
    </div>

    <!-- Why I took the trade -->
    <div>
      <label style="display:block;font-size:0.8125rem;font-weight:600;color:var(--text-primary);margin-bottom:0.375rem;" for="why_took_trade">
        1. Why did you take this trade? *
      </label>
      <textarea
        name="why_took_trade"
        id="why_took_trade"
        rows="3"
        required
        bind:value={whyTookTrade}
        placeholder="Describe the initial trade setup, thesis, entry signals, or emotions when entering..."
        class="textarea-lg"
      ></textarea>
    </div>

    <!-- What mistake I made -->
    <div>
      <label style="display:block;font-size:0.8125rem;font-weight:600;color:var(--loss);margin-bottom:0.375rem;" for="mistake_details">
        2. What exact mistake did you make? *
      </label>
      <textarea
        name="mistake_details"
        id="mistake_details"
        rows="4"
        required
        bind:value={mistakeDetails}
        placeholder="Provide full details of the mistake (e.g., entered early without confirmation, moved stop loss mid-trade, risked 5% instead of 1%...)"
        class="textarea-lg"
      ></textarea>
    </div>

    <!-- Lesson Learned -->
    <div>
      <label style="display:block;font-size:0.8125rem;font-weight:600;color:var(--win);margin-bottom:0.375rem;" for="lesson_learned">
        3. What lesson did you learn / rule for future trades? *
      </label>
      <textarea
        name="lesson_learned"
        id="lesson_learned"
        rows="3"
        required
        bind:value={lessonLearned}
        placeholder="Formulate a specific, actionable rule to prevent repeating this mistake (e.g. Always wait for 15m candle close before executing)..."
        class="textarea-lg"
      ></textarea>
    </div>

    <!-- Form Actions -->
    <div style="display:flex;align-items:center;justify-content:flex-end;gap:1rem;margin-top:0.5rem;">
      <a
        href="/mistakes"
        class="link-muted"
      >
        Cancel
      </a>
      <button
        type="submit"
        style="padding:0.625rem 1.5rem;background:var(--accent);border:none;border-radius:0.5rem;color:#fff;font-size:0.875rem;font-weight:600;cursor:pointer;"
      >
        Save Mistake Entry
      </button>
    </div>
  </form>
</div>
