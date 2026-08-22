import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';

export const load: PageServerLoad = async ({ locals: { convex } }) => {
  const entries: any[] = await convex.query(api.ledger.getLedgerWithTracking, {}).catch(() => []);
  return { entries: entries.map((e: any) => ({ ...e, id: e._id })) };
};

export const actions: Actions = {
  lock: async ({ locals: { convex }, request }) => {
    const form = await request.formData();
    const depositId = form.get('depositId') as string;
    try {
      await convex.mutation(api.ledger.createLedgerLock, {
        depositId: depositId as Id<'ledger'>,
      });
      return { success: true };
    } catch (err: any) {
      return { error: err.message };
    }
  },

  allocate: async ({ locals: { convex }, request }) => {
    const form = await request.formData();
    const withdrawalId = form.get('withdrawalId') as string;
    const rows = JSON.parse((form.get('allocations') as string) ?? '[]') as { depositId: string; releasedUsd: number }[];
    try {
      await convex.mutation(api.ledger.allocateRelease, {
        withdrawalId: withdrawalId as Id<'ledger'>,
        allocations: rows.map((r) => ({ depositId: r.depositId as Id<'ledger'>, releasedUsd: r.releasedUsd })),
      });
      return { success: true };
    } catch (err: any) {
      return { error: err.message };
    }
  },

  add: async ({ locals: { convex }, request }) => {
    const form = await request.formData();
    const type = (form.get('type') as string) || 'deposit';
    const date = (form.get('date') as string) || new Date().toISOString().split('T')[0];
    const time = (form.get('time') as string) || undefined;
    const my_bank = (form.get('my_bank') as string) || undefined;
    const recipient_bank = (form.get('recipient_bank') as string) || undefined;
    const sender_bank = (form.get('sender_bank') as string) || undefined;
    const receiver_bank = (form.get('receiver_bank') as string) || undefined;
    const fiat_sent = form.get('fiat_sent') ? Number(form.get('fiat_sent')) : undefined;
    const usd_fee = form.get('usd_fee') ? Number(form.get('usd_fee')) : undefined;
    const usd_rate = form.get('usd_rate') ? Number(form.get('usd_rate')) : undefined;
    const usd_received = form.get('usd_received') ? Number(form.get('usd_received')) : undefined;
    const usd_quantity = form.get('usd_quantity') ? Number(form.get('usd_quantity')) : undefined;
    const fee = form.get('fee') ? Number(form.get('fee')) : undefined;
    const fiat_amount = form.get('fiat_amount') ? Number(form.get('fiat_amount')) : undefined;
    const notes = (form.get('notes') as string) || undefined;

    try {
      await convex.mutation(api.ledger.createLedgerEntry, {
        type,
        date,
        time,
        my_bank,
        recipient_bank,
        sender_bank,
        receiver_bank,
        fiat_sent,
        usd_fee,
        usd_rate,
        usd_received: type === 'deposit' ? usd_received : undefined,
        usd_quantity: type === 'withdrawal' ? usd_quantity : undefined,
        fee,
        fiat_amount: type === 'withdrawal' ? fiat_amount : undefined,
        notes,
        source: 'manual',
      });
      return { success: true };
    } catch (err: any) {
      return fail(500, { error: err.message || 'Failed to add ledger entry.' });
    }
  },

  quickUpdate: async ({ locals: { convex }, request }) => {
    const form = await request.formData();
    const id = form.get('id') as string;
    if (!id) return fail(400, { error: 'Missing ledger entry id.' });

    const updates: Record<string, any> = {};
    const numFields = ['fiat_sent', 'usd_fee', 'usd_rate', 'usd_received', 'usd_quantity', 'fee', 'fiat_amount'];
    const textFields = ['type', 'date', 'time', 'my_bank', 'recipient_bank', 'sender_bank', 'receiver_bank', 'notes', 'order_number', 'counterparty'];
    for (const field of [...numFields, ...textFields]) {
      const val = form.get(field);
      if (val !== null && String(val).trim() !== '') {
        updates[field] = numFields.includes(field) ? Number(val) : String(val).trim();
      }
    }

    try {
      await convex.mutation(api.ledger.updateLedgerEntry, { id: id as Id<'ledger'>, ...updates });
      return { success: true };
    } catch (err: any) {
      return fail(500, { error: err.message || 'Failed to update ledger entry.' });
    }
  },

  reset: async ({ locals: { convex }, request }) => {
    const form = await request.formData();
    const id = form.get('id') as string;
    const type = (form.get('type') as string) || 'deposit';
    if (!id) return fail(400, { error: 'Missing ledger entry id.' });

    try {
      if (type === 'withdrawal') {
        await convex.mutation(api.ledger.removeWithdrawalAllocations, {
          withdrawalId: id as Id<'ledger'>,
        });
      } else {
        await convex.mutation(api.ledger.removeLedgerLock, {
          depositId: id as Id<'ledger'>,
        });
      }
      return { success: true };
    } catch (err: any) {
      return fail(500, { error: err.message || 'Failed to reset.' });
    }
  },
};
