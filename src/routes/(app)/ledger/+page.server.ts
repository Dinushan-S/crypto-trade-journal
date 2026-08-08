import type { PageServerLoad } from './$types';
import { api } from '../../../../convex/_generated/api';

export const load: PageServerLoad = async ({ locals: { convex } }) => {
  const entries: any[] = await convex.query(api.ledger.getLedger, {}).catch(() => []);
  return { entries: entries.map((e: any) => ({ ...e, id: e._id })) };
};
