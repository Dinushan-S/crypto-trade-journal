import { redirect } from '@sveltejs/kit';
import { api } from '../../../convex/_generated/api';
import { clearAuthCookies } from '$lib/auth';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ cookies, locals }) => {
		if (locals.token) await locals.convex.action(api.auth.signOut, {}).catch(() => {});
		clearAuthCookies(cookies);
		redirect(303, '/login');
	}
};
