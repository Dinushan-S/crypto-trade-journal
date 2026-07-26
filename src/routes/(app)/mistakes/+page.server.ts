import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
  const { data: mistakes, error } = await supabase
    .from('mistakes')
    .select('*, trades(id, coin, position, pnl, date)')
    .order('trade_date', { ascending: false });

  if (error) {
    console.error('Error fetching mistakes:', error);
  }

  const allMistakes = mistakes ?? [];

  // Calculate summary metrics
  const totalMistakes = allMistakes.length;
  
  // Find top category
  const categoryCounts: Record<string, number> = {};
  allMistakes.forEach((m) => {
    if (m.category) {
      categoryCounts[m.category] = (categoryCounts[m.category] || 0) + 1;
    }
  });

  let topCategory = 'None';
  let topCategoryCount = 0;
  Object.entries(categoryCounts).forEach(([cat, cnt]) => {
    if (cnt > topCategoryCount) {
      topCategory = cat;
      topCategoryCount = cnt;
    }
  });

  const lessonsCount = allMistakes.filter((m) => m.lesson_learned && m.lesson_learned.trim().length > 0).length;

  return {
    mistakes: allMistakes,
    totalMistakes,
    topCategory,
    topCategoryCount,
    lessonsCount,
  };
};

export const actions: Actions = {
  delete: async ({ request, locals: { supabase } }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;

    if (!id) return fail(400, { error: 'Missing mistake ID' });

    const { error } = await supabase.from('mistakes').delete().eq('id', id);

    if (error) {
      console.error('Error deleting mistake:', error);
      return fail(500, { error: error.message });
    }

    return { success: true };
  },
};
