import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
  const { data } = await supabase
    .from('sessions')
    .select('id, date, session_type, status, market_bias')
    .order('date', { ascending: false })
    .limit(60);

  // Group by date
  const grouped: Record<string, { date: string; pre?: any; tcl?: any; post?: any }> = {};
  for (const s of data ?? []) {
    if (!grouped[s.date]) grouped[s.date] = { date: s.date };
    grouped[s.date][s.session_type as 'pre' | 'tcl' | 'post'] = s;
  }

  return { sessions: Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date)) };
};
