import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase }, params }) => {
  const { data: trade, error: err } = await supabase
    .from('trades')
    .select('*')
    .eq('id', params.id)
    .single();

  if (err || !trade) error(404, 'Trade not found');
  return { trade };
};

export const actions: Actions = {
  update: async ({ locals: { supabase }, params, request }) => {
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
          ? (val === '' ? null : Number(val))
          : (val === '' ? null : val);
      }
    }

    const tf = form.getAll('timeframes');
    if (tf.length > 0) updates.timeframes = tf as string[];

    const pnl = updates.pnl;
    if (pnl != null) {
      updates.win = pnl > 0;
      updates.loss = pnl < 0;
      updates.be = pnl === 0;
    }

    const { error: err } = await supabase.from('trades').update(updates).eq('id', params.id);
    if (err) return { success: false, error: err.message };
    return { success: true };
  },

  delete: async ({ locals: { supabase }, params }) => {
    await supabase.from('trades').delete().eq('id', params.id);
    return { deleted: true };
  }
};
