import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { api } from '../../../../convex/_generated/api';

export const load: PageServerLoad = async ({ locals: { convex }, url }) => {
	const coin = url.searchParams.get('coin') ?? '';
	const position = url.searchParams.get('position') ?? 'all';
	const result = url.searchParams.get('result') ?? 'all';
	const strategy = url.searchParams.get('strategy') ?? '';
	const source = url.searchParams.get('source') ?? 'all';
	const dateFrom = url.searchParams.get('dateFrom') ?? '';
	const dateTo = url.searchParams.get('dateTo') ?? '';
	const page = parseInt(url.searchParams.get('page') ?? '1');
	const limit = 50;

	const allTrades = await convex.query(api.trades.getTrades, {}).catch(() => []);

	let filtered: any[] = allTrades.map((t: any) => ({ ...t, id: t._id }));

	if (coin)
		filtered = filtered.filter((t: any) => t.coin?.toLowerCase().includes(coin.toLowerCase()));
	if (position !== 'all') filtered = filtered.filter((t: any) => t.position === position);
	if (strategy)
		filtered = filtered.filter((t: any) =>
			t.strategy?.toLowerCase().includes(strategy.toLowerCase())
		);
	if (source !== 'all')
		filtered = filtered.filter(
			(t: any) => t.source === (source === 'imported' ? 'futures_import' : 'manual')
		);
	if (dateFrom) filtered = filtered.filter((t: any) => t.date >= dateFrom);
	if (dateTo) filtered = filtered.filter((t: any) => t.date <= dateTo);
	if (result === 'win') filtered = filtered.filter((t: any) => t.win === true);
	if (result === 'loss') filtered = filtered.filter((t: any) => t.loss === true);
	if (result === 'be') filtered = filtered.filter((t: any) => t.be === true);

	const total = filtered.length;
	const offset = (page - 1) * limit;
	const trades = filtered.slice(offset, offset + limit);

	return {
		trades,
		total,
		page,
		filters: { coin, position, result, strategy, source, dateFrom, dateTo }
	};
};

export const actions: Actions = {
	add: async ({ locals: { convex }, request }) => {
		const form = await request.formData();
		const coin = ((form.get('coin') as string) || '').trim().toUpperCase();
		if (!coin) return fail(400, { error: 'Coin is required.' });
		const position = (form.get('position') as string) || 'Long';
		const date = (form.get('date') as string) || new Date().toISOString().split('T')[0];
		const time = (form.get('time') as string) || undefined;
		const entry_price = form.get('entry_price') ? Number(form.get('entry_price')) : undefined;
		const exit_price = form.get('exit_price') ? Number(form.get('exit_price')) : undefined;
		const stop_loss = form.get('stop_loss') ? Number(form.get('stop_loss')) : undefined;
		const quantity = form.get('quantity') ? Number(form.get('quantity')) : undefined;
		const pnl = form.get('pnl') ? Number(form.get('pnl')) : undefined;
		const fee = form.get('fee') ? Number(form.get('fee')) : undefined;
		const date_closed = (form.get('date_closed') as string) || undefined;
		const closed_reason = (form.get('closed_reason') as string) || undefined;
		const duration = (form.get('duration') as string) || undefined;
		const strategy = (form.get('strategy') as string) || undefined;
		const leverage = (form.get('leverage') as string) || undefined;
		const confidence = form.get('confidence') ? Number(form.get('confidence')) : undefined;
		const risk_pct = form.get('risk_pct') ? Number(form.get('risk_pct')) : undefined;
		const range_pct = form.get('range_pct') ? Number(form.get('range_pct')) : undefined;
		const limit_type = (form.get('limit_type') as string) || undefined;
		const reason = (form.get('reason') as string) || undefined;
		const pre_notes = (form.get('pre_notes') as string) || undefined;
		const post_notes = (form.get('post_notes') as string) || undefined;
		const timeframes = form.getAll('timeframes') as string[];

		const win = pnl !== undefined ? pnl > 0 : undefined;
		const loss = pnl !== undefined ? pnl < 0 : undefined;
		const be = pnl !== undefined ? pnl === 0 : undefined;

		try {
			await convex.mutation(api.trades.createTrade, {
				coin,
				position,
				date,
				time,
				entry_price,
				exit_price,
				stop_loss,
				quantity,
				pnl,
				fee,
				date_closed,
				closed_reason,
				duration,
				strategy,
				timeframes: timeframes.length > 0 ? timeframes : undefined,
				leverage,
				confidence,
				risk_pct,
				range_pct,
				limit_type,
				reason,
				pre_notes,
				post_notes,
				win,
				loss,
				be,
				source: 'manual',
				liquidated: form.get('liquidated') === 'on'
			});
			return { success: true };
		} catch (err: any) {
			return fail(500, { error: err.message || 'Failed to add trade.' });
		}
	},

	quickUpdate: async ({ locals: { convex }, request }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		if (!id) return fail(400, { error: 'Missing trade id.' });

		const updates: Record<string, any> = {};
		const numFields = [
			'entry_price',
			'exit_price',
			'stop_loss',
			'quantity',
			'pnl',
			'fee',
			'confidence',
			'risk_pct',
			'range_pct'
		];
		const textFields = [
			'coin',
			'position',
			'date',
			'time',
			'date_closed',
			'duration',
			'strategy',
			'leverage',
			'limit_type',
			'reason',
			'pre_notes',
			'post_notes',
			'closed_reason'
		];
		for (const field of [...numFields, ...textFields]) {
			const val = form.get(field);
			if (val !== null) {
				const value = String(val).trim();
				updates[field] =
					value === '' && !['coin', 'position', 'date'].includes(field)
						? null
						: numFields.includes(field)
							? Number(value)
							: value;
			}
		}
		if (form.has('liquidated_present')) updates.liquidated = form.get('liquidated') === 'on';
		if (updates.coin) updates.coin = updates.coin.toUpperCase();

		const tf = form.getAll('timeframes');
		if (form.has('timeframes_present')) updates.timeframes = tf as string[];

		if (typeof updates.pnl === 'number') {
			updates.win = updates.pnl > 0;
			updates.loss = updates.pnl < 0;
			updates.be = updates.pnl === 0;
		}

		try {
			await convex.mutation(api.trades.updateTrade, { id: id as any, ...updates });
			return { success: true };
		} catch (err: any) {
			return fail(500, { error: err.message || 'Failed to update trade.' });
		}
	},

	delete: async ({ locals: { convex }, request }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		if (!id) return fail(400, { error: 'Missing trade id.' });

		try {
			await convex.mutation(api.trades.deleteTrade, { id: id as any });
			return { success: true };
		} catch (err: any) {
			return fail(500, { error: err.message || 'Failed to delete trade.' });
		}
	}
};
