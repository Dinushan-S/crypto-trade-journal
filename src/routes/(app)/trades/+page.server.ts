import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase }, url }) => {
  const coin = url.searchParams.get('coin') ?? '';
  const position = url.searchParams.get('position') ?? 'all';
  const result = url.searchParams.get('result') ?? 'all';
  const strategy = url.searchParams.get('strategy') ?? '';
  const source = url.searchParams.get('source') ?? 'all';
  const dateFrom = url.searchParams.get('dateFrom') ?? '';
  const dateTo = url.searchParams.get('dateTo') ?? '';
  const page = parseInt(url.searchParams.get('page') ?? '1');
  const limit = 50;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('trades')
    .select('*', { count: 'exact' })
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (coin) query = query.ilike('coin', `%${coin}%`);
  if (position !== 'all') query = query.eq('position', position);
  if (strategy) query = query.ilike('strategy', `%${strategy}%`);
  if (source !== 'all') query = query.eq('source', source === 'imported' ? 'futures_import' : 'manual');
  if (dateFrom) query = query.gte('date', dateFrom);
  if (dateTo) query = query.lte('date', dateTo);
  if (result === 'win') query = query.eq('win', true);
  if (result === 'loss') query = query.eq('loss', true);
  if (result === 'be') query = query.eq('be', true);

  const { data: trades, count, error } = await query;

  return {
    trades: trades ?? [],
    total: count ?? 0,
    page,
    filters: { coin, position, result, strategy, source, dateFrom, dateTo }
  };
};
