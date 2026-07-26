import type { PageServerLoad, Actions } from './$types';
import { fail, redirect, error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const { id } = params;

  const { data: mistake, error: fetchErr } = await supabase
    .from('mistakes')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !mistake) {
    throw error(404, 'Mistake entry not found');
  }

  const { data: trades } = await supabase
    .from('trades')
    .select('id, date, coin, position, pnl, reason')
    .order('date', { ascending: false })
    .limit(50);

  return {
    mistake,
    trades: trades ?? [],
  };
};

export const actions: Actions = {
  default: async ({ params, request, locals: { supabase } }) => {
    const { id } = params;
    const session = await supabase.auth.getSession();
    if (!session.data.session) return fail(401, { error: 'Unauthorized' });

    const formData = await request.formData();
    const trade_id = (formData.get('trade_id') as string) || null;
    const trade_date = formData.get('trade_date') as string;
    const trade_time = (formData.get('trade_time') as string) || null;
    const coin = (formData.get('coin') as string) || null;
    const why_took_trade = formData.get('why_took_trade') as string;
    const mistake_details = formData.get('mistake_details') as string;
    const lesson_learned = formData.get('lesson_learned') as string;
    const category = formData.get('category') as string;
    const severity = (formData.get('severity') as string) || 'medium';

    if (!trade_date || !why_took_trade || !mistake_details || !lesson_learned || !category) {
      return fail(400, { error: 'Please fill in all required fields.' });
    }

    const { error: updateErr } = await supabase
      .from('mistakes')
      .update({
        trade_id: trade_id || null,
        trade_date,
        trade_time: trade_time || null,
        coin: coin ? coin.toUpperCase() : null,
        why_took_trade,
        mistake_details,
        lesson_learned,
        category,
        severity,
      })
      .eq('id', id);

    if (updateErr) {
      console.error('Error updating mistake:', updateErr);
      return fail(500, { error: updateErr.message });
    }

    throw redirect(303, '/mistakes');
  },
};
