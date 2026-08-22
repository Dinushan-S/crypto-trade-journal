import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { FunctionArgs } from 'convex/server';
import { api } from '../../../../../convex/_generated/api';

type TradeImport = FunctionArgs<typeof api.trades.batchCreateTrades>['trades'][number];

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

export const POST: RequestHandler = async ({ request, locals: { convex } }) => {
	const body: unknown = await request.json();
	if (typeof body !== 'object' || body === null) {
		return json({ success: false, message: 'Invalid request body' }, { status: 400 });
	}

	const { trades } = body as { trades?: unknown[] };
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
		return json({ success: true, inserted });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Trade import failed';
		return json({ success: false, message }, { status: 500 });
	}
};
