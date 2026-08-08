import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const formatCurrency = (val: number | null | undefined, decimals = 2): string =>
  val == null ? '—' : `${val >= 0 ? '+' : '-'}$${Math.abs(val).toFixed(decimals)}`;

export const formatDate = (date: string | Date | null | undefined): string =>
  date ? new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

export const getPnlClass = (pnl: number | null | undefined): string =>
  pnl ? (pnl > 0 ? 'text-[var(--win)]' : 'text-[var(--loss)]') : 'text-[var(--text-muted)]';
