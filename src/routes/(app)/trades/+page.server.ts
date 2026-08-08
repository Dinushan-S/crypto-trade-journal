import type { PageServerLoad } from './$types';
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

  if (coin) filtered = filtered.filter((t: any) => t.coin?.toLowerCase().includes(coin.toLowerCase()));
  if (position !== 'all') filtered = filtered.filter((t: any) => t.position === position);
  if (strategy) filtered = filtered.filter((t: any) => t.strategy?.toLowerCase().includes(strategy.toLowerCase()));
  if (source !== 'all') filtered = filtered.filter((t: any) => t.source === (source === 'imported' ? 'futures_import' : 'manual'));
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
