import Papa from 'papaparse';
import { parseBinanceDate as parseTHDate, type FuturesTrade } from './binance-parser';

export interface TradeHistoryTrade extends FuturesTrade {
  fee: number;
}



function parseFee(feeStr: string): number {
  // "0.08825600USDT" → 0.088256
  return parseFloat(feeStr.replace(/[A-Za-z]+$/, '').trim()) || 0;
}

export function parseTradeHistoryCSV(csvText: string): TradeHistoryTrade[] {
  const cleaned = csvText.replace(/^﻿/, '');

  const result = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    skipEmptyLines: true,
  });

  const rows = result.data;
  if (rows.length === 0) throw new Error('The CSV file appears to be empty.');

  const headers = Object.keys(rows[0]).map(h => h.trim());
  if (!headers.includes('Realized Profit') && !headers.includes('Order ID')) {
    throw new Error(`Not a Trade History CSV. Columns found: ${headers.join(', ')}`);
  }

  // Group fills by Order ID
  const orderMap = new Map<string, typeof rows>();
  for (const row of rows) {
    const orderId = row['Order ID']?.trim();
    if (!orderId) continue;
    if (!orderMap.has(orderId)) orderMap.set(orderId, []);
    orderMap.get(orderId)!.push(row);
  }

  const trades: TradeHistoryTrade[] = [];

  for (const [orderId, fills] of orderMap) {
    // Sum realized profit; skip opening orders (RP == 0)
    const totalRP = fills.reduce((s, r) => s + (parseFloat(r['Realized Profit'] ?? '0') || 0), 0);
    if (Math.abs(totalRP) < 0.000001) continue;

    const symbol = fills[0]['Symbol']?.trim() ?? '';
    const coin = symbol.endsWith('USDT') ? symbol.slice(0, -4)
                : symbol.endsWith('BUSD') ? symbol.slice(0, -4)
                : symbol;

    // Closing side determines position direction:
    // SELL to close → was Long; BUY to close → was Short
    const closingSide = fills[0]['Side']?.trim().toUpperCase();
    const position: 'Long' | 'Short' = closingSide === 'SELL' ? 'Long' : 'Short';

    // Weighted average exit price
    let totalQty = 0;
    let weightedPrice = 0;
    for (const f of fills) {
      const qty = parseFloat(f['Quantity'] ?? '0') || 0;
      const price = parseFloat(f['Price'] ?? '0') || 0;
      totalQty += qty;
      weightedPrice += price * qty;
    }
    const exit_price = totalQty > 0 ? weightedPrice / totalQty : null;

    // Total fees
    const fee = fills.reduce((s, r) => s + parseFee(r['Fee'] ?? '0'), 0);

    // Latest fill time = close date (CSV is sorted newest-first, but find max to be safe)
    const latestFill = fills.reduce((latest, f) =>
      (f['Time'] ?? '') > (latest['Time'] ?? '') ? f : latest, fills[0]);
    const { date: date_closed, time } = parseTHDate(latestFill['Time'] ?? '');

    // Round to avoid floating-point noise
    const pnl = Math.round(totalRP * 1e8) / 1e8;

    trades.push({
      coin,
      position,
      entry_price: null,
      exit_price,
      quantity: totalQty || null,
      pnl,
      date: date_closed,
      time,
      date_closed,
      fee,
      win: pnl > 0,
      loss: pnl < 0,
      be: pnl === 0,
      order_id: `${symbol}::${orderId}`,
      source: 'futures_import',
    });
  }

  return trades;
}
