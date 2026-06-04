import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
  const { data: liquidations, count } = await supabase
    .from('liquidations')
    .select('*', { count: 'exact' })
    .order('date', { ascending: false });

  const totalLost = (liquidations ?? []).reduce((s, l) => s + (l.amount_lost ?? 0), 0);
  return { liquidations: liquidations ?? [], total: count ?? 0, totalLost };
};
