import type { PageServerLoad, Actions } from './$types';
import { fail, redirect, error } from '@sveltejs/kit';
import { api } from '../../../../../convex/_generated/api';
import type { Id } from '../../../../../convex/_generated/dataModel';

export const load: PageServerLoad = async ({ params, locals: { convex } }) => {
	const { id } = params;

	const mistake = await convex
		.query(api.mistakes.getMistakeById, { id: id as Id<'mistakes'> })
		.catch(() => null);
	if (!mistake) {
		throw error(404, 'Mistake entry not found');
	}

	const trades = await convex.query(api.trades.getTrades, {}).catch(() => []);

	return {
		mistake: { ...mistake, id: mistake._id },
		trades: trades.slice(0, 50).map((t) => ({ ...t, id: t._id }))
	};
};

export const actions: Actions = {
	default: async ({ params, request, locals: { convex } }) => {
		const { id } = params;
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
			await convex.mutation(api.mistakes.updateMistake, {
				id: id as Id<'mistakes'>,
				trade_id,
				trade_date,
				trade_time,
				coin: coin ? coin.toUpperCase() : undefined,
				why_took_trade,
				mistake_details,
				lesson_learned,
				category,
				severity
			});
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Failed to save mistake.'
			});
		}

		redirect(303, '/mistakes');
	}
};
