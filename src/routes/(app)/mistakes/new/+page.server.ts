import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { api } from '../../../../../convex/_generated/api';
import type { Id } from '../../../../../convex/_generated/dataModel';

export const load: PageServerLoad = async ({ url, locals: { convex } }) => {
  const tradeIdParam = url.searchParams.get('trade_id');

  const trades: any[] = await convex.query(api.trades.getTrades, {}).catch(() => []);
  const mappedTrades = trades.map((t: any) => ({ ...t, id: t._id }));

  let selectedTrade = null;
  if (tradeIdParam) {
    const trade: any = await convex.query(api.trades.getTradeById, { id: tradeIdParam as Id<"trades"> }).catch(() => null);
    if (trade) selectedTrade = { ...trade, id: trade._id };
  }

  return {
    trades: mappedTrades,
    selectedTrade,
    prefilledTradeId: tradeIdParam || '',
  };
};

export const actions: Actions = {
  default: async ({ request, locals: { convex } }) => {
    const formData = await request.formData();
    const trade_id = (formData.get('trade_id') as string) || undefined;
    const trade_date = formData.get('trade_date') as string;
    const trade_time = (formData.get('trade_time') as string) || undefined;
    const coin = (formData.get('coin') as string) || undefined;
    const why_took_trade = formData.get('why_took_trade') as string;
    const mistake_details = formData.get('mistake_details') as string;
    const lesson_learned = formData.get('lesson_learned') as string;
    const category = formData.get('category') as string;
    const severity = (formData.get('severity') as string) || 'medium';

    if (!trade_date || !why_took_trade || !mistake_details || !lesson_learned || !category) {
      return fail(400, { error: 'Please fill in all required fields.' });
    }

    try {
      await convex.mutation(api.mistakes.createMistake, {
        trade_id,
        trade_date,
        trade_time,
        coin: coin ? coin.toUpperCase() : undefined,
        why_took_trade,
        mistake_details,
        lesson_learned,
        category,
        severity,
      });
    } catch (err: any) {
      return fail(500, { error: err.message });
    }

    redirect(303, '/mistakes');
  },
};
