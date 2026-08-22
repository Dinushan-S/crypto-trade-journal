import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { FunctionArgs } from 'convex/server';
import { api } from '../../../../../convex/_generated/api';

type LedgerImportEntry = FunctionArgs<typeof api.ledger.batchCreateLedger>['entries'][number];

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

export const POST: RequestHandler = async ({ request, locals: { convex } }) => {
	const body: unknown = await request.json();
	if (typeof body !== 'object' || body === null) {
		return json({ success: false, message: 'Invalid request body' }, { status: 400 });
	}

	const { entries } = body as { entries?: unknown[] };
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
		return json({ success: true, inserted });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Ledger import failed';
		return json({ success: false, message }, { status: 500 });
	}
};
