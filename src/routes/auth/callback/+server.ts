import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const code = url.searchParams.get('code');
	const nextParam = url.searchParams.get('next') ?? '/';
	// Only allow relative paths to prevent open redirect attacks
	const next = /^\/(?!\/)/.test(nextParam) ? nextParam : '/';

	if (code) {
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error) {
			throw redirect(303, next);
		}
	}

	throw redirect(303, '/login?error=auth_callback_failed');
};
