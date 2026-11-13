type Financials = {
	order_id?: string;
	quantity?: number;
	pnl?: number;
	fee?: number;
	exit_price?: number;
};

export function validateReimportTotals(existing: Financials, incoming: Financials) {
	// Order aggregates cannot prove that a new export contains every original fill.
	for (const field of ['quantity', 'pnl', 'fee', 'exit_price'] as const) {
		const value = incoming[field];
		if (value === undefined) continue;
		const saved = existing[field];
		const tolerance = Number.EPSILON * 8 * Math.max(1, Math.abs(value), Math.abs(saved ?? 0));
		if (saved === undefined || Math.abs(saved - value) > tolerance) {
			throw new Error(
				`Order ${incoming.order_id ?? existing.order_id}: imported financial totals differ. The CSV may contain only some fills. Existing totals were kept; correct this trade manually before re-importing.`
			);
		}
	}
}
