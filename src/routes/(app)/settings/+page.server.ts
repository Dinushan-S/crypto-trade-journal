import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { api } from '../../../../convex/_generated/api';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	const calendarTz = (cookies.get('calendarTz') ?? 'local') as 'local' | 'utc';
	let mySession: { start: string; end: string; tz: string } | null = null;
	const s = await locals.convex.query(api.userSettings.getUserSettings, {}).catch(() => null);
	if (s)
		mySession = {
			start: s.my_session_start ?? '04:30',
			end: s.my_session_end ?? '12:30',
			tz: s.view_tz ?? 'utc'
		};
	return { user: locals.user, calendarTz, mySession };
};

export const actions: Actions = {
	updatePassword: async ({ request }) => {
		const form = await request.formData();
		const password = form.get('password') as string;
		const confirm = form.get('confirm') as string;

		if (!password || password.length < 6)
			return fail(400, { error: 'Password must be at least 6 characters.' });
		if (password !== confirm) return fail(400, { error: 'Passwords do not match.' });

		return { success: true };
	},

	clearTrades: async ({ locals }) => {
		if (!locals.user) return fail(401, { clearError: 'Not authenticated.' });
		return { clearSuccess: 'trades' };
	},

	clearLedger: async ({ locals }) => {
		if (!locals.user) return fail(401, { clearError: 'Not authenticated.' });
		return { clearSuccess: 'ledger' };
	},

	setTimezone: async ({ request, cookies }) => {
		const tz = (await request.formData()).get('tz') as string;
		if (tz === 'utc' || tz === 'local') {
			cookies.set('calendarTz', tz, { path: '/', maxAge: 60 * 60 * 24 * 365 });
		}
		return { tzUpdated: true };
	},

	saveMySession: async ({ request, locals }) => {
		const form = await request.formData();
		const start = (form.get('my_start') as string)?.trim();
		const end = (form.get('my_end') as string)?.trim();
		const view_tz = (form.get('view_tz') as string)?.trim();
		if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end))
			return fail(400, { error: 'Use HH:MM for My Session times.' });
		if (view_tz !== 'utc' && view_tz !== 'colombo')
			return fail(400, { error: 'Invalid timezone.' });
		try {
			await locals.convex.mutation(api.userSettings.upsertUserSettings, {
				my_session_start: start,
				my_session_end: end,
				view_tz
			});
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Save failed.' });
		}
		return { mySessionSaved: true };
	}
};
