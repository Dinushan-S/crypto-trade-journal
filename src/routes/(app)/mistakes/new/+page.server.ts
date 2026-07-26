import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
  const tradeIdParam = url.searchParams.get('trade_id');

  // Fetch recent trades for trade selector
  const { data: trades } = await supabase
    .from('trades')
    .select('id, date, coin, position, pnl, reason')
    .order('date', { ascending: false })
    .limit(50);

  let selectedTrade = null;
  if (tradeIdParam) {
    const { data: trade } = await supabase
      .from('trades')
      .select('id, date, coin, position, pnl, reason')
      .eq('id', tradeIdParam)
      .single();
    selectedTrade = trade;
  }

  return {
    trades: trades ?? [],
    selectedTrade,
    prefilledTradeId: tradeIdParam || '',
  };
};

export const actions: Actions = {
  default: async ({ request, locals: { supabase } }) => {
    const session = await supabase.auth.getSession();
    if (!session.data.session) return fail(401, { error: 'Unauthorized' });
    const user_id = session.data.session.user.id;

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

    const { error } = await supabase.from('mistakes').insert({
      user_id,
      trade_id: trade_id || null,
      trade_date,
      trade_time: trade_time || null,
      coin: coin ? coin.toUpperCase() : null,
      why_took_trade,
      mistake_details,
      lesson_learned,
      category,
      severity,
    });

    if (error) {
      console.error('Error inserting mistake:', error);
      return fail(500, { error: error.message });
    }

    throw redirect(303, '/mistakes');
  },
};
