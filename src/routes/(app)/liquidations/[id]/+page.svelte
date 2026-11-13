<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { formatCurrency, formatDate } from '$lib/utils';

	let { data, form } = $props();
	const liquidation = $derived(data.detail.liquidation);
	const linkedTrades = $derived(data.detail.linkedTrades ?? []);
	const aggregated = $derived(data.detail.aggregated);
	let formError = $state('');
	let editing = $state(untrack(() => data.edit));
	let saving = $state(false);
	let linking = $state(false);

	function pnlColor(pnl: number | null | undefined): string {
		if (pnl == null) return 'var(--text-muted)';
		if (pnl > 0) return 'var(--win)';
		if (pnl < 0) return 'var(--loss)';
		return 'var(--text-muted)';
	}

	// Delete confirmation dialog
	let showDeleteDialog = $state(false);
	let deleting = $state(false);

	// Trade picker modal state
	let showModal = $state(false);
	const allUserTrades = $derived(data.availableTrades ?? []);
	let modalCoinFilter = $state('');
	let modalResultFilter = $state('all');
	let modalSearchPage = $state(1);
	const MODAL_PAGE_SIZE = 30;

	// Selection within modal
	let selectedModalIds = $state(new Set<string>());

	// Filtered trades from modal
	const filteredTrades = $derived(
		allUserTrades.filter((t: any) => {
			if (modalCoinFilter && !(t.coin ?? '').toLowerCase().includes(modalCoinFilter.toLowerCase()))
				return false;
			if (modalResultFilter === 'win' && !t.win) return false;
			if (modalResultFilter === 'loss' && !t.loss) return false;
			if (modalResultFilter === 'be' && !t.be) return false;
			return true;
		})
	);

	const totalFilteredPages = $derived(
		Math.max(1, Math.ceil(filteredTrades.length / MODAL_PAGE_SIZE))
	);

	const pagedTrades = $derived(
		filteredTrades.slice((modalSearchPage - 1) * MODAL_PAGE_SIZE, modalSearchPage * MODAL_PAGE_SIZE)
	);

	const alreadyLinkedIds = $derived(new Set(linkedTrades.map((t: any) => t._id)));

	const allModalSelected = $derived(
		pagedTrades.length > 0 && pagedTrades.every((t: any) => selectedModalIds.has(t._id))
	);

	function getAvailableTrades(): any[] {
		return allUserTrades.filter((t: any) => !alreadyLinkedIds.has(t._id));
	}

	function openModal() {
		modalSearchPage = 1;
		showModal = true;
		formError = '';
		// Pre-select already-linked trades (shown as disabled)
		selectedModalIds.clear();
		for (const trade of linkedTrades) {
			selectedModalIds.add(trade._id);
		}
	}

	function closeModal() {
		showModal = false;
	}

	function toggleModalSelectAll(checked: boolean) {
		if (checked) {
			pagedTrades.forEach((t: any) => {
				if (!alreadyLinkedIds.has(t._id)) selectedModalIds.add(t._id);
			});
		} else {
			pagedTrades.forEach((t: any) => {
				if (!alreadyLinkedIds.has(t._id)) selectedModalIds.delete(t._id);
			});
		}
	}

	function toggleModalTradeSelect(tradeId: string, checked: boolean) {
		if (checked) selectedModalIds.add(tradeId);
		else selectedModalIds.delete(tradeId);
	}

	const selectedCount = $derived(selectedModalIds.size - linkedTrades.length);
	const hasAnyUnlinkedSelected = $derived(selectedCount > 0);

	function clearErrors() {
		formError = '';
		form = null;
	}
</script>

<svelte:head><title>Liquidation — Qulem-Trade</title></svelte:head>

<div class="page">
	<!-- Error banner -->
	{#if formError || form?.error}
		<button
			type="button"
			onclick={clearErrors}
			style="background:color-mix(in srgb,var(--loss) 10%,transparent);border:1px solid var(--loss);border-radius:0.75rem;padding:0.75rem 1rem;margin-bottom:1rem;color:var(--loss);font-size:0.875rem;cursor:pointer;display:flex;align-items:center;justify-content:space-between;"
		>
			<span>⚠ {formError || form?.error}</span>
			<span style="font-weight:700;margin-left:1rem;opacity:0.7;">✕</span>
		</button>
	{/if}

	<!-- Header -->
	<div class="page-header">
		<div style="display:flex;align-items:center;gap:1rem;">
			<a href="/liquidations" class="link-muted">← Liquidations</a>
			<h1 class="stat-value">Liquidation Details</h1>
		</div>
		<div style="display:flex;gap:0.5rem;">
			<button class="btn-ghost" onclick={() => (editing = !editing)}
				>{editing ? 'Cancel' : 'Edit'}</button
			>
			<button
				onclick={() => (showDeleteDialog = true)}
				disabled={deleting}
				style="padding:0.5rem 0.875rem;background:transparent;border:1px solid var(--loss);border-radius:0.5rem;color:var(--loss);font-size:0.875rem;cursor:pointer;opacity:{deleting
					? 0.5
					: 1};">🗑 Delete</button
			>
		</div>
	</div>

	{#if editing}
		<form
			method="POST"
			action="?/update"
			use:enhance={() => {
				saving = true;
				return async ({ result, update }) => {
					saving = false;
					await update({ reset: false });
					if (result.type === 'success') editing = false;
				};
			}}
			style="margin-bottom:1.5rem;"
			class="card"
		>
			<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;">
				<label class="form-label"
					>Date<input
						class="input"
						type="date"
						name="date"
						value={liquidation.date ?? ''}
						required
					/></label
				>
				<label class="form-label"
					>Coin<input class="input" type="text" name="coin" value={liquidation.coin ?? ''} /></label
				>
				<label class="form-label"
					>Position<select class="input" name="position">
						<option value="" selected={!liquidation.position}>N/A</option>
						<option value="Long" selected={liquidation.position === 'Long'}>Long</option>
						<option value="Short" selected={liquidation.position === 'Short'}>Short</option>
					</select></label
				>
				<label class="form-label"
					>Amount Lost ($)<input
						class="input"
						type="number"
						name="amount_lost"
						value={liquidation.amount_lost ?? ''}
						required
						min="0"
						step="any"
					/></label
				>
				<label class="form-label"
					>Strategy<input
						class="input"
						type="text"
						name="strategy"
						value={liquidation.strategy ?? ''}
					/></label
				>
				<label class="form-label"
					>Reason<input
						class="input"
						type="text"
						name="reason"
						value={liquidation.reason ?? ''}
					/></label
				>
				<label class="form-label"
					>Mistake<input
						class="input"
						type="text"
						name="mistake"
						value={liquidation.mistake ?? ''}
					/></label
				>
				<label class="form-label"
					>Notes<textarea class="input" name="notes" rows="3">{liquidation.notes ?? ''}</textarea
					></label
				>
			</div>
			<button class="btn-ghost" type="submit" disabled={saving}
				>{saving ? 'Saving...' : 'Save Changes'}</button
			>
		</form>
	{/if}

	<!-- Metadata card -->
	<div
		style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1.5rem;margin-bottom:1.5rem;"
	>
		<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1.25rem;">
			<div>
				<label class="form-label">Date</label>
				<div style="font-size:0.9rem;color:var(--text-primary);">
					{formatDate(liquidation.date)}
				</div>
			</div>
			<div>
				<label class="form-label">Coin</label>
				<div style="font-size:0.9rem;font-weight:600;color:var(--text-primary);">
					{liquidation.coin ?? '—'}
				</div>
			</div>
			<div>
				<label class="form-label">Position</label>
				<div>
					{#if liquidation.position}
						<span
							style="padding:0.125rem 0.5rem;border-radius:0.25rem;font-size:0.8rem;font-weight:600;
              background:{liquidation.position === 'Long'
								? 'color-mix(in srgb,var(--win) 15%,transparent)'
								: 'color-mix(in srgb,var(--loss) 15%,transparent)'};
              color:{liquidation.position === 'Long' ? 'var(--win)' : 'var(--loss)'};"
						>
							{liquidation.position}
						</span>
					{:else}
						<span style="color:var(--text-muted);">—</span>
					{/if}
				</div>
			</div>
			<div>
				<label class="form-label">Strategy</label>
				<div style="font-size:0.9rem;color:var(--text-muted);">{liquidation.strategy ?? '—'}</div>
			</div>
			<div>
				<label class="form-label">Amount Lost ($)</label>
				<div style="font-size:1rem;font-weight:700;color:var(--loss);">
					{liquidation.amount_lost != null ? `$${liquidation.amount_lost.toFixed(2)}` : '—'}
				</div>
			</div>
			<div>
				<label class="form-label">Reason</label>
				<div style="font-size:0.9rem;color:var(--text-muted);">{liquidation.reason ?? '—'}</div>
			</div>
			{#if liquidation.mistake}
				<div class="span-full">
					<label class="form-label">Mistake</label>
					<div style="font-size:0.9rem;color:var(--loss);">{liquidation.mistake}</div>
				</div>
			{/if}
			{#if liquidation.notes}
				<div class="span-full">
					<label class="form-label">Notes</label>
					<div style="font-size:0.9rem;color:var(--text-muted);white-space:pre-wrap;">
						{liquidation.notes}
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Linked trades section -->
	<div class="card-flush">
		<div
			style="padding:1rem 1.25rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;"
		>
			<div style="display:flex;align-items:center;gap:1rem;">
				<h3 style="font-size:0.95rem;font-weight:600;color:var(--text-primary);">Linked Trades</h3>
				<span class="muted-sm">{aggregated.count} trade{aggregated.count !== 1 ? 's' : ''}</span>
			</div>
			<div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
				<span class="muted-sm"
					>Net PnL: <strong style="color:{pnlColor(aggregated.netPnL)}"
						>{formatCurrency(aggregated.netPnL)}</strong
					></span
				>
				<span class="muted-sm">Fees: <strong>{formatCurrency(aggregated.fees)}</strong></span>
				<button
					onclick={openModal}
					style="padding:0.375rem 0.75rem;border:1px solid var(--border);border-radius:0.375rem;color:var(--text-muted);font-size:0.8rem;cursor:pointer;background:transparent;"
				>
					+ Manage Links
				</button>
			</div>
		</div>

		{#if linkedTrades.length === 0}
			<div style="padding:2rem;text-align:center;color:var(--text-muted);">
				No trades linked yet. Click "+ Manage Links" above to add trades.
			</div>
		{:else}
			<div class="scroll-x">
				<table class="table">
					<thead>
						<tr class="thead-row">
							<th class="th">Date</th>
							<th class="th">Coin</th>
							<th class="th">Pos</th>
							<th class="th">PnL</th>
							<th class="th">Fee</th>
							<th class="th">Result</th>
							<th class="th">Duration</th>
							<th class="th">Source</th>
							<th
								style="padding:0.625rem 0.75rem;text-align:right;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;"
								>Action</th
							>
						</tr>
					</thead>
					<tbody>
						{#each linkedTrades as trade}
							<tr class="row-divider">
								<td
									style="padding:0.625rem 0.75rem;font-family:'JetBrains Mono',monospace;color:var(--text-muted);white-space:nowrap;"
									>{formatDate(trade.date)}</td
								>
								<td style="padding:0.625rem 0.75rem;font-weight:600;color:var(--text-primary);"
									>{trade.coin}</td
								>
								<td style="padding:0.625rem 0.75rem;">
									<span
										style="padding:0.125rem 0.5rem;border-radius:0.25rem;font-size:0.75rem;font-weight:600;
                    background:{trade.position === 'Long'
											? 'color-mix(in srgb,var(--win) 15%,transparent)'
											: 'color-mix(in srgb,var(--loss) 15%,transparent)'};
                    color:{trade.position === 'Long' ? 'var(--win)' : 'var(--loss)'};"
									>
										{trade.position}
									</span>
								</td>
								<td
									style="padding:0.625rem 0.75rem;font-family:'JetBrains Mono',monospace;font-weight:600;color:{pnlColor(
										trade.pnl
									)};"
								>
									{formatCurrency(trade.pnl)}
								</td>
								<td
									style="padding:0.625rem 0.75rem;font-family:'JetBrains Mono',monospace;color:var(--text-muted);"
								>
									{trade.fee != null ? `-${trade.fee.toFixed(2)}` : '—'}
								</td>
								<td style="padding:0.625rem 0.75rem;">
									<span
										style="font-size:0.75rem;font-weight:600;color:{trade.win
											? 'var(--win)'
											: trade.loss
												? 'var(--loss)'
												: 'var(--text-muted)'};"
									>
										{trade.win ? 'Win' : trade.loss ? 'Loss' : trade.be ? 'BE' : '—'}
									</span>
								</td>
								<td style="padding:0.625rem 0.75rem;color:var(--text-muted);"
									>{trade.duration ?? '—'}</td
								>
								<td style="padding:0.625rem 0.75rem;color:var(--text-muted);"
									>{trade.source ?? '—'}</td
								>
								<td style="padding:0.625rem 0.75rem;text-align:right;">
									<form method="POST" action="?/unlink" use:enhance style="display:inline;">
										<input type="hidden" name="liquidationId" value={liquidation._id} />
										<input type="hidden" name="tradeId" value={trade._id} />
										<button
											type="submit"
											style="padding:0.25rem 0.5rem;background:transparent;border:1px solid var(--border);border-radius:0.25rem;color:var(--text-muted);font-size:0.75rem;cursor:pointer;"
											title="Unlink this trade">✕</button
										>
									</form>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>

	<!-- Delete confirmation dialog -->
	{#if showDeleteDialog}
		<div
			style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:100;display:flex;align-items:center;justify-content:center;"
			onclick={(e) => {
				if (e.target === e.currentTarget) showDeleteDialog = false;
			}}
		>
			<div
				style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1.5rem;max-width:400px;width:90%;"
			>
				<h3 style="font-size:1rem;font-weight:600;color:var(--text-primary);margin-bottom:0.75rem;">
					Delete Liquidation?
				</h3>
				<p style="font-size:0.9rem;color:var(--text-muted);margin-bottom:1.25rem;">
					This will remove this liquidation and all its trade links. The underlying trades will
					remain in your Trade Log.
				</p>
				<div style="display:flex;gap:0.75rem;justify-content:flex-end;">
					<button
						onclick={() => (showDeleteDialog = false)}
						disabled={deleting}
						style="padding:0.5rem 1rem;border:1px solid var(--border);border-radius:0.5rem;background:transparent;color:var(--text-muted);font-size:0.875rem;cursor:pointer;"
						>Cancel</button
					>
					<form
						method="POST"
						action="?/delete"
						use:enhance={() => {
							deleting = true;
							return async ({ update }) => {
								deleting = false;
								showDeleteDialog = false;
								await update();
							};
						}}
					>
						<input type="hidden" name="id" value={liquidation._id} />
						<button type="submit" disabled={deleting} class="btn-ghost"
							>{deleting ? 'Deleting...' : 'Delete'}</button
						>
					</form>
				</div>
			</div>
		</div>
	{/if}

	<!-- Trade picker modal -->
	{#if showModal}
		<div
			style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:100;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:2rem 1rem;"
			onclick={(e) => {
				if (e.target === e.currentTarget) closeModal();
			}}
		>
			<div
				style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;max-width:800px;width:100%;min-height:400px;display:flex;flex-direction:column;"
			>
				<!-- Modal header -->
				<div
					style="padding:1rem 1.25rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;"
				>
					<h3 style="font-size:1rem;font-weight:600;color:var(--text-primary);">
						Link Trades to Liquidation
					</h3>
					<button
						onclick={closeModal}
						style="padding:0.25rem 0.5rem;background:transparent;border:none;font-size:1.1rem;color:var(--text-muted);cursor:pointer;"
						>✕</button
					>
				</div>

				<!-- Filters -->
				<div
					style="padding:0.875rem 1.25rem;border-bottom:1px solid var(--border);display:flex;gap:0.75rem;flex-wrap:wrap;align-items:flex-end;"
				>
					<div>
						<label class="form-label">Coin</label>
						<input
							type="text"
							bind:value={modalCoinFilter}
							oninput={() => (modalSearchPage = 1)}
							placeholder="BTC, ETH…"
							class="input"
							style="width:120px;"
						/>
					</div>
					<div>
						<label class="form-label">Result</label>
						<select
							bind:value={modalResultFilter}
							onchange={() => (modalSearchPage = 1)}
							class="input"
							style="width:120px;"
						>
							<option value="all">All</option>
							<option value="win">Win</option>
							<option value="loss">Loss</option>
							<option value="be">BE</option>
						</select>
					</div>
					<div style="margin-left:auto;display:flex;gap:0.5rem;align-items:center;">
						<span class="muted-sm">
							{filteredTrades.length} found · Page {modalSearchPage}/{totalFilteredPages}
						</span>
						<span
							style="font-size:0.8rem;font-weight:600;color:{hasAnyUnlinkedSelected
								? 'var(--accent)'
								: 'var(--text-muted)'};"
						>
							{selectedCount} selected
						</span>
					</div>
				</div>

				<!-- Trade list -->
				<div style="flex:1;overflow-y:auto;">
					{#if allUserTrades.length === 0}
						<div style="padding:3rem;text-align:center;color:var(--text-muted);">
							No trades found.
						</div>
					{:else}
						<table class="table">
							<thead>
								<tr
									style="background:var(--bg);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:1;"
								>
									<th
										style="padding:0.5rem 0.75rem;text-align:center;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;width:40px;"
									>
										<input
											type="checkbox"
											checked={allModalSelected}
											onchange={(e) => toggleModalSelectAll((e.target as HTMLInputElement).checked)}
											style="cursor:pointer;accent-color:var(--accent);"
										/>
									</th>
									<th
										style="padding:0.5rem 0.75rem;text-align:left;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;"
										>Date</th
									>
									<th
										style="padding:0.5rem 0.75rem;text-align:left;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;"
										>Coin</th
									>
									<th
										style="padding:0.5rem 0.75rem;text-align:left;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;"
										>Pos</th
									>
									<th
										style="padding:0.5rem 0.75rem;text-align:right;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;"
										>PnL</th
									>
									<th
										style="padding:0.5rem 0.75rem;text-align:left;font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;"
										>Result</th
									>
								</tr>
							</thead>
							<tbody>
								{#each pagedTrades as trade}
									<tr
										style="border-bottom:1px solid var(--border);background:{alreadyLinkedIds.has(
											trade._id
										)
											? 'color-mix(in srgb,var(--accent) 8%,transparent)'
											: 'transparent'};"
									>
										<td style="padding:0.5rem 0.75rem;text-align:center;">
											<input
												type="checkbox"
												checked={selectedModalIds.has(trade._id)}
												onchange={(e) =>
													toggleModalTradeSelect(trade._id, (e.target as HTMLInputElement).checked)}
												disabled={alreadyLinkedIds.has(trade._id)}
												style="cursor:{alreadyLinkedIds.has(trade._id)
													? 'not-allowed'
													: 'pointer'};accent-color:var(--accent);opacity:{alreadyLinkedIds.has(
													trade._id
												)
													? 0.6
													: 1}"
											/>
										</td>
										<td
											style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;color:var(--text-muted);white-space:nowrap;font-size:0.75rem;"
											>{formatDate(trade.date)}</td
										>
										<td
											style="padding:0.5rem 0.75rem;font-weight:600;color:var(--text-primary);font-size:0.8rem;"
											>{trade.coin}</td
										>
										<td class="td">
											<span
												style="padding:0.1rem 0.4rem;border-radius:0.25rem;font-size:0.7rem;font-weight:600;
                        background:{trade.position === 'Long'
													? 'color-mix(in srgb,var(--win) 15%,transparent)'
													: 'color-mix(in srgb,var(--loss) 15%,transparent)'};
                        color:{trade.position === 'Long' ? 'var(--win)' : 'var(--loss)'};"
											>
												{trade.position}
											</span>
										</td>
										<td
											style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;font-weight:600;text-align:right;color:{pnlColor(
												trade.pnl
											)};">{formatCurrency(trade.pnl)}</td
										>
										<td class="td">
											<span
												style="font-size:0.7rem;font-weight:600;color:{trade.win
													? 'var(--win)'
													: trade.loss
														? 'var(--loss)'
														: 'var(--text-muted)'};"
											>
												{trade.win ? 'Win' : trade.loss ? 'Loss' : trade.be ? 'BE' : '—'}
											</span>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				</div>

				<!-- Pagination -->
				{#if allUserTrades.length > 0 && totalFilteredPages > 1}
					<div
						style="padding:0.625rem 1.25rem;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:center;gap:0.5rem;"
					>
						<button
							onclick={() => (modalSearchPage = Math.max(1, modalSearchPage - 1))}
							disabled={modalSearchPage <= 1}
							style="padding:0.25rem 0.625rem;border:1px solid var(--border);border-radius:0.25rem;background:transparent;color:var(--text-muted);font-size:0.8rem;cursor:pointer;opacity:{modalSearchPage <=
							1
								? 0.4
								: 1};">← Prev</button
						>
						<span style="font-size:0.8rem;color:var(--text-muted);min-width:80px;text-align:center;"
							>Page {modalSearchPage} of {totalFilteredPages}</span
						>
						<button
							onclick={() => (modalSearchPage = Math.min(totalFilteredPages, modalSearchPage + 1))}
							disabled={modalSearchPage >= totalFilteredPages}
							style="padding:0.25rem 0.625rem;border:1px solid var(--border);border-radius:0.25rem;background:transparent;color:var(--text-muted);font-size:0.8rem;cursor:pointer;opacity:{modalSearchPage >=
							totalFilteredPages
								? 0.4
								: 1};">Next →</button
						>
					</div>
				{/if}

				<!-- Modal footer -->
				<form
					method="POST"
					action="?/addTrades"
					use:enhance={() => {
						linking = true;
						return async ({ result, update }) => {
							linking = false;
							if (result.type === 'redirect') closeModal();
							await update({ reset: false });
						};
					}}
					style="padding:1rem 1.25rem;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:0.75rem;"
				>
					<input type="hidden" name="liquidationId" value={liquidation._id} />
					<input type="hidden" name="tradeIds" value={Array.from(selectedModalIds).join(',')} />
					{#if form?.error}<p role="alert" style="color:var(--loss);">{form.error}</p>{/if}
					<span class="muted-sm">
						{linkedTrades.length} already linked · {getAvailableTrades().length} available
					</span>
					<div style="display:flex;gap:0.5rem;">
						<button
							type="button"
							onclick={closeModal}
							style="padding:0.5rem 1rem;border:1px solid var(--border);border-radius:0.5rem;background:transparent;color:var(--text-muted);font-size:0.85rem;cursor:pointer;"
							>Cancel</button
						>
						<button
							type="submit"
							disabled={linking || !hasAnyUnlinkedSelected}
							style="padding:0.5rem 1.25rem;background:{hasAnyUnlinkedSelected
								? 'var(--loss)'
								: 'var(--border)'};color:#fff;border:none;border-radius:0.5rem;font-size:0.85rem;font-weight:600;cursor:pointer;opacity:{hasAnyUnlinkedSelected
								? 1
								: 0.5};"
						>
							{linking ? 'Saving...' : 'Save Links (' + selectedCount + ')'}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>
