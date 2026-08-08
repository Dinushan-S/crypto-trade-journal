import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { api } from '../../../../../convex/_generated/api';

export const actions: Actions = {
  default: async ({ locals: { convex }, request }) => {
    const form = await request.formData();
    const coin = (form.get('coin') as string || '').trim().toUpperCase();
    const position = (form.get('position') as string || 'Long');
    const date = form.get('date') as string || new Date().toISOString().split('T')[0];
    const time = form.get('time') as string || undefined;
    const entry_price = form.get('entry_price') ? Number(form.get('entry_price')) : undefined;
    const stop_loss = form.get('stop_loss') ? Number(form.get('stop_loss')) : undefined;
    const quantity = form.get('quantity') ? Number(form.get('quantity')) : undefined;
    const pnl = form.get('pnl') ? Number(form.get('pnl')) : undefined;
    const fee = form.get('fee') ? Number(form.get('fee')) : undefined;
    const date_closed = form.get('date_closed') as string || undefined;
    const duration = form.get('duration') as string || undefined;
    const strategy = form.get('strategy') as string || undefined;
    const leverage = form.get('leverage') as string || undefined;
    const confidence = form.get('confidence') ? Number(form.get('confidence')) : undefined;
    const risk_pct = form.get('risk_pct') ? Number(form.get('risk_pct')) : undefined;
    const range_pct = form.get('range_pct') ? Number(form.get('range_pct')) : undefined;
    const limit_type = form.get('limit_type') as string || undefined;
    const reason = form.get('reason') as string || undefined;
    const pre_notes = form.get('pre_notes') as string || undefined;
    const post_notes = form.get('post_notes') as string || undefined;

    const win = pnl !== undefined ? pnl > 0 : false;
    const loss = pnl !== undefined ? pnl < 0 : false;
    const be = pnl !== undefined ? pnl === 0 : false;

    const timeframes = form.getAll('timeframes') as string[];

    await convex.mutation(api.trades.createTrade, {
      coin,
      position,
      date,
      time,
      entry_price,
      stop_loss,
      quantity,
      pnl,
      fee,
      date_closed,
      duration,
      strategy,
      timeframes: timeframes.length > 0 ? timeframes : undefined,
      leverage,
      confidence,
      risk_pct,
      range_pct,
      limit_type,
      reason,
      pre_notes,
      post_notes,
      win,
      loss,
      be,
      source: 'manual',
    });

    redirect(303, '/trades');
  }
};
