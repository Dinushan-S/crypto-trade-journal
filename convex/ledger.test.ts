/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

function makeT() {
	const t = convexTest(schema, modules);
	return t.withIdentity({ subject: 'user-123', tokenIdentifier: 'token-123' });
}

type Entry = {
	type: string;
	date: string;
	fiat_sent?: number;
	usd_fee?: number;
	usd_rate?: number;
	usd_received?: number;
	usd_quantity?: number;
	fee?: number;
	fiat_amount?: number;
	source?: string;
};

async function addDeposit(t: any, over: Partial<Entry> = {}) {
	const id = await t.mutation(api.ledger.createLedgerEntry, {
		type: 'deposit',
		date: '2026-01-01',
		fiat_sent: 100000,
		usd_fee: 0,
		usd_rate: 320,
		usd_received: 5000,
		source: 'manual',
		...over
	});
	return id;
}

async function addWithdrawal(t: any, over: Partial<Entry> = {}) {
	const id = await t.mutation(api.ledger.createLedgerEntry, {
		type: 'withdrawal',
		date: '2026-01-02',
		usd_quantity: 1000,
		fee: 0,
		usd_rate: 320,
		fiat_amount: 320000,
		source: 'manual',
		...over
	});
	return id;
}

async function lock(t: any, depositId: string) {
	await t.mutation(api.ledger.createLedgerLock, { depositId });
}

async function allocate(
	t: any,
	withdrawalId: string,
	allocations: { depositId: string; releasedUsd: number }[]
) {
	await t.mutation(api.ledger.allocateRelease, { withdrawalId, allocations });
}

// --- T1: tracking query shape, no locks ---

test('tracking query returns entries with empty tracking state when no locks exist', async () => {
	const t = makeT();
	const d = await addDeposit(t);
	const w = await addWithdrawal(t);
	const entries = await t.query(api.ledger.getLedgerWithTracking);
	const dep = entries.find((e: any) => e._id === d)!;
	const wd = entries.find((e: any) => e._id === w)!;
	expect(dep.tracking).toMatchObject({
		lockedUsd: null,
		releasedUsd: 0,
		remainingUsd: null,
		fullyWithdrawn: false
	});
	expect(wd.tracking).toMatchObject({ balanceUsd: 1000 });
});

test('tracking query with no locks: deposit remaining null, withdrawal balance full released', async () => {
	const t = makeT();
	const d = await addDeposit(t, { usd_received: 5000 });
	const w = await addWithdrawal(t, { usd_quantity: 2000, fee: 0 });
	const entries = await t.query(api.ledger.getLedgerWithTracking);
	const dep = entries.find((e: any) => e._id === d)!;
	const wd = entries.find((e: any) => e._id === w)!;
	expect(dep.tracking.remainingUsd).toBeNull();
	expect(wd.tracking.balanceUsd).toBeCloseTo(2000, 2);
});

// --- T2: lock a deposit ---

test('lock a deposit: locks FULL usd_received, LKR derived from rate', async () => {
	const t = makeT();
	const d = await addDeposit(t, { usd_received: 5000, usd_rate: 320 });
	await lock(t, d);
	const entries = await t.query(api.ledger.getLedgerWithTracking);
	const dep = entries.find((e: any) => e._id === d)!;
	expect(dep.tracking).toMatchObject({
		lockedUsd: 5000,
		lockedLkr: 1600000,
		releasedUsd: 0,
		remainingUsd: 5000,
		remainingLkr: 1600000,
		fullyWithdrawn: false
	});
});

test('lock always uses full usd_received (no partial lock amount)', async () => {
	const t = makeT();
	const d = await addDeposit(t, { usd_received: 5000 });
	await lock(t, d);
	const entries = await t.query(api.ledger.getLedgerWithTracking);
	const dep = entries.find((e: any) => e._id === d)!;
	expect(dep.tracking.lockedUsd).toBe(5000);
});

test('re-locking an existing lock keeps full amount, not reduced by released', async () => {
	const t = makeT();
	const d = await addDeposit(t, { usd_received: 5000 });
	const w = await addWithdrawal(t, { usd_quantity: 2000 });
	await lock(t, d);
	await allocate(t, w, [{ depositId: d, releasedUsd: 2000 }]);
	// re-lock → stays at full 5000 (release is partial, not lock)
	await lock(t, d);
	const entries = await t.query(api.ledger.getLedgerWithTracking);
	const dep = entries.find((e: any) => e._id === d)!;
	expect(dep.tracking.lockedUsd).toBe(5000);
	expect(dep.tracking.releasedUsd).toBe(2000);
	expect(dep.tracking.remainingUsd).toBe(3000);
});

test('shrinking a deposit clamps its lock (full new amount)', async () => {
	const t = makeT();
	const d = await addDeposit(t, { usd_received: 5000 });
	await lock(t, d);
	await t.mutation(api.ledger.updateLedgerEntry, { id: d, usd_received: 3000 });
	const entries = await t.query(api.ledger.getLedgerWithTracking);
	const dep = entries.find((e: any) => e._id === d)!;
	expect(dep.tracking.lockedUsd).toBe(3000);
});

// --- T3: release / allocate ---

test('partial release: lock 5000, release 2000 → remaining 3000', async () => {
	const t = makeT();
	const d = await addDeposit(t, { usd_received: 5000 });
	const w = await addWithdrawal(t, { usd_quantity: 2000 });
	await lock(t, d);
	await allocate(t, w, [{ depositId: d, releasedUsd: 2000 }]);
	const entries = await t.query(api.ledger.getLedgerWithTracking);
	const dep = entries.find((e: any) => e._id === d)!;
	expect(dep.tracking).toMatchObject({
		lockedUsd: 5000,
		releasedUsd: 2000,
		remainingUsd: 3000,
		fullyWithdrawn: false
	});
	const wd = entries.find((e: any) => e._id === w)!;
	expect(wd.tracking.balanceUsd).toBe(0); // released 2000 of 2000 → balance 0
});

test('many-to-many: one withdrawal releases two deposits, many withdrawals release one deposit', async () => {
	const t = makeT();
	const d1 = await addDeposit(t, { usd_received: 5000 });
	const d2 = await addDeposit(t, { usd_received: 3000 });
	const w1 = await addWithdrawal(t, { usd_quantity: 2500 });
	const w2 = await addWithdrawal(t, { usd_quantity: 1500 });
	await lock(t, d1);
	await lock(t, d2);
	// w1 releases d1 (2000) + d2 (500)
	await allocate(t, w1, [
		{ depositId: d1, releasedUsd: 2000 },
		{ depositId: d2, releasedUsd: 500 }
	]);
	// w2 releases d1 (1500)
	await allocate(t, w2, [{ depositId: d1, releasedUsd: 1500 }]);
	const entries = await t.query(api.ledger.getLedgerWithTracking);
	const dep1 = entries.find((e: any) => e._id === d1)!;
	const dep2 = entries.find((e: any) => e._id === d2)!;
	expect(dep1.tracking.releasedUsd).toBe(3500);
	expect(dep1.tracking.remainingUsd).toBe(1500);
	expect(dep2.tracking.releasedUsd).toBe(500);
	expect(dep2.tracking.remainingUsd).toBe(2500);
	// w1 balance: 2499.93 - 2500 → 0; w2 balance: 1499.93 - 1500 → 0
	const wd1 = entries.find((e: any) => e._id === w1)!;
	const wd2 = entries.find((e: any) => e._id === w2)!;
	expect(wd1.tracking.balanceUsd).toBe(0);
	expect(wd2.tracking.balanceUsd).toBe(0);
});

test('allocation capped at deposit remaining; excess stays on withdrawal balance', async () => {
	const t = makeT();
	const d = await addDeposit(t, { usd_received: 5000 });
	const w1 = await addWithdrawal(t, { usd_quantity: 3000 });
	const w2 = await addWithdrawal(t, { usd_quantity: 3000 });
	await lock(t, d);
	await allocate(t, w1, [{ depositId: d, releasedUsd: 3000 }]);
	// second withdrawal tries 3000 but only 2000 remaining → capped to 2000, 1000 stays on balance
	await allocate(t, w2, [{ depositId: d, releasedUsd: 3000 }]);
	const entries = await t.query(api.ledger.getLedgerWithTracking);
	const dep = entries.find((e: any) => e._id === d)!;
	const wd2 = entries.find((e: any) => e._id === w2)!;
	expect(dep.tracking.releasedUsd).toBe(5000);
	expect(dep.tracking.remainingUsd).toBe(0);
	expect(wd2.tracking.balanceUsd).toBeCloseTo(1000, 2); // 3000 released - 2000 allocated (capped)
});

test('fully-withdrawn deposit flagged, excluded from picker (no remaining)', async () => {
	const t = makeT();
	const d = await addDeposit(t, { usd_received: 5000 });
	const w = await addWithdrawal(t, { usd_quantity: 5000 });
	await lock(t, d);
	await allocate(t, w, [{ depositId: d, releasedUsd: 5000 }]);
	const entries = await t.query(api.ledger.getLedgerWithTracking);
	const dep = entries.find((e: any) => e._id === d)!;
	expect(dep.tracking.fullyWithdrawn).toBe(true);
	expect(dep.tracking.remainingUsd).toBe(0);
});

test('LKR released splits proportionally; last allocation absorbs remainder', async () => {
	const t = makeT();
	const d1 = await addDeposit(t, { usd_received: 5000 });
	const d2 = await addDeposit(t, { usd_received: 3000 });
	const w = await addWithdrawal(t, { usd_quantity: 2500, fiat_amount: 800000, usd_rate: 320 });
	await lock(t, d1);
	await lock(t, d2);
	await allocate(t, w, [
		{ depositId: d1, releasedUsd: 2000 },
		{ depositId: d2, releasedUsd: 500 }
	]);
	const entries = await t.query(api.ledger.getLedgerWithTracking);
	const dep1 = entries.find((e: any) => e._id === d1)!;
	const dep2 = entries.find((e: any) => e._id === d2)!;
	// LKR shares: d1 2000/2500 * 800000 = 640000; d2 absorbs remainder 160000
	expect(dep1.tracking.releasedLkr).toBeCloseTo(640000, 0);
	expect(dep2.tracking.releasedLkr).toBeCloseTo(160000, 0);
});

// --- T4: rebalance & edit semantics ---

test('rebalance allocations: shift amount between deposits', async () => {
	const t = makeT();
	const d1 = await addDeposit(t, { usd_received: 5000 });
	const d2 = await addDeposit(t, { usd_received: 3000 });
	const w = await addWithdrawal(t, { usd_quantity: 2500 });
	await lock(t, d1);
	await lock(t, d2);
	await allocate(t, w, [{ depositId: d1, releasedUsd: 2500 }]);
	// rebalance: move 1000 from d1 to d2
	await t.mutation(api.ledger.allocateRelease, {
		withdrawalId: w,
		allocations: [
			{ depositId: d1, releasedUsd: 1500 },
			{ depositId: d2, releasedUsd: 1000 }
		]
	});
	const entries = await t.query(api.ledger.getLedgerWithTracking);
	const dep1 = entries.find((e: any) => e._id === d1)!;
	const dep2 = entries.find((e: any) => e._id === d2)!;
	expect(dep1.tracking.releasedUsd).toBe(1500);
	expect(dep2.tracking.releasedUsd).toBe(1000);
});

test('editing withdrawal usd_quantity scales allocations proportionally', async () => {
	const t = makeT();
	const d1 = await addDeposit(t, { usd_received: 5000 });
	const d2 = await addDeposit(t, { usd_received: 3000 });
	const w = await addWithdrawal(t, { usd_quantity: 2500, fiat_amount: 800000 });
	await lock(t, d1);
	await lock(t, d2);
	await allocate(t, w, [
		{ depositId: d1, releasedUsd: 2000 },
		{ depositId: d2, releasedUsd: 500 }
	]);
	// double the quantity → allocations double
	await t.mutation(api.ledger.updateLedgerEntry, { id: w, usd_quantity: 5000 });
	const entries = await t.query(api.ledger.getLedgerWithTracking);
	const dep1 = entries.find((e: any) => e._id === d1)!;
	const dep2 = entries.find((e: any) => e._id === d2)!;
	expect(dep1.tracking.releasedUsd).toBe(4000);
	expect(dep2.tracking.releasedUsd).toBe(1000);
});

test('editing withdrawal quantity keeps LKR split proportional to fiat_amount', async () => {
	const t = makeT();
	const d1 = await addDeposit(t, { usd_received: 5000 });
	const d2 = await addDeposit(t, { usd_received: 3000 });
	const w = await addWithdrawal(t, { usd_quantity: 2500, fiat_amount: 800000 });
	await lock(t, d1);
	await lock(t, d2);
	await allocate(t, w, [
		{ depositId: d1, releasedUsd: 2000 },
		{ depositId: d2, releasedUsd: 500 }
	]);
	// double quantity (fiat_amount unchanged) → USD allocations double, LKR total stays 800000 split 4:1
	await t.mutation(api.ledger.updateLedgerEntry, { id: w, usd_quantity: 5000 });
	const entries = await t.query(api.ledger.getLedgerWithTracking);
	const dep1 = entries.find((e: any) => e._id === d1)!;
	const dep2 = entries.find((e: any) => e._id === d2)!;
	expect(dep1.tracking.releasedLkr).toBeCloseTo(640000, 0);
	expect(dep2.tracking.releasedLkr).toBeCloseTo(160000, 0);
	expect((dep1.tracking.releasedLkr ?? 0) + (dep2.tracking.releasedLkr ?? 0)).toBeCloseTo(
		800000,
		0
	);
});

test('shrinking a deposit below its released amount clamps lock to released, not below', async () => {
	const t = makeT();
	const d = await addDeposit(t, { usd_received: 5000 });
	const w = await addWithdrawal(t, { usd_quantity: 3000 });
	await lock(t, d);
	await allocate(t, w, [{ depositId: d, releasedUsd: 3000 }]);
	// shrink deposit to 1000 (< released 3000) → lock must clamp to released 3000, remaining 0
	await t.mutation(api.ledger.updateLedgerEntry, { id: d, usd_received: 1000 });
	const entries = await t.query(api.ledger.getLedgerWithTracking);
	const dep = entries.find((e: any) => e._id === d)!;
	expect(dep.tracking.lockedUsd).toBe(3000);
	expect(dep.tracking.releasedUsd).toBe(3000);
	expect(dep.tracking.remainingUsd).toBe(0);
});

test('deleting a withdrawal frees its allocations back into remaining', async () => {
	const t = makeT();
	const d = await addDeposit(t, { usd_received: 5000 });
	const w = await addWithdrawal(t, { usd_quantity: 2000 });
	await lock(t, d);
	await allocate(t, w, [{ depositId: d, releasedUsd: 2000 }]);
	await t.mutation(api.ledger.deleteLedgerEntry, { id: w });
	const entries = await t.query(api.ledger.getLedgerWithTracking);
	const dep = entries.find((e: any) => e._id === d)!;
	expect(dep.tracking.releasedUsd).toBe(0);
	expect(dep.tracking.remainingUsd).toBe(5000);
});

// --- T5: delete protection & polish ---

test('deleting a deposit with release history is blocked', async () => {
	const t = makeT();
	const d = await addDeposit(t, { usd_received: 5000 });
	const w = await addWithdrawal(t, { usd_quantity: 2000 });
	await lock(t, d);
	await allocate(t, w, [{ depositId: d, releasedUsd: 2000 }]);
	await expect(t.mutation(api.ledger.deleteLedgerEntry, { id: d })).rejects.toThrow();
});

test('deleting a deposit with a lock but no releases still works (lock removed)', async () => {
	const t = makeT();
	const d = await addDeposit(t, { usd_received: 5000 });
	await lock(t, d);
	await t.mutation(api.ledger.deleteLedgerEntry, { id: d });
	const entries = await t.query(api.ledger.getLedgerWithTracking);
	expect(entries.find((e: any) => e._id === d)).toBeUndefined();
});

test('reset lock removes tracking; blocked once release history exists', async () => {
	const t = makeT();
	const d = await addDeposit(t, { usd_received: 5000 });
	await lock(t, d);
	await t.mutation(api.ledger.removeLedgerLock, { depositId: d });
	let entries = await t.query(api.ledger.getLedgerWithTracking);
	expect(entries.find((e: any) => e._id === d)!.tracking.lockedUsd).toBeNull();

	// re-lock + release → deposit reset is blocked
	const w = await addWithdrawal(t, { usd_quantity: 2000 });
	await lock(t, d);
	await allocate(t, w, [{ depositId: d, releasedUsd: 2000 }]);
	await expect(t.mutation(api.ledger.removeLedgerLock, { depositId: d })).rejects.toThrow();
	entries = await t.query(api.ledger.getLedgerWithTracking);
	expect(entries.find((e: any) => e._id === d)!.tracking.lockedUsd).toBe(5000);
});

test('reset withdrawal releases frees the deposit remaining back up', async () => {
	const t = makeT();
	const d = await addDeposit(t, { usd_received: 5000 });
	const w = await addWithdrawal(t, { usd_quantity: 2000 });
	await lock(t, d);
	await allocate(t, w, [{ depositId: d, releasedUsd: 2000 }]);
	// reset the withdrawal → allocations removed, deposit back to full remaining
	await t.mutation(api.ledger.removeWithdrawalAllocations, { withdrawalId: w });
	const entries = await t.query(api.ledger.getLedgerWithTracking);
	const dep = entries.find((e: any) => e._id === d)!;
	const wd = entries.find((e: any) => e._id === w)!;
	expect(dep.tracking.releasedUsd).toBe(0);
	expect(dep.tracking.remainingUsd).toBe(5000);
	expect(dep.tracking.fullyWithdrawn).toBe(false);
	expect(wd.tracking.balanceUsd).toBeCloseTo(2000, 2); // full released USD back on balance
});
