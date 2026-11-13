import { fail, redirect } from '@sveltejs/kit';
import { api } from '../../../convex/_generated/api';
import { setAuthCookies } from '$lib/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(303, '/');
	return {};
};

/** Resolves redirectTo against our own origin so an attacker can't bounce the user off-site. */
function safeRedirectTo(url: URL): string {
	const target = url.searchParams.get('redirectTo');
	if (!target) return '/';
	const dest = new URL(target, url.origin);
	return dest.origin === url.origin ? dest.pathname + dest.search : '/';
}

export const actions: Actions = {
	default: async ({ request, cookies, locals, url }) => {
		const data = await request.formData();
		const email = String(data.get('email') ?? '').trim();
		const password = String(data.get('password') ?? '');
		const flow = data.get('flow') === 'signup' ? 'signUp' : 'signIn';

		if (!email || !password)
			return fail(400, { error: 'Email and password are required.', email, flow });
		if (flow === 'signUp' && password.length < 8)
			return fail(400, { error: 'Password must be at least 8 characters.', email, flow });

		let result;
		try {
			result = await locals.convex.action(api.auth.signIn, {
				provider: 'password',
				params: { email, password, flow }
			});
		} catch {
			return fail(400, {
				error: flow === 'signUp' ? 'Could not create that account.' : 'Invalid email or password.',
				email,
				flow
			});
		}

		if (!result?.tokens) return fail(400, { error: 'Sign in failed.', email, flow });
		setAuthCookies(cookies, result.tokens);
		redirect(303, safeRedirectTo(url));
	}
};
