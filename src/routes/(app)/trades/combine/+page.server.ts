import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { api } from '../../../../../convex/_generated/api';
import type { Id } from '../../../../../convex/_generated/dataModel';

export const load: PageServerLoad = async ({ locals: { convex }, url }) => {
	const ids = [...new Set((url.searchParams.get('ids') ?? '').split(',').filter(Boolean))];
	if (ids.length < 2 || ids.length > 100) error(400, 'Select between 2 and 100 trades.');
	const trades = await Promise.all(
		ids.map((id) =>
			convex.query(api.trades.getTradeById, { id: id as Id<'trades'> }).catch(() => null)
		)
	);
	if (trades.some((t) => !t)) error(404, 'A selected trade was not found.');
	return { trades: trades.filter((t) => t !== null) };
};

export const actions: Actions = {
	default: async ({ locals: { convex }, request }) => {
		const form = await request.formData();
		let id: Id<'trades'>;
		try {
			id = await convex.mutation(api.trades.combineTrades, {
				ids: form.getAll('ids') as Id<'trades'>[],
				primaryId: String(form.get('primaryId')) as Id<'trades'>,
				original_quantity: Number(form.get('original_quantity')),
				date: String(form.get('date') ?? ''),
				time: String(form.get('time') || '') || undefined,
				entry_price: form.get('entry_price') ? Number(form.get('entry_price')) : undefined,
				leverage: String(form.get('leverage') || '') || undefined,
				strategy: String(form.get('strategy') || '') || undefined,
				reason: String(form.get('reason') || '') || undefined,
				pre_notes: String(form.get('pre_notes') || '') || undefined,
				post_notes: String(form.get('post_notes') || '') || undefined
			});
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Could not combine trades.' });
		}
		redirect(303, `/trades/${id}`);
	}
};
