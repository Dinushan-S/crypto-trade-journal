import type { PageServerLoad } from './$types';
import { api } from '../../../../convex/_generated/api';

export const load: PageServerLoad = async ({ locals: { convex } }) => {
	const liquidations = await convex.query(api.liquidations.getLiquidations, {}).catch(() => []);
	const mapped = liquidations.map((l) => ({ ...l, id: l._id }));
	const totalLost = mapped.reduce((s, l) => s + (l.amount_lost ?? 0), 0);
	return { liquidations: mapped, total: mapped.length, totalLost };
};
