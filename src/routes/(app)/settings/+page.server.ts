import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  return { user };
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
};
