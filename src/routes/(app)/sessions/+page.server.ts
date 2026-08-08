import type { PageServerLoad } from './$types';
import { api } from '../../../../convex/_generated/api';

export const load: PageServerLoad = async ({ locals: { convex } }) => {
  const sessions = await convex.query(api.sessions.getSessions, {}).catch(() => []);

  const grouped: Record<string, { date: string; pre?: any; tcl?: any; post?: any }> = {};
  for (const s of sessions) {
    if (!grouped[s.date]) grouped[s.date] = { date: s.date };
    grouped[s.date][s.session_type as 'pre' | 'tcl' | 'post'] = { ...s, id: s._id };
  }

  return { sessions: Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date)) };
};
