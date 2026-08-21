import type { PageServerLoad } from './$types';
import { api } from '../../../../convex/_generated/api';

export const load: PageServerLoad = async ({ locals: { convex }, url }) => {
  const tradeIdsStr = url.searchParams.get('tradeIds') ?? '';
  const tradeIds = tradeIdsStr.length > 0 ? tradeIdsStr.split(',').filter(Boolean) : [];

  // If no tradeIds, return empty defaults for standalone mode
  if (tradeIds.length === 0) {
    return {
      tradeIds: [],
      prefill: null,
    };
  }

  // Fetch selected trades and compute prefilled values
  let dates = [...new Set<string>()];
  let coins = new Set<string>();
  let positions = new Set<string>();
  let strategies = new Set<string>();
  let netPnl = 0;
  let fees = 0;

  for (const id of tradeIds) {
    const trade: any = await convex.query(api.trades.getTradeById, { id }).catch(() => null);
    if (!trade) continue;
    if (trade.date) dates.add(trade.date);
    if (trade.coin) coins.add(trade.coin);
    if (trade.position) positions.add(trade.position);
    if (trade.strategy) strategies.add(trade.strategy);
    netPnl += trade.pnl ?? 0;
    fees += trade.fee ?? 0;
  }

  // Sort dates descending — latest date becomes default
  const sortedDates = [...dates].sort((a, b) => (b < a ? 1 : -1));
  const latestDate = sortedDates[0] || '';
  const uniqueCoin = coins.size === 1 ? Array.from(coins)[0] : undefined;
  const uniquePosition = positions.size === 1 ? Array.from(positions)[0] : undefined;
  const uniqueStrategy = strategies.size === 1 ? Array.from(strategies)[0] : undefined;
  const amountLost = Math.max(0, -netPnl);

  return {
    tradeIds,
    prefill: {
      date: latestDate,
      coin: uniqueCoin,
      position: uniquePosition,
      strategy: uniqueStrategy,
      amount_lost: amountLost,
      count: tradeIds.length,
    },
  };
};
