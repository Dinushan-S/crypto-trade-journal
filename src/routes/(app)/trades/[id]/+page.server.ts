import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { api } from '../../../../../convex/_generated/api';
import type { Id } from '../../../../../convex/_generated/dataModel';

export const load: PageServerLoad = async ({ locals: { convex }, params }) => {
  const trade = await convex.query(api.trades.getTradeById, { id: params.id as Id<"trades"> }).catch(() => null);
  if (!trade) error(404, 'Trade not found');
  return { trade: { ...trade, id: trade._id } };
};

export const actions: Actions = {
  update: async ({ locals: { convex }, params, request }) => {
    const form = await request.formData();
    const updates: Record<string, any> = {};

    const fields = [
      'coin', 'position', 'date', 'time', 'entry_price', 'exit_price', 'stop_loss',
      'quantity', 'pnl', 'fee', 'date_closed', 'duration', 'strategy', 'leverage',
      'confidence', 'risk_pct', 'range_pct', 'limit_type', 'reason', 'pre_notes',
      'post_notes', 'closed_reason'
    ];

    for (const field of fields) {
      const val = form.get(field);
      if (val !== null) {
        const numFields = ['entry_price', 'exit_price', 'stop_loss', 'quantity', 'pnl', 'fee', 'confidence', 'risk_pct', 'range_pct'];
        updates[field] = numFields.includes(field)
          ? (val === '' ? undefined : Number(val))
          : (val === '' ? undefined : val);
      }
    }

    const tf = form.getAll('timeframes');
    if (tf.length > 0) updates.timeframes = tf as string[];

    const pnl = updates.pnl;
    if (pnl !== undefined) {
      updates.win = pnl > 0;
      updates.loss = pnl < 0;
      updates.be = pnl === 0;
    }

    try {
      await convex.mutation(api.trades.updateTrade, { id: params.id as Id<"trades">, ...updates });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  delete: async ({ locals: { convex }, params }) => {
    try {
      await convex.mutation(api.trades.deleteTrade, { id: params.id as Id<"trades"> });
      return { deleted: true };
    } catch (err: any) {
      return { deleted: false, error: err.message };
    }
  }
};
