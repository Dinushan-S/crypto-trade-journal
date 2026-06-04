import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const { date } = params;

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('date', date);

  const byType: Record<string, any> = {};
  for (const s of sessions ?? []) {
    byType[s.session_type] = s;
  }

  return { date, pre: byType['pre'] ?? null, tcl: byType['tcl'] ?? null, post: byType['post'] ?? null };
};

export const actions: Actions = {
  save: async ({ request, params, locals: { supabase } }) => {
    const form = await request.formData();
    const date = params.date;
    const session_type = form.get('session_type') as string;

    const fields: Record<string, any> = { date, session_type };

    if (session_type === 'pre') {
      fields.market_bias = form.get('market_bias') || null;
      fields.key_levels = form.get('key_levels') || null;
      fields.watchlist = form.get('watchlist') || null;
      fields.plan = form.get('plan') || null;
      fields.notes = form.get('notes') || null;
    } else if (session_type === 'tcl') {
      fields.observations = form.get('observations') || null;
      fields.active_trades = form.get('active_trades') || null;
      fields.adjustments = form.get('adjustments') || null;
      fields.notes = form.get('notes') || null;
    } else if (session_type === 'post') {
      fields.review = form.get('review') || null;
      fields.mistakes = form.get('mistakes') || null;
      fields.lessons = form.get('lessons') || null;
      fields.emotion_rating = form.get('emotion_rating') ? Number(form.get('emotion_rating')) : null;
      fields.notes = form.get('notes') || null;
    }

    // Check if record exists
    const { data: existing } = await supabase
      .from('sessions')
      .select('id')
      .eq('date', date)
      .eq('session_type', session_type)
      .single();

    let error;
    if (existing) {
      ({ error } = await supabase.from('sessions').update(fields).eq('id', existing.id));
    } else {
      ({ error } = await supabase.from('sessions').insert(fields));
    }

    if (error) return fail(500, { error: error.message });
    return { success: true };
  },
};
