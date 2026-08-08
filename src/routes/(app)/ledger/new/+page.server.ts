import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { api } from '../../../../../convex/_generated/api';

export const actions: Actions = {
  default: async ({ locals: { convex }, request }) => {
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

    redirect(303, '/ledger');
  }
};
