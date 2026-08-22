import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '../../../../../convex/_generated/api';

export const load: PageServerLoad = async ({ params, locals: { convex } }) => {
  const id = params.id;
  if (!id) redirect(303, '/liquidations');

  const detail = await convex.query(api.liquidations.getLiquidationDetail, { id: id as any }).catch(() => null);
  if (!detail) redirect(303, '/liquidations');

  const availableTrades: any[] = await convex
    .query(api.liquidations.getAvailableTrades, {})
    .catch(() => []);

  return { detail, availableTrades };
};

export const actions: Actions = {
  'delete': async ({ locals: { convex }, request }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;
    if (!id || typeof id !== 'string') return { error: 'Invalid ID' };
    try {
      await convex.mutation(api.liquidations.deleteLiquidation, { id: id as any });
    } catch {
      return { error: 'Failed to delete liquidation' };
    }
    redirect(303, '/liquidations');
  },
  'unlink': async ({ locals: { convex }, request }) => {
    const formData = await request.formData();
    const liquidationId = formData.get('liquidationId') as string;
    const tradeId = formData.get('tradeId') as string;
    if (!liquidationId || !tradeId) return { error: 'Missing IDs' };
    try {
      await convex.mutation(api.liquidations.unlinkTradeFromLiquidation, {
        liquidationId: liquidationId as any,
        tradeId: tradeId as any,
      });
    } catch {
      return { error: 'Failed to unlink trade' };
    }
    redirect(303, `/liquidations/${liquidationId}`);
  },
  'addTrades': async ({ locals: { convex }, request }) => {
    const formData = await request.formData();
    const liquidationId = formData.get('liquidationId') as string;
    const tradeIdsStr = formData.get('tradeIds') as string;
    if (!liquidationId || !tradeIdsStr) return { error: 'Missing IDs' };
    const tradeIds = tradeIdsStr.split(',').filter(Boolean).map((t) => t.trim());
    if (tradeIds.length === 0) return { error: 'No trades selected' };
    try {
      await convex.mutation(api.liquidations.updateLiquidationLinkedTrades, {
        liquidationId: liquidationId as any,
        tradeIds: tradeIds as any[],
      });
    } catch {
      return { error: 'Failed to add trades' };
    }
    redirect(303, `/liquidations/${liquidationId}`);
  },
};
