<script lang="ts">
	import {
		parseTradeHistoryCSV,
		type TradeHistoryTrade
	} from '$lib/utils/binance-trade-history-parser';
	import { resolve } from '$app/paths';
	import TradeLoader from '$lib/components/TradeLoader.svelte';

	let step = $state<1 | 2 | 3>(1);
	let fileName = $state('');
	let csvText = $state('');
	let parsedTrades = $state<TradeHistoryTrade[]>([]);
	let selected = $state<Set<number>>(new Set());
	let importing = $state(false);
	let processing = $state(false);
	let importResult = $state<{ imported: number; updated: number; skipped: number } | null>(null);
	let error = $state('');
	let dragOver = $state(false);

	let selectedTrades = $derived(parsedTrades.filter((_, i) => selected.has(i)));

	function handleFile(file: File) {
		if (!file.name.endsWith('.csv')) {
			error = 'Please upload a .csv file';
			return;
		}
		fileName = file.name;
		const reader = new FileReader();
		reader.onload = async (e) => {
			csvText = e.target?.result as string;
			await processCSV();
		};
		reader.readAsText(file);
	}

	async function processCSV() {
		error = '';
		processing = true;
		try {
			const trades = parseTradeHistoryCSV(csvText);
			parsedTrades = trades;
			selected = new Set(trades.map((_, i) => i));
			step = 2;
		} catch (e: unknown) {
			error = `Parse error: ${e instanceof Error ? e.message : String(e)}`;
		} finally {
			processing = false;
		}
	}

	function toggleSelect(i: number) {
		selected = selected.has(i)
			? new Set([...selected].filter((x) => x !== i))
			: new Set([...selected, i]);
	}

	async function confirmImport() {
		importing = true;
		error = '';
		const toImport = parsedTrades.filter((_, i) => selected.has(i));

		try {
			const res = await fetch('/api/trades/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ filename: fileName, trades: toImport })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || 'Import failed');

			importResult = {
				imported: data.inserted ?? toImport.length,
				updated: data.updated ?? 0,
				skipped: data.skipped ?? 0
			};
			step = 3;
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			importing = false;
		}
	}
</script>

<svelte:head><title>Import Trades — Qulem-Trade</title></svelte:head>

<div class="page">
	<div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;">
		<a href={resolve('/trades')} class="link-muted">← Trades</a>
		<h1 class="stat-value">Import Trade History CSV</h1>
	</div>

	<div
		style="display:flex;gap:0;margin-bottom:1.5rem;background:var(--surface);border:1px solid var(--border);border-radius:0.5rem;overflow:hidden;"
	>
		{#each [[1, 'Upload'], [2, 'Preview'], [3, 'Done']] as [s, label] (s)}
			<div
				style="flex:1;padding:0.625rem;text-align:center;font-size:0.8rem;font-weight:{step >=
				(s as number)
					? '600'
					: '400'};
        background:{step === (s as number)
					? 'var(--accent)'
					: step > (s as number)
						? 'color-mix(in srgb,var(--accent) 20%,transparent)'
						: 'transparent'};
        color:{step === (s as number)
					? '#fff'
					: step > (s as number)
						? 'var(--accent)'
						: 'var(--text-muted)'};"
			>
				{s}. {label}
			</div>
		{/each}
	</div>

	{#if error}
		<div
			style="background:color-mix(in srgb,var(--loss) 15%,transparent);border:1px solid var(--loss);border-radius:0.5rem;padding:0.75rem;margin-bottom:1rem;color:var(--loss);font-size:0.875rem;"
		>
			{error}
		</div>
	{/if}

	{#if step === 1}
		{#if processing}
			<div
				style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:3rem;text-align:center;"
			>
				<TradeLoader label="Analysing trades…" />
			</div>
		{:else}
			<div
				role="region"
				aria-label="CSV file drop zone"
				style="background:var(--surface);border:2px dashed {dragOver
					? 'var(--accent)'
					: 'var(--border)'};border-radius:0.75rem;padding:3rem;text-align:center;transition:border-color 0.15s;cursor:pointer;"
				ondragover={(e) => {
					e.preventDefault();
					dragOver = true;
				}}
				ondragleave={() => (dragOver = false)}
				ondrop={(e) => {
					e.preventDefault();
					dragOver = false;
					const f = e.dataTransfer?.files[0];
					if (f) handleFile(f);
				}}
			>
				<div style="font-size:2.5rem;margin-bottom:1rem;">📂</div>
				<p style="color:var(--text-primary);font-weight:600;margin-bottom:0.5rem;">
					Drop your Binance Futures Trade History CSV here
				</p>
				<p style="color:var(--text-muted);font-size:0.875rem;margin-bottom:1.5rem;">
					Or click to browse · .csv files only
				</p>
				<input
					type="file"
					accept=".csv"
					id="csv-input"
					style="display:none;"
					onchange={(e) => {
						const f = (e.target as HTMLInputElement).files?.[0];
						if (f) handleFile(f);
					}}
				/>
				<label
					for="csv-input"
					style="padding:0.625rem 1.5rem;background:var(--accent);color:#fff;border-radius:0.5rem;font-size:0.875rem;font-weight:500;cursor:pointer;"
					>Browse Files</label
				>
			</div>
			<p class="muted-sm" style="margin-top:1rem;">
				Re-importing updates status and dates while keeping your journal notes and strategy. Changed
				financial totals are rejected because a partial export could omit fills; correct those
				totals in the trade editor. Liquidation status changes only when the CSV explicitly provides
				it.
			</p>
			<div
				style="margin-top:1rem;padding:0.75rem 1rem;background:var(--surface);border:1px solid var(--border);border-radius:0.5rem;"
			>
				<p class="muted-sm">
					Expected format: <span
						style="font-family:'JetBrains Mono',monospace;color:var(--text-primary);"
						>Binance → Orders → Futures → Trade History → Export</span
					>
				</p>
			</div>
		{/if}
	{:else if step === 2}
		<div
			style="margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;"
		>
			<div>
				<span style="font-size:0.875rem;color:var(--text-primary);font-weight:600;">{fileName}</span
				>
				<span style="margin-left:0.75rem;font-size:0.8rem;color:var(--text-muted);"
					>{parsedTrades.length} trades parsed</span
				>
			</div>
		</div>

		<div
			style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;overflow:hidden;margin-bottom:1rem;"
		>
			<div style="overflow-x:auto;max-height:400px;overflow-y:auto;">
				<table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
					<thead style="position:sticky;top:0;background:var(--bg);">
						<tr class="row-divider">
							<th
								style="padding:0.5rem 0.75rem;text-align:left;font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;width:40px;"
							>
								<input
									type="checkbox"
									checked={selected.size === parsedTrades.length}
									onchange={(e) => {
										if ((e.target as HTMLInputElement).checked) {
											selected = new Set(parsedTrades.map((_, i) => i));
										} else {
											selected = new Set();
										}
									}}
								/>
							</th>
							{#each ['Date', 'Coin', 'Side', 'Entry', 'Exit', 'Qty', 'PnL', 'Liquidated'] as col (col)}
								<th
									style="padding:0.5rem 0.75rem;text-align:left;font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;"
									>{col}</th
								>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each parsedTrades as trade, i (i)}
							<tr class="row-divider">
								<td class="td">
									<input
										type="checkbox"
										checked={selected.has(i)}
										onchange={() => toggleSelect(i)}
									/>
								</td>
								<td
									style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;color:var(--text-muted);"
									>{trade.date}</td
								>
								<td style="padding:0.5rem 0.75rem;font-weight:600;color:var(--text-primary);"
									>{trade.coin}</td
								>
								<td class="td">
									<span
										style="color:{trade.position === 'Long'
											? 'var(--win)'
											: 'var(--loss)'};font-weight:600;">{trade.position}</span
									>
								</td>
								<td class="td-mono">{trade.entry_price ?? '—'}</td>
								<td class="td-mono">{trade.exit_price ?? '—'}</td>
								<td class="td-mono">{trade.quantity ?? '—'}</td>
								<td
									style="padding:0.5rem 0.75rem;font-family:'JetBrains Mono',monospace;font-weight:600;color:{trade.pnl >
									0
										? 'var(--win)'
										: trade.pnl < 0
											? 'var(--loss)'
											: 'var(--text-muted)'};"
								>
									{trade.pnl > 0 ? '+' : ''}{trade.pnl.toFixed(4)}
								</td>
								<td class="td"
									>{trade.liquidated === undefined
										? 'Not specified'
										: trade.liquidated
											? 'Yes'
											: 'No'}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<div style="display:flex;gap:0.75rem;align-items:center;">
			<button
				onclick={confirmImport}
				disabled={importing || selectedTrades.length === 0}
				style="padding:0.625rem 1.5rem;background:var(--accent);color:#fff;border:none;border-radius:0.5rem;font-weight:600;font-size:0.875rem;cursor:pointer;opacity:{importing ||
				selectedTrades.length === 0
					? 0.5
					: 1};display:inline-flex;align-items:center;gap:0.5rem;"
			>
				{#if importing}
					<TradeLoader />
					Importing…
				{:else}
					Import {selectedTrades.length} Trades
				{/if}
			</button>
			<button
				onclick={() => {
					step = 1;
					parsedTrades = [];
					fileName = '';
				}}
				class="btn-ghost"
			>
				← Back
			</button>
		</div>
	{:else}
		<div
			style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:3rem;text-align:center;"
		>
			<div style="font-size:2.5rem;margin-bottom:1rem;">✅</div>
			<h2
				style="font-family:'JetBrains Mono',monospace;font-size:1.1rem;color:var(--text-primary);margin-bottom:0.5rem;"
			>
				Import Complete
			</h2>
			<p style="color:var(--text-muted);font-size:0.875rem;margin-bottom:0.5rem;">
				{importResult?.imported} trades imported · {importResult?.updated} updated · {importResult?.skipped}
				unchanged
			</p>
			<div style="display:flex;gap:0.75rem;justify-content:center;margin-top:1.5rem;">
				<a
					href={resolve('/trades')}
					style="padding:0.625rem 1.5rem;background:var(--accent);color:#fff;border-radius:0.5rem;text-decoration:none;font-size:0.875rem;font-weight:500;"
					>View Trades</a
				>
				<button
					onclick={() => {
						step = 1;
						parsedTrades = [];
						importResult = null;
						fileName = '';
					}}
					class="btn-ghost">Import Another</button
				>
			</div>
		</div>
	{/if}
</div>
