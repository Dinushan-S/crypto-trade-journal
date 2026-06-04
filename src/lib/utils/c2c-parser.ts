import Papa from 'papaparse';

export interface C2CEntry {
  type: 'deposit' | 'withdrawal';
  date: string;
  time: string;
  fiat_sent: number | null;
  usd_rate: number | null;
  usd_received: number | null;
  usd_quantity: number | null;
  counterparty: string | null;
  order_number: string;
  notes: string | null;
  source: 'c2c_import';
}

function parseBinanceDate(raw: string): { date: string; time: string } {
  const [datePart, timePart] = raw.trim().split(' ');
  const [yy, mm, dd] = datePart.split('-');
  return { date: `20${yy}-${mm}-${dd}`, time: timePart ?? '00:00:00' };
}

export function parseC2CCSV(csvText: string): C2CEntry[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  return result.data
    .filter(row => row['Status']?.trim() === 'Completed')
    .map(row => {
      const orderType = row['Order Type']?.trim();
      const type = orderType === 'Sell' ? 'withdrawal' : 'deposit';
      const qty = parseFloat(row['Quantity'] ?? '') || null;
      const { date, time } = parseBinanceDate(row['Created Time']?.trim() ?? '');

      return {
        type: type as 'deposit' | 'withdrawal',
        date,
        time,
        fiat_sent: parseFloat(row['Total Price'] ?? '') || null,
        usd_rate: parseFloat(row['Price'] ?? '') || null,
        usd_received: type === 'deposit' ? qty : null,
        usd_quantity: type === 'withdrawal' ? qty : null,
        counterparty: row['Counterparty']?.trim() || null,
        order_number: row['Order Number']?.trim() ?? '',
        notes: null,
        source: 'c2c_import' as const,
      };
    });
}
