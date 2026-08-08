import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals, cookies }) => {
  const calendarTz = (cookies.get('calendarTz') ?? 'local') as 'local' | 'utc';
  return { user: locals.user, calendarTz };
};

export const actions: Actions = {
  updatePassword: async ({ request }) => {
    const form = await request.formData();
    const password = form.get('password') as string;
    const confirm = form.get('confirm') as string;

    if (!password || password.length < 6) return fail(400, { error: 'Password must be at least 6 characters.' });
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
};
