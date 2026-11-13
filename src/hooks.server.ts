import { createConvexServerClient } from '$lib/convex';
import {
	TOKEN_COOKIE,
	REFRESH_COOKIE,
	setAuthCookies,
	clearAuthCookies,
	isExpired
} from '$lib/auth';
import { api } from '../convex/_generated/api';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const convex = createConvexServerClient();
	event.locals.convex = convex;

	let token = event.cookies.get(TOKEN_COOKIE) ?? null;
	const refreshToken = event.cookies.get(REFRESH_COOKIE) ?? null;

	// Access tokens live ~1h; swap an expired one for a fresh pair before serving the request.
	if ((!token || isExpired(token)) && refreshToken) {
		const result = await convex.action(api.auth.signIn, { refreshToken }).catch(() => null);
		if (result?.tokens) {
			setAuthCookies(event.cookies, result.tokens);
			token = result.tokens.token;
		} else {
			clearAuthCookies(event.cookies);
			token = null;
		}
	} else if (token && isExpired(token)) {
		clearAuthCookies(event.cookies);
		token = null;
	}

	event.locals.token = token;
	if (token) {
		convex.setAuth(token);
		const viewer = await convex.query(api.auth.viewer, {}).catch(() => null);
		event.locals.user = viewer ? { id: viewer._id, email: viewer.email, name: viewer.name } : null;
	} else {
		event.locals.user = null;
	}

	return resolve(event);
};
