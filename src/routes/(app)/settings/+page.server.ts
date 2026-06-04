import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession }, cookies }) => {
  const { user } = await safeGetSession();
  const calendarTz = (cookies.get('calendarTz') ?? 'local') as 'local' | 'utc';
  return { user, calendarTz };
};

export const actions: Actions = {
  updatePassword: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const password = form.get('password') as string;
    const confirm = form.get('confirm') as string;

    if (!password || password.length < 6) return fail(400, { error: 'Password must be at least 6 characters.' });
    if (password !== confirm) return fail(400, { error: 'Passwords do not match.' });

    const { error } = await supabase.auth.updateUser({ password });
    if (error) return fail(500, { error: error.message });
    return { success: true };
  },

  clearTrades: async ({ locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { clearError: 'Not authenticated.' });

    const { error } = await supabase.from('trades').delete().eq('user_id', user.id);
    if (error) return fail(500, { clearError: error.message });

    // Also clear the import log so re-imports aren't blocked by old dedup records
    await supabase.from('binance_imports').delete().eq('user_id', user.id);

    return { clearSuccess: 'trades' };
  },

  clearLedger: async ({ locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { clearError: 'Not authenticated.' });

    const { error } = await supabase.from('ledger').delete().eq('user_id', user.id);
    if (error) return fail(500, { clearError: error.message });

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
