import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | null | undefined, decimals = 2): string {
  if (value == null) return '—';
  return value >= 0
    ? `+$${value.toFixed(decimals)}`
    : `-$${Math.abs(value).toFixed(decimals)}`;
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

export function getPnlClass(pnl: number | null | undefined): string {
  if (pnl == null) return 'text-[var(--text-muted)]';
  if (pnl > 0) return 'text-[var(--win)]';
  if (pnl < 0) return 'text-[var(--loss)]';
  return 'text-[var(--text-muted)]';
}
