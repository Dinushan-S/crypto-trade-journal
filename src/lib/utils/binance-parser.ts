import Papa from 'papaparse';

export interface FuturesTrade {
  coin: string;
  position: 'Long' | 'Short';
  entry_price: number | null;
  exit_price: number | null;
  quantity: number | null;
  pnl: number;
  fee?: number | null;
  date: string;        // YYYY-MM-DD
  time: string;        // HH:mm:ss
  date_closed: string; // YYYY-MM-DD
  win: boolean;
  loss: boolean;
  be: boolean;
  order_id: string;
  source: 'futures_import';
}

function parseBinanceDate(raw: string): { date: string; time: string } {
  // Input: "25-12-31 13:40:14" or "26-01-02 08:48:21"
  // Output: { date: "2025-12-31", time: "13:40:14" }
  const [datePart, timePart] = raw.trim().split(' ');
  const [yy, mm, dd] = datePart.split('-');
  const fullYear = parseInt(yy) >= 0 ? `20${yy}` : yy;
  return { date: `${fullYear}-${mm}-${dd}`, time: timePart ?? '00:00:00' };
}

export function parseFuturesCSV(csvText: string): FuturesTrade[] {
  // Strip UTF-8 BOM that Binance includes in exported CSVs
  const cleaned = csvText.replace(/^﻿/, '');

  const result = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    skipEmptyLines: true,
  });

  const rows = result.data;

  if (rows.length === 0) {
    throw new Error('The CSV file appears to be empty.');
  }

  // Normalise headers to handle BOM remnants or extra whitespace
  const headers = Object.keys(rows[0]).map(h => h.trim());
  const statusValues = [...new Set(rows.map(r => r['Status']?.trim()).filter(Boolean))];

  const closed = rows.filter(row => row['Status']?.trim().toLowerCase() === 'closed');

  if (closed.length === 0) {
    const hint = statusValues.length
      ? `Status values found: ${statusValues.slice(0, 5).join(', ')}`
      : `Columns found: ${headers.join(', ')}`;
    throw new Error(`No closed positions found in this CSV. ${hint}`);
  }

  return closed
    .map(row => {
      const symbol = row['Symbol']?.trim() ?? '';
      const coin = symbol.endsWith('USDT') ? symbol.slice(0, -4) : symbol;
      const rawOpened = row['Opened']?.trim() ?? '';
      const rawClosed = row['Closed']?.trim() ?? '';
      const { date, time } = parseBinanceDate(rawOpened);
      const { date: date_closed } = parseBinanceDate(rawClosed);
      const pnl = parseFloat(row['Closing PNL'] ?? '0') || 0;

      return {
        coin,
        position: (row['Position Side']?.trim() === 'Short' ? 'Short' : 'Long') as 'Long' | 'Short',
        entry_price: parseFloat(row['Entry Price'] ?? '') || null,
        exit_price: parseFloat(row['Avg. Close Price'] ?? '') || null,
        quantity: parseFloat(row['Closed Vol.'] ?? '') || null,
        pnl,
        date,
        time,
        date_closed,
        win: pnl > 0,
        loss: pnl < 0,
        be: pnl === 0,
        order_id: `${symbol}::${rawOpened}`,
        source: 'futures_import' as const,
      };
    });
}
