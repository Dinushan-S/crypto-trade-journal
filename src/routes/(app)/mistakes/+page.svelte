<script lang="ts">
  import { formatDate } from '$lib/utils';

  let { data } = $props();

  let searchQuery = $state('');
  let selectedCategory = $state('All');

  const categories = [
    'All',
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

  function getSeverityColor(severity: string) {
    switch (severity) {
      case 'low': return { bg: 'color-mix(in srgb, #3b82f6 15%, transparent)', color: '#3b82f6' };
      case 'medium': return { bg: 'color-mix(in srgb, #f59e0b 15%, transparent)', color: '#f59e0b' };
      case 'high': return { bg: 'color-mix(in srgb, #f97316 15%, transparent)', color: '#f97316' };
      case 'critical': return { bg: 'color-mix(in srgb, #ef4444 20%, transparent)', color: '#ef4444' };
      default: return { bg: 'color-mix(in srgb, #6b7280 15%, transparent)', color: '#9ca3af' };
    }
  }

  let filteredMistakes = $derived(
    data.mistakes.filter((m: any) => {
      const matchesCategory = selectedCategory === 'All' || m.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (m.coin && m.coin.toLowerCase().includes(q)) ||
        (m.why_took_trade && m.why_took_trade.toLowerCase().includes(q)) ||
        (m.mistake_details && m.mistake_details.toLowerCase().includes(q)) ||
        (m.lesson_learned && m.lesson_learned.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    })
  );
</script>

<svelte:head>
  <title>Mistakes Journal — Qulem-Trade</title>
</svelte:head>

<div style="padding:1.5rem;max-width:1100px;margin:0 auto;">
  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem;">
    <div>
      <h1 style="font-family:'JetBrains Mono',monospace;font-size:1.5rem;font-weight:700;color:var(--text-primary);">
        Mistakes Journal
      </h1>
      <p style="color:var(--text-muted);font-size:0.875rem;margin-top:0.25rem;">
        Track mistakes, analyze behavioral patterns, and review lessons learned.
      </p>
    </div>
    <a
      href="/mistakes/new"
      style="padding:0.625rem 1.25rem;background:var(--accent);border:none;border-radius:0.5rem;color:#fff;text-decoration:none;font-size:0.875rem;font-weight:600;display:inline-flex;align-items:center;gap:0.5rem;"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      Log Mistake
    </a>
  </div>

  <!-- Summary Cards Bar -->
  <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:1rem;margin-bottom:1.5rem;">
    <!-- Total Mistakes -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1.25rem;">
      <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">
        Total Mistakes Logged
      </div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:1.75rem;font-weight:700;color:var(--text-primary);margin-top:0.375rem;">
        {data.totalMistakes}
      </div>
    </div>

    <!-- Top Category -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1.25rem;">
      <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">
        Top Mistake Trigger
      </div>
      <div style="display:flex;align-items:baseline;gap:0.5rem;margin-top:0.375rem;">
        <span style="font-family:'JetBrains Mono',monospace;font-size:1.375rem;font-weight:700;color:var(--text-primary);">
          {data.topCategory}
        </span>
        {#if data.topCategoryCount > 0}
          <span style="font-size:0.8125rem;color:var(--text-muted);">
            ({data.topCategoryCount} times)
          </span>
        {/if}
      </div>
    </div>

    <!-- Lessons Learned -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1.25rem;">
      <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">
        Actionable Lessons Recorded
      </div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:1.75rem;font-weight:700;color:var(--win);margin-top:0.375rem;">
        {data.lessonsCount}
      </div>
    </div>
  </div>

  <!-- Search & Category Filter Bar -->
  <div style="display:flex;gap:0.75rem;margin-bottom:1.5rem;flex-wrap:wrap;align-items:center;">
    <div style="flex:1;min-width:240px;position:relative;">
      <input
        type="text"
        placeholder="Search mistakes, trade reasons, or lessons..."
        bind:value={searchQuery}
        style="width:100%;padding:0.625rem 0.875rem 0.625rem 2.25rem;background:var(--surface);border:1px solid var(--border);border-radius:0.5rem;color:var(--text-primary);font-size:0.875rem;"
      />
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--text-muted)"
        stroke-width="2"
        style="position:absolute;left:0.75rem;top:50%;transform:translateY(-50%);"
      >
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    </div>

    <div style="display:flex;align-items:center;gap:0.5rem;">
      <span style="font-size:0.8125rem;color:var(--text-muted);">Category:</span>
      <select
        bind:value={selectedCategory}
        style="padding:0.625rem 0.875rem;background:var(--surface);border:1px solid var(--border);border-radius:0.5rem;color:var(--text-primary);font-size:0.875rem;cursor:pointer;"
      >
        {#each categories as cat}
          <option value={cat}>{cat}</option>
        {/each}
      </select>
    </div>
  </div>

  <!-- Mistakes Cards Grid -->
  {#if filteredMistakes.length === 0}
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:3rem;text-align:center;">
      <p style="color:var(--text-muted);font-size:0.9375rem;">
        {#if data.mistakes.length === 0}
          No mistakes recorded yet. Keeping track of mistakes helps build trading discipline.
        {:else}
          No mistakes matched your search criteria.
        {/if}
      </p>
      {#if data.mistakes.length === 0}
        <a
          href="/mistakes/new"
          style="display:inline-block;margin-top:1rem;padding:0.5rem 1rem;background:var(--accent);color:#fff;border-radius:0.5rem;text-decoration:none;font-size:0.875rem;font-weight:600;"
        >
          Log Your First Mistake
        </a>
      {/if}
    </div>
  {:else}
    <div style="display:flex;flex-direction:column;gap:1.25rem;">
      {#each filteredMistakes as mistake}
        {@const sevStyle = getSeverityColor(mistake.severity)}
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1.25rem;display:flex;flex-direction:column;gap:1rem;">
          <!-- Card Header -->
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;border-bottom:1px solid var(--border);padding-bottom:0.75rem;">
            <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">
              <span style="font-family:'JetBrains Mono',monospace;font-size:0.875rem;color:var(--text-muted);font-weight:500;">
                {formatDate(mistake.trade_date)} {#if mistake.trade_time}at {mistake.trade_time.slice(0,5)}{/if}
              </span>

              {#if mistake.coin}
                <span style="padding:0.125rem 0.5rem;background:color-mix(in srgb, var(--accent) 15%, transparent);color:var(--accent);border-radius:0.25rem;font-size:0.75rem;font-weight:700;font-family:'JetBrains Mono',monospace;">
                  {mistake.coin}
                </span>
              {/if}

              <span style="padding:0.125rem 0.625rem;background:color-mix(in srgb, var(--text-primary) 8%, transparent);color:var(--text-primary);border-radius:0.25rem;font-size:0.75rem;font-weight:600;">
                {mistake.category}
              </span>

              <span style="padding:0.125rem 0.5rem;background:{sevStyle.bg};color:{sevStyle.color};border-radius:0.25rem;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">
                {mistake.severity}
              </span>
            </div>

            <!-- Card Actions & Linked Trade -->
            <div style="display:flex;align-items:center;gap:0.75rem;">
              {#if mistake.trade_id}
                <a
                  href="/trades/{mistake.trade_id}"
                  style="font-size:0.8125rem;color:var(--accent);text-decoration:none;display:inline-flex;align-items:center;gap:0.25rem;"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  View Trade
                </a>
              {/if}

              <a
                href="/mistakes/{mistake.id}"
                style="font-size:0.8125rem;color:var(--text-muted);text-decoration:none;padding:0.25rem 0.5rem;border-radius:0.25rem;border:1px solid var(--border);"
              >
                Edit
              </a>

              <form method="POST" action="?/delete" style="display:inline;">
                <input type="hidden" name="id" value={mistake.id} />
                <button
                  type="submit"
                  onclick={(e) => { if (!confirm('Are you sure you want to delete this mistake entry?')) e.preventDefault(); }}
                  style="background:none;border:none;color:var(--loss);font-size:0.8125rem;cursor:pointer;padding:0.25rem 0.5rem;"
                >
                  Delete
                </button>
              </form>
            </div>
          </div>

          <!-- Section: Why Trade Was Taken -->
          <div>
            <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;font-weight:600;margin-bottom:0.25rem;">
              Why I took the trade:
            </div>
            <p style="font-size:0.9375rem;color:var(--text-primary);line-height:1.5;white-space:pre-wrap;">
              {mistake.why_took_trade}
            </p>
          </div>

          <!-- Section: What Mistake Was Made -->
          <div style="background:color-mix(in srgb, var(--loss) 6%, transparent);border-left:3px solid var(--loss);padding:0.75rem 1rem;border-radius:0.375rem;">
            <div style="font-size:0.75rem;color:var(--loss);text-transform:uppercase;letter-spacing:0.05em;font-weight:700;margin-bottom:0.25rem;">
              Mistake Details:
            </div>
            <p style="font-size:0.9375rem;color:var(--text-primary);line-height:1.5;white-space:pre-wrap;">
              {mistake.mistake_details}
            </p>
          </div>

          <!-- Section: Lesson Learned -->
          <div style="background:color-mix(in srgb, var(--win) 8%, transparent);border-left:3px solid var(--win);padding:0.75rem 1rem;border-radius:0.375rem;">
            <div style="font-size:0.75rem;color:var(--win);text-transform:uppercase;letter-spacing:0.05em;font-weight:700;margin-bottom:0.25rem;">
              Lesson Learned / Rule to Follow:
            </div>
            <p style="font-size:0.9375rem;color:var(--text-primary);line-height:1.5;white-space:pre-wrap;font-weight:500;">
              {mistake.lesson_learned}
            </p>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
