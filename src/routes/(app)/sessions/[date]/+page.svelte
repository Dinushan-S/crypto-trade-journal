<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// The forms below read fields that the save action does not persist yet (only market_bias,
	// session_notes and what_right are stored), so these always render empty for now.
	type SessionForm = {
		market_bias?: string;
		key_levels?: string;
		watchlist?: string[];
		plan?: string;
		notes?: string;
		observations?: string;
		active_trades?: string;
		adjustments?: string;
		review?: string;
		mistakes?: string;
		lessons?: string;
		emotion_rating?: number;
	};
	const pre = $derived(data.pre as SessionForm | null);
	const tcl = $derived(data.tcl as SessionForm | null);
	const post = $derived(data.post as SessionForm | null);

	let activeTab = $state<'pre' | 'tcl' | 'post'>('pre');
	let saving = $state(false);
	let saved = $state(false);

	const tabs: { key: 'pre' | 'tcl' | 'post'; label: string; emoji: string }[] = [
		{ key: 'pre', label: 'Pre-Market', emoji: '👨‍💻' },
		{ key: 'tcl', label: 'Mid-Day', emoji: '☁️' },
		{ key: 'post', label: 'Post-Market', emoji: '🧠' }
	];

	function formatDate(dateStr: string) {
		return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function hasData(session: unknown) {
		return session != null;
	}

	$effect(() => {
		if (form?.success) {
			saved = true;
			setTimeout(() => {
				saved = false;
			}, 2000);
		}
	});
</script>

<svelte:head><title>Session {data.date} — Qulem-Trade</title></svelte:head>

<div style="padding:1.5rem;max-width:760px;">
	<!-- Header -->
	<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;">
		<div>
			<a
				href={resolve('/sessions')}
				style="font-size:0.75rem;color:var(--text-muted);text-decoration:none;display:flex;align-items:center;gap:0.25rem;margin-bottom:0.375rem;"
			>
				<svg
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"><polyline points="15 18 9 12 15 6" /></svg
				>
				Sessions
			</a>
			<h1
				style="font-family:'JetBrains Mono',monospace;font-size:1.125rem;font-weight:600;color:var(--text-primary);"
			>
				{formatDate(data.date)}
			</h1>
		</div>
		{#if saved}
			<div
				style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.875rem;background:color-mix(in srgb,var(--win) 12%,transparent);border:1px solid color-mix(in srgb,var(--win) 30%,transparent);border-radius:0.5rem;color:var(--win);font-size:0.8rem;font-weight:500;"
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"><polyline points="20 6 9 17 4 12" /></svg
				>
				Saved
			</div>
		{/if}
	</div>

	<!-- Tabs -->
	<div
		style="display:flex;gap:0.375rem;margin-bottom:1.25rem;background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:0.375rem;"
	>
		{#each tabs as tab (tab.key)}
			{@const done = hasData(data[tab.key])}
			<button
				onclick={() => (activeTab = tab.key)}
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
					<span style="width:6px;height:6px;border-radius:50%;background:var(--win);flex-shrink:0;"
					></span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Pre-market form -->
	{#if activeTab === 'pre'}
		<form
			method="POST"
			action="?/save"
			use:enhance={() => {
				saving = true;
				return async ({ update }) => {
					await update();
					saving = false;
				};
			}}
		>
			<input type="hidden" name="session_type" value="pre" />

			<div style="display:flex;flex-direction:column;gap:1rem;">
				<!-- Market Bias -->
				<div class="card">
					<span class="section-label"> Market Bias </span>
					<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
						{#each ['Bullish', 'Bearish', 'Neutral', 'Ranging'] as bias (bias)}
							{@const checked = pre?.market_bias === bias}
							<label
								style="display:flex;align-items:center;gap:0.375rem;padding:0.375rem 0.75rem;border-radius:0.5rem;border:1px solid {checked
									? 'var(--accent)'
									: 'var(--border)'};background:{checked
									? 'color-mix(in srgb,var(--accent) 10%,transparent)'
									: 'transparent'};cursor:pointer;font-size:0.875rem;color:{checked
									? 'var(--accent)'
									: 'var(--text-muted)'};"
							>
								<input
									type="radio"
									name="market_bias"
									value={bias}
									{checked}
									style="display:none;"
								/>
								{bias}
							</label>
						{/each}
					</div>
				</div>

				<!-- Key Levels -->
				<div class="card">
					<label class="section-label" for="session-key_levels"> Key Levels </label>
					<textarea
						id="session-key_levels"
						name="key_levels"
						placeholder="Support / resistance levels, liquidation zones, important price areas..."
						value={pre?.key_levels ?? ''}
						style="width:100%;min-height:80px;background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;padding:0.625rem 0.75rem;color:var(--text-primary);font-size:0.875rem;font-family:'JetBrains Mono',monospace;resize:vertical;box-sizing:border-box;"
					></textarea>
				</div>

				<!-- Watchlist -->
				<div class="card">
					<label class="section-label" for="session-watchlist"> Watchlist </label>
					<textarea
						id="session-watchlist"
						name="watchlist"
						placeholder="Coins/pairs to watch today and why..."
						value={pre?.watchlist ?? ''}
						class="textarea"
					></textarea>
				</div>

				<!-- Plan -->
				<div class="card">
					<label class="section-label" for="session-plan"> Trading Plan </label>
					<textarea
						id="session-plan"
						name="plan"
						placeholder="Entry criteria, risk parameters, max trades, session targets..."
						value={pre?.plan ?? ''}
						style="width:100%;min-height:100px;background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;padding:0.625rem 0.75rem;color:var(--text-primary);font-size:0.875rem;resize:vertical;box-sizing:border-box;"
					></textarea>
				</div>

				<!-- Notes -->
				<div class="card">
					<label class="section-label" for="session-notes"> Additional Notes </label>
					<textarea
						id="session-notes"
						name="notes"
						placeholder="News events, macro context, anything else relevant..."
						value={pre?.notes ?? ''}
						class="textarea"
					></textarea>
				</div>

				<button
					type="submit"
					disabled={saving}
					style="padding:0.625rem 1.25rem;background:var(--accent);color:#fff;border:none;border-radius:0.5rem;font-size:0.875rem;font-weight:500;cursor:pointer;align-self:flex-end;opacity:{saving
						? 0.7
						: 1};"
				>
					{saving ? 'Saving…' : 'Save Pre-Market'}
				</button>
			</div>
		</form>

		<!-- Mid-day (TCL) form -->
	{:else if activeTab === 'tcl'}
		<form
			method="POST"
			action="?/save"
			use:enhance={() => {
				saving = true;
				return async ({ update }) => {
					await update();
					saving = false;
				};
			}}
		>
			<input type="hidden" name="session_type" value="tcl" />

			<div style="display:flex;flex-direction:column;gap:1rem;">
				<div class="card">
					<label class="section-label" for="session-observations"> Market Observations </label>
					<textarea
						id="session-observations"
						name="observations"
						placeholder="How is the market behaving? Any changes from pre-market expectations?"
						value={tcl?.observations ?? ''}
						style="width:100%;min-height:100px;background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;padding:0.625rem 0.75rem;color:var(--text-primary);font-size:0.875rem;resize:vertical;box-sizing:border-box;"
					></textarea>
				</div>

				<div class="card">
					<label class="section-label" for="session-active_trades"> Active Trades </label>
					<textarea
						id="session-active_trades"
						name="active_trades"
						placeholder="Current open positions, their status, and management notes..."
						value={tcl?.active_trades ?? ''}
						style="width:100%;min-height:80px;background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;padding:0.625rem 0.75rem;color:var(--text-primary);font-size:0.875rem;font-family:'JetBrains Mono',monospace;resize:vertical;box-sizing:border-box;"
					></textarea>
				</div>

				<div class="card">
					<label class="section-label" for="session-adjustments"> Adjustments </label>
					<textarea
						id="session-adjustments"
						name="adjustments"
						placeholder="Plan changes, SL/TP moves, position sizing adjustments..."
						value={tcl?.adjustments ?? ''}
						class="textarea"
					></textarea>
				</div>

				<div class="card">
					<label class="section-label" for="session-notes"> Notes </label>
					<textarea
						id="session-notes"
						name="notes"
						placeholder="Anything else worth noting mid-session..."
						value={tcl?.notes ?? ''}
						class="textarea"
					></textarea>
				</div>

				<button
					type="submit"
					disabled={saving}
					style="padding:0.625rem 1.25rem;background:var(--accent);color:#fff;border:none;border-radius:0.5rem;font-size:0.875rem;font-weight:500;cursor:pointer;align-self:flex-end;opacity:{saving
						? 0.7
						: 1};"
				>
					{saving ? 'Saving…' : 'Save Mid-Day'}
				</button>
			</div>
		</form>

		<!-- Post-market form -->
	{:else}
		<form
			method="POST"
			action="?/save"
			use:enhance={() => {
				saving = true;
				return async ({ update }) => {
					await update();
					saving = false;
				};
			}}
		>
			<input type="hidden" name="session_type" value="post" />

			<div style="display:flex;flex-direction:column;gap:1rem;">
				<div class="card">
					<label class="section-label" for="session-review"> Session Review </label>
					<textarea
						id="session-review"
						name="review"
						placeholder="How did the session go? Did you follow the plan? What worked?"
						value={post?.review ?? ''}
						style="width:100%;min-height:100px;background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;padding:0.625rem 0.75rem;color:var(--text-primary);font-size:0.875rem;resize:vertical;box-sizing:border-box;"
					></textarea>
				</div>

				<div class="card">
					<label class="section-label" for="session-mistakes"> Mistakes </label>
					<textarea
						id="session-mistakes"
						name="mistakes"
						placeholder="What went wrong? Emotional trades, rule breaks, missed setups..."
						value={post?.mistakes ?? ''}
						class="textarea"
					></textarea>
				</div>

				<div class="card">
					<label class="section-label" for="session-lessons"> Lessons Learned </label>
					<textarea
						id="session-lessons"
						name="lessons"
						placeholder="What would you do differently? Key takeaways for next session..."
						value={post?.lessons ?? ''}
						class="textarea"
					></textarea>
				</div>

				<!-- Emotion Rating -->
				<div class="card">
					<span class="section-label"> Emotional Control Rating </span>
					<div style="display:flex;gap:0.5rem;">
						{#each [1, 2, 3, 4, 5] as rating (rating)}
							{@const checked = post?.emotion_rating === rating}
							{@const labels = ['', 'Poor', 'Below Avg', 'Average', 'Good', 'Excellent']}
							<label
								style="
                flex:1;display:flex;flex-direction:column;align-items:center;gap:0.375rem;
                padding:0.625rem;border-radius:0.5rem;border:1px solid {checked
									? 'var(--accent)'
									: 'var(--border)'};
                background:{checked
									? 'color-mix(in srgb,var(--accent) 10%,transparent)'
									: 'transparent'};
                cursor:pointer;
              "
							>
								<input
									type="radio"
									name="emotion_rating"
									value={rating}
									{checked}
									style="display:none;"
								/>
								<span
									style="font-family:'JetBrains Mono',monospace;font-size:1.125rem;font-weight:700;color:{checked
										? 'var(--accent)'
										: 'var(--text-primary)'};">{rating}</span
								>
								<span style="font-size:0.65rem;color:var(--text-muted);text-align:center;"
									>{labels[rating]}</span
								>
							</label>
						{/each}
					</div>
				</div>

				<div class="card">
					<label class="section-label" for="session-notes"> Notes </label>
					<textarea
						id="session-notes"
						name="notes"
						placeholder="Any other post-session thoughts..."
						value={post?.notes ?? ''}
						class="textarea"
					></textarea>
				</div>

				<button
					type="submit"
					disabled={saving}
					style="padding:0.625rem 1.25rem;background:var(--accent);color:#fff;border:none;border-radius:0.5rem;font-size:0.875rem;font-weight:500;cursor:pointer;align-self:flex-end;opacity:{saving
						? 0.7
						: 1};"
				>
					{saving ? 'Saving…' : 'Save Post-Market'}
				</button>
			</div>
		</form>
	{/if}
</div>
