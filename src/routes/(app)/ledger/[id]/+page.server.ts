import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';

export const load: PageServerLoad = async ({ locals: { convex }, params }) => {
  const entry = await convex.query(api.ledger.getLedgerEntryById, { id: params.id as Id<"ledger"> }).catch(() => null);
  if (!entry) error(404, 'Entry not found');
  return { entry: { ...entry, id: entry._id } };
};

export const actions: Actions = {
  update: async ({ locals: { convex }, params, request }) => {
    const form = await request.formData();
    const updates: Record<string, any> = {};

    const fields = [
      'type', 'date', 'time', 'my_bank', 'recipient_bank', 'sender_bank', 'receiver_bank',
      'fiat_sent', 'usd_fee', 'usd_rate', 'usd_received', 'usd_quantity',
      'fee', 'fiat_amount', 'notes', 'order_number', 'counterparty', 'source'
    ];

    for (const field of fields) {
      const val = form.get(field);
      if (val !== null) {
        const numFields = ['fiat_sent', 'usd_fee', 'usd_rate', 'usd_received', 'usd_quantity', 'fee', 'fiat_amount'];
        updates[field] = numFields.includes(field)
          ? (val === '' ? undefined : Number(val))
          : (val === '' ? undefined : val);
      }
    }

    try {
      await convex.mutation(api.ledger.updateLedgerEntry, { id: params.id as Id<"ledger">, ...updates });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  delete: async ({ locals: { convex }, params }) => {
    try {
      await convex.mutation(api.ledger.deleteLedgerEntry, { id: params.id as Id<"ledger"> });
      return { deleted: true };
    } catch (err: any) {
      return { deleted: false, error: err.message };
    }
  }
};
