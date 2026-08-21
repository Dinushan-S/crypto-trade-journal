import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { api } from '../../../../../convex/_generated/api';
import type { Id } from '../../../../../convex/_generated/dataModel';

export const load: PageServerLoad = async ({ locals: { convex }, params }) => {
  const entry = await convex.query(api.ledger.getLedgerEntryById, { id: params.id as Id<"ledger"> }).catch(() => null);
  if (!entry) error(404, 'Entry not found');
  const tracking = await convex.query(api.ledger.getLedgerWithTracking, {}).catch(() => []);
  const tracked = (tracking as any[]).find((e: any) => e._id === entry._id);
  const allocations = entry.type === 'withdrawal'
    ? await convex.query(api.ledger.getWithdrawalAllocations, { withdrawalId: params.id as Id<'ledger'> }).catch(() => [])
    : [];
  const availableDeposits = entry.type === 'withdrawal'
    ? (tracking as any[])
        .filter((e: any) => e.type === 'deposit' && e.tracking?.remainingUsd != null && e.tracking.remainingUsd > 0)
        .map((e: any) => ({ id: e._id, date: e.date, remainingUsd: e.tracking.remainingUsd }))
    : [];
  return { entry: { ...entry, id: entry._id }, tracking: tracked?.tracking ?? null, allocations, availableDeposits };
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
  },

  lock: async ({ locals: { convex }, params, request }) => {
    const form = await request.formData();
    const lockedUsd = Number(form.get('lockedUsd'));
    try {
      await convex.mutation(api.ledger.createLedgerLock, {
        depositId: params.id as Id<'ledger'>,
        lockedUsd,
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  rebalance: async ({ locals: { convex }, params, request }) => {
    const form = await request.formData();
    const allocations = JSON.parse((form.get('allocations') as string) ?? '[]') as { depositId: string; releasedUsd: number }[];
    try {
      await convex.mutation(api.ledger.rebalanceAllocations, {
        withdrawalId: params.id as Id<'ledger'>,
        allocations: allocations.map((a) => ({ depositId: a.depositId as Id<'ledger'>, releasedUsd: a.releasedUsd })),
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};
