import type { PageServerLoad } from './$types';
import { api } from '../../../../convex/_generated/api';

export const load: PageServerLoad = async ({ locals: { convex } }) => {
  const liquidations: any[] = await convex.query(api.liquidations.getLiquidations, {}).catch(() => []);
  const mapped = liquidations.map((l: any) => ({ ...l, id: l._id }));
  const totalLost = mapped.reduce((s: number, l: any) => s + (l.amount_lost ?? 0), 0);
  return { liquidations: mapped, total: mapped.length, totalLost };
};
