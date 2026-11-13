import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { api } from '../../../../../convex/_generated/api';

export const load: PageServerLoad = async ({ params, locals: { convex } }) => {
	const { date } = params;

	const sessions: any[] = await convex.query(api.sessions.getSessions, {}).catch(() => []);
	const dateSessions = sessions.filter((s: any) => s.date === date);

	const byType: Record<string, any> = {};
	for (const s of dateSessions) {
		byType[s.session_type] = { ...s, id: s._id };
	}

	return {
		date,
		pre: byType['pre'] ?? null,
		tcl: byType['tcl'] ?? null,
		post: byType['post'] ?? null
	};
};

export const actions: Actions = {
	save: async ({ request, params, locals: { convex } }) => {
		const form = await request.formData();
		const date = params.date;
		const session_type = form.get('session_type') as string;

		const fields: Record<string, any> = { date, session_type };

		if (session_type === 'pre') {
			fields.market_bias = (form.get('market_bias') as string) || undefined;
			fields.session_notes = (form.get('notes') as string) || undefined;
		} else if (session_type === 'tcl') {
			fields.session_notes = (form.get('notes') as string) || undefined;
		} else if (session_type === 'post') {
			fields.what_right = (form.get('lessons') as string) || undefined;
			fields.session_notes = (form.get('notes') as string) || undefined;
		}

		try {
			await convex.mutation(api.sessions.upsertSession, {
				date,
				session_type,
				status: 'completed',
				...fields
			});
			return { success: true };
		} catch (err: any) {
			return fail(500, { error: err.message });
		}
	}
};
