import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { api } from '../../../../../convex/_generated/api';

type LedgerImportEntry = {
	type: string;
	date: string;
	time?: string;
	my_bank?: string;
	recipient_bank?: string;
	sender_bank?: string;
	receiver_bank?: string;
	fiat_sent?: number;
	usd_fee?: number;
	usd_rate?: number;
	usd_received?: number;
	usd_quantity?: number;
	fee?: number;
	fiat_amount?: number;
	notes?: string;
	order_number?: string;
	counterparty?: string;
	source?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

export const POST: RequestHandler = async ({ request, locals: { convex } }) => {
	const body: unknown = await request.json();
	if (typeof body !== 'object' || body === null) {
		return json({ success: false, message: 'Invalid request body' }, { status: 400 });
	}

	const { filename, entries } = body as { filename?: string; entries?: unknown[] };
	if (!Array.isArray(entries) || !entries.every(isRecord)) {
		return json({ success: false, message: 'Entries array required' }, { status: 400 });
	}

	const normalizedEntries = entries.map(
		(entry) =>
			Object.fromEntries(
				Object.entries(entry).filter(([, value]) => value !== null)
			) as LedgerImportEntry
	);

	try {
		const inserted = await convex.mutation(api.ledger.batchCreateLedger, {
			entries: normalizedEntries
		});
		await convex.mutation(api.imports.createImportRecord, {
			filename,
			import_type: 'c2c',
			trades_count: inserted,
			skipped_count: normalizedEntries.length - inserted,
			status: 'complete'
		});
		return json({ success: true, inserted });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Ledger import failed';
		return json({ success: false, message }, { status: 500 });
	}
};
