import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '../../../../../convex/_generated/api';
import type { Id } from '../../../../../convex/_generated/dataModel';

export const load: PageServerLoad = async ({ params, locals: { convex }, url }) => {
	const id = params.id;
	if (!id) redirect(303, '/liquidations');

	const detail = await convex
		.query(api.liquidations.getLiquidationDetail, { id: id as Id<'liquidations'> })
		.catch(() => null);
	if (!detail) redirect(303, '/liquidations');

	const availableTrades = await convex
		.query(api.liquidations.getAvailableTrades, {})
		.catch(() => []);

	return { detail, availableTrades, edit: url.searchParams.has('edit') };
};

export const actions: Actions = {
	update: async ({ locals: { convex }, params, request }) => {
		const form = await request.formData();
		const date = String(form.get('date') ?? '');
		const amount_lost = Number(form.get('amount_lost'));
		if (!date || !Number.isFinite(amount_lost) || amount_lost <= 0) {
			return fail(400, { error: 'Enter a date and a positive amount lost.' });
		}
		try {
			await convex.mutation(api.liquidations.updateLiquidation, {
				id: params.id as Id<'liquidations'>,
				date,
				amount_lost,
				coin: String(form.get('coin') ?? ''),
				position: String(form.get('position') ?? ''),
				strategy: String(form.get('strategy') ?? ''),
				reason: String(form.get('reason') ?? ''),
				mistake: String(form.get('mistake') ?? ''),
				notes: String(form.get('notes') ?? '')
			});
			return { success: true };
		} catch (err) {
			return fail(400, {
				error: err instanceof Error ? err.message : 'Failed to update liquidation.'
			});
		}
	},
	delete: async ({ locals: { convex }, request }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;
		if (!id || typeof id !== 'string') return fail(400, { error: 'Invalid ID' });
		try {
			await convex.mutation(api.liquidations.deleteLiquidation, {
				id: id as Id<'liquidations'>
			});
		} catch {
			return fail(400, { error: 'Failed to delete liquidation' });
		}
		redirect(303, '/liquidations');
	},
	unlink: async ({ locals: { convex }, request }) => {
		const formData = await request.formData();
		const liquidationId = formData.get('liquidationId') as string;
		const tradeId = formData.get('tradeId') as string;
		if (!liquidationId || !tradeId) return fail(400, { error: 'Missing IDs' });
		try {
			await convex.mutation(api.liquidations.unlinkTradeFromLiquidation, {
				liquidationId: liquidationId as Id<'liquidations'>,
				tradeId: tradeId as Id<'trades'>
			});
		} catch {
			return fail(400, { error: 'Failed to unlink trade' });
		}
		redirect(303, `/liquidations/${liquidationId}`);
	},
	addTrades: async ({ locals: { convex }, request }) => {
		const formData = await request.formData();
		const liquidationId = formData.get('liquidationId') as string;
		const tradeIdsStr = formData.get('tradeIds') as string;
		if (!liquidationId || !tradeIdsStr) return fail(400, { error: 'Missing IDs' });
		const tradeIds = tradeIdsStr
			.split(',')
			.filter(Boolean)
			.map((t) => t.trim());
		if (tradeIds.length === 0) return fail(400, { error: 'No trades selected' });
		try {
			await convex.mutation(api.liquidations.updateLiquidationLinkedTrades, {
				liquidationId: liquidationId as Id<'liquidations'>,
				tradeIds: tradeIds as Id<'trades'>[]
			});
		} catch {
			return fail(400, { error: 'Failed to add trades' });
		}
		redirect(303, `/liquidations/${liquidationId}`);
	}
};
