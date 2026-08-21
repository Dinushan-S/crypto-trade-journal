import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { api } from '../../../../../convex/_generated/api';

type TradeImport = {
	date: string;
	time?: string;
	day?: string;
	coin: string;
	position: string;
	entry_price?: number;
	exit_price?: number;
	stop_loss?: number;
	quantity?: number;
	leverage?: string;
	strategy?: string;
	timeframes?: string[];
	confidence?: number;
	risk_pct?: number;
	range_pct?: number;
	fib_match_macro?: string;
	limit_type?: string;
	pnl?: number;
	fee?: number;
	win?: boolean;
	loss?: boolean;
	be?: boolean;
	date_closed?: string;
	closed_reason?: string;
	duration?: string;
	reason?: string;
	pre_notes?: string;
	post_notes?: string;
	order_id?: string;
	fills?: number;
	source?: string;
	annotated?: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

export const POST: RequestHandler = async ({ request, locals: { convex } }) => {
	const body: unknown = await request.json();
	if (typeof body !== 'object' || body === null) {
		return json({ success: false, message: 'Invalid request body' }, { status: 400 });
	}

	const { filename, trades } = body as { filename?: string; trades?: unknown[] };
	if (!Array.isArray(trades) || !trades.every(isRecord)) {
		return json({ success: false, message: 'Trades array required' }, { status: 400 });
	}

	const normalizedTrades = trades.map(
		(trade) =>
			Object.fromEntries(Object.entries(trade).filter(([, value]) => value !== null)) as TradeImport
	);

	try {
		const inserted = await convex.mutation(api.trades.batchCreateTrades, {
			trades: normalizedTrades
		});
		await convex.mutation(api.imports.createImportRecord, {
			filename,
			import_type: 'futures',
			trades_count: inserted,
			skipped_count: normalizedTrades.length - inserted,
			status: 'complete'
		});
		return json({ success: true, inserted });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Trade import failed';
		return json({ success: false, message }, { status: 500 });
	}
};
