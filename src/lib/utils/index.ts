import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const formatCurrency = (val: number | null | undefined, decimals = 2): string =>
  val == null ? '—' : `${val >= 0 ? '+' : '-'}$${Math.abs(val).toFixed(decimals)}`;

export const formatDate = (date: string | Date | null | undefined): string =>
  date ? new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

export const getPnlClass = (pnl: number | null | undefined): string =>
  pnl ? (pnl > 0 ? 'text-[var(--win)]' : 'text-[var(--loss)]') : 'text-[var(--text-muted)]';

export type Period = 'day' | 'week' | 'month' | 'custom';

/** Start/end (YYYY-MM-DD, local time) of the day/week(Mon-start)/month containing `ref`. */
export const periodRange = (period: Period, ref = new Date()): { from: string; to: string } => {
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const end = new Date(start);
  if (period === 'week') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    end.setTime(start.getTime());
    end.setDate(start.getDate() + 6);
  } else if (period === 'month') {
    start.setDate(1);
    end.setTime(new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getTime());
  }
  return { from: iso(start), to: iso(end) };
};
