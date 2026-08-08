import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { api } from '../../../../../convex/_generated/api';

export const POST: RequestHandler = async ({ request, locals: { convex } }) => {
  const body: unknown = await request.json();
  if (typeof body !== 'object' || body === null) {
    return json({ success: false, message: 'Invalid request body' }, { status: 400 });
  }

  const { filename, entries } = body as { filename?: string; entries?: any[] };
  if (!Array.isArray(entries)) {
    return json({ success: false, message: 'Entries array required' }, { status: 400 });
  }

  try {
    const inserted = await convex.mutation(api.ledger.batchCreateLedger, { entries });
    await convex.mutation(api.imports.createImportRecord, {
      filename,
      import_type: 'c2c',
      trades_count: inserted,
      skipped_count: entries.length - inserted,
      status: 'complete',
    });
    return json({ success: true, inserted });
  } catch (err: any) {
    return json({ success: false, message: err.message }, { status: 500 });
  }
};
