import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { api } from '../../../../../convex/_generated/api';
import type { Id } from '../../../../../convex/_generated/dataModel';
import type { FunctionArgs } from 'convex/server';

type TradeUpdates = Omit<FunctionArgs<typeof api.trades.updateTrade>, 'id'>;

export const load: PageServerLoad = async ({ locals: { convex }, params }) => {
	const trade = await convex
		.query(api.trades.getTradeById, { id: params.id as Id<'trades'> })
		.catch(() => null);
	if (!trade) error(404, 'Trade not found');
	const liquidationId = await convex.query(api.liquidations.getLiquidationForTrade, {
		tradeId: trade._id
	});
	return { trade: { ...trade, id: trade._id }, liquidationId };
};

export const actions: Actions = {
	undoCombine: async ({ locals: { convex }, params }) => {
		try {
			await convex.mutation(api.trades.undoCombine, { id: params.id as Id<'trades'> });
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Could not undo combination.' });
		}
		redirect(303, `/trades?notes=${params.id}`);
	},
	update: async ({ locals: { convex }, params, request }) => {
		const form = await request.formData();
		const updates: Record<string, unknown> = {};
		if (form.has('original_quantity'))
			updates.original_quantity = Number(form.get('original_quantity'));

		const fields = [
			'coin',
			'position',
			'date',
			'time',
			'entry_price',
			'exit_price',
			'stop_loss',
			'quantity',
			'pnl',
			'fee',
			'date_closed',
			'duration',
			'strategy',
			'leverage',
			'confidence',
			'risk_pct',
			'range_pct',
			'limit_type',
			'reason',
			'pre_notes',
			'post_notes',
			'closed_reason',
			'time_closed'
		];

		for (const field of fields) {
			const val = form.get(field);
			if (val !== null) {
				const numFields = [
					'entry_price',
					'exit_price',
					'stop_loss',
					'quantity',
					'pnl',
					'fee',
					'confidence',
					'risk_pct',
					'range_pct'
				];
				updates[field] = numFields.includes(field)
					? val === ''
						? null
						: Number(val)
					: val === '' && !['coin', 'date', 'position'].includes(field)
						? null
						: val;
			}
		}

		if (form.has('liquidated_present')) updates.liquidated = form.get('liquidated') === 'on';

		const tf = form.getAll('timeframes');
		updates.timeframes = tf as string[];

		const pnl = updates.pnl;
		if (typeof pnl === 'number') {
			updates.win = pnl > 0;
			updates.loss = pnl < 0;
			updates.be = pnl === 0;
		}

		try {
			// Field values are validated by the Convex mutation's argument validators.
			await convex.mutation(api.trades.updateTrade, {
				id: params.id as Id<'trades'>,
				...(updates as TradeUpdates)
			});
			return { success: true };
		} catch (err) {
			return fail(400, {
				error: (err instanceof Error && err.message) || 'Failed to update trade.'
			});
		}
	},

	delete: async ({ locals: { convex }, params }) => {
		try {
			await convex.mutation(api.trades.deleteTrade, { id: params.id as Id<'trades'> });
			return { deleted: true };
		} catch (err) {
			return { deleted: false, error: err instanceof Error ? err.message : undefined };
		}
	}
};
