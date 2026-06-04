import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
  const { data: entries } = await supabase
    .from('ledger')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  return { entries: entries ?? [] };
};
