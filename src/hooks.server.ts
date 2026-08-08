import { createConvexServerClient } from '$lib/convex';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.convex = createConvexServerClient();
  const token = event.cookies.get('convex_auth_token') || null;
  event.locals.token = token;

  if (token) {
    event.locals.convex.setAuth(token);
    // In Convex, setting auth on ConvexHttpClient authenticates subsequent query/mutation calls
    event.locals.user = { id: 'authenticated_user' };
  } else {
    event.locals.user = null;
  }

  return resolve(event);
};
