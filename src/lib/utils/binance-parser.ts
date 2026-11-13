export interface FuturesTrade {
	coin: string;
	position: 'Long' | 'Short';
	entry_price: number | null;
	exit_price: number | null;
	quantity: number | null;
	pnl: number;
	liquidated?: boolean;
	fee?: number | null;
	date: string; // YYYY-MM-DD
	time: string; // HH:mm:ss
	date_closed: string; // YYYY-MM-DD
	time_closed?: string;
	win: boolean;
	loss: boolean;
	be: boolean;
	order_id: string;
	source: 'futures_import';
}

export function parseBinanceDate(raw: string): { date: string; time: string } {
	// Input: "25-12-31 13:40:14" or "2026-01-02 08:48:21"
	// Output: { date: "2025-12-31", time: "13:40:14" }
	const [datePart, timePart] = raw.trim().split(' ');
	const [yy, mm, dd] = datePart.split('-');
	const fullYear = yy.length === 2 ? `20${yy}` : yy;
	return { date: `${fullYear}-${mm}-${dd}`, time: timePart ?? '00:00:00' };
}
