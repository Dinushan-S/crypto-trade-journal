import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { api } from '../../../../../convex/_generated/api';

export const actions: Actions = {
  default: async ({ locals: { convex }, request }) => {
    const form = await request.formData();
    const date = (form.get('date') as string) || new Date().toISOString().split('T')[0];
    const coin = (form.get('coin') as string) || undefined;
    const position = (form.get('position') as string) || undefined;
    const amount_lost = form.get('amount_lost') ? Number(form.get('amount_lost')) : undefined;
    const strategy = (form.get('strategy') as string) || undefined;
    const reason = (form.get('reason') as string) || undefined;
    const notes = (form.get('notes') as string) || undefined;

    await convex.mutation(api.liquidations.createLiquidation, {
      date,
      coin,
      position,
      amount_lost,
      strategy,
      reason,
      notes,
    });

    redirect(303, '/liquidations');
  }
};
