import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { api } from '../../../../../convex/_generated/api';
import type { Id } from '../../../../../convex/_generated/dataModel';

export const load: PageServerLoad = async ({ locals: { convex }, params }) => {
	const entry = await convex
		.query(api.ledger.getLedgerEntryById, { id: params.id as Id<'ledger'> })
		.catch(() => null);
	if (!entry) error(404, 'Entry not found');
	const tracking = await convex.query(api.ledger.getLedgerWithTracking, {}).catch(() => []);
	const tracked = tracking.find((e) => e._id === entry._id);
	const allocations =
		entry.type === 'withdrawal'
			? await convex
					.query(api.ledger.getWithdrawalAllocations, { withdrawalId: params.id as Id<'ledger'> })
					.catch(() => [])
			: [];
	const availableDeposits =
		entry.type === 'withdrawal'
			? tracking
					.filter(
						(e) =>
							e.type === 'deposit' &&
							'remainingUsd' in e.tracking &&
							e.tracking.remainingUsd != null &&
							e.tracking.remainingUsd > 0
					)
					.map((e) => ({ id: e._id, date: e.date, remainingUsd: e.tracking.remainingUsd }))
			: [];
	return {
		entry: { ...entry, id: entry._id },
		tracking: tracked?.tracking ?? null,
		allocations,
		availableDeposits
	};
};

export const actions: Actions = {
	update: async ({ locals: { convex }, params, request }) => {
		const form = await request.formData();
		const updates: Record<string, string | number | undefined> = {};

		const fields = [
			'type',
			'date',
			'time',
			'my_bank',
			'recipient_bank',
			'sender_bank',
			'receiver_bank',
			'fiat_sent',
			'usd_fee',
			'usd_rate',
			'usd_received',
			'usd_quantity',
			'fee',
			'fiat_amount',
			'notes',
			'order_number',
			'counterparty',
			'source'
		];

		for (const field of fields) {
			const val = form.get(field);
			if (val !== null) {
				const numFields = [
					'fiat_sent',
					'usd_fee',
					'usd_rate',
					'usd_received',
					'usd_quantity',
					'fee',
					'fiat_amount'
				];
				updates[field] = numFields.includes(field)
					? val === ''
						? undefined
						: Number(val)
					: val === ''
						? undefined
						: String(val);
			}
		}

		try {
			await convex.mutation(api.ledger.updateLedgerEntry, {
				id: params.id as Id<'ledger'>,
				...updates
			});
			return { success: true };
		} catch (err) {
			return { success: false, error: err instanceof Error ? err.message : String(err) };
		}
	},

	delete: async ({ locals: { convex }, params }) => {
		try {
			await convex.mutation(api.ledger.deleteLedgerEntry, { id: params.id as Id<'ledger'> });
			return { deleted: true };
		} catch (err) {
			return { deleted: false, error: err instanceof Error ? err.message : String(err) };
		}
	},

	lock: async ({ locals: { convex }, params }) => {
		try {
			await convex.mutation(api.ledger.createLedgerLock, {
				depositId: params.id as Id<'ledger'>
			});
			return { success: true };
		} catch (err) {
			return { success: false, error: err instanceof Error ? err.message : String(err) };
		}
	},

	reset: async ({ locals: { convex }, params, request }) => {
		const form = await request.formData();
		const type = (form.get('type') as string) || 'deposit';
		try {
			if (type === 'withdrawal') {
				await convex.mutation(api.ledger.removeWithdrawalAllocations, {
					withdrawalId: params.id as Id<'ledger'>
				});
			} else {
				await convex.mutation(api.ledger.removeLedgerLock, {
					depositId: params.id as Id<'ledger'>
				});
			}
			return { success: true };
		} catch (err) {
			return { success: false, error: err instanceof Error ? err.message : String(err) };
		}
	},

	rebalance: async ({ locals: { convex }, params, request }) => {
		const form = await request.formData();
		const allocations = JSON.parse((form.get('allocations') as string) ?? '[]') as {
			depositId: string;
			releasedUsd: number;
		}[];
		try {
			await convex.mutation(api.ledger.allocateRelease, {
				withdrawalId: params.id as Id<'ledger'>,
				allocations: allocations.map((a) => ({
					depositId: a.depositId as Id<'ledger'>,
					releasedUsd: a.releasedUsd
				}))
			});
			return { success: true };
		} catch (err) {
			return { success: false, error: err instanceof Error ? err.message : String(err) };
		}
	}
};
