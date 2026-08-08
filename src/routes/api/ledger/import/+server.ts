import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { api } from '../../../../../convex/_generated/api';

export const POST: RequestHandler = async ({ request, locals: { convex } }) => {
  const body = await request.json();
  const { filename, entries } = body;

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
