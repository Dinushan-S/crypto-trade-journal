import type { PageServerLoad, Actions } from './$types';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';

export const load: PageServerLoad = async ({ locals: { convex } }) => {
  const entries: any[] = await convex.query(api.ledger.getLedgerWithTracking, {}).catch(() => []);
  return { entries: entries.map((e: any) => ({ ...e, id: e._id })) };
};

export const actions: Actions = {
  lock: async ({ locals: { convex }, request }) => {
    const form = await request.formData();
    const depositId = form.get('depositId') as string;
    const lockedUsd = Number(form.get('lockedUsd'));
    try {
      await convex.mutation(api.ledger.createLedgerLock, {
        depositId: depositId as Id<'ledger'>,
        lockedUsd,
      });
      return { success: true };
    } catch (err: any) {
      return { error: err.message };
    }
  },

  allocate: async ({ locals: { convex }, request }) => {
    const form = await request.formData();
    const withdrawalId = form.get('withdrawalId') as string;
    const rows = JSON.parse((form.get('allocations') as string) ?? '[]') as { depositId: string; releasedUsd: number }[];
    try {
      await convex.mutation(api.ledger.allocateRelease, {
        withdrawalId: withdrawalId as Id<'ledger'>,
        allocations: rows.map((r) => ({ depositId: r.depositId as Id<'ledger'>, releasedUsd: r.releasedUsd })),
      });
      return { success: true };
    } catch (err: any) {
      return { error: err.message };
    }
  },
};
