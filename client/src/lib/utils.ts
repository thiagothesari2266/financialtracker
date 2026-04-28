import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (value: string | number): string => {
  const numeric = typeof value === 'number' ? value : parseFloat(value);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(numeric) ? numeric : 0);
};

// Formata 'YYYY-MM' ou 'YYYY-MM-DD' → "Abril 2026"
export function formatMonth(monthStr: string): string {
  try {
    const [year, month] = monthStr.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return date
      .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      .replace(/^\w/, (c) => c.toUpperCase());
  } catch {
    return monthStr;
  }
}

// Formata 'YYYY-MM-DD' ou ISO ('YYYY-MM-DDTHH:mm:ss...Z') → "15/04/2026"
// Evita conversao de timezone: extrai a parte calendario direto da string.
export function formatDateBR(dateStr: string): string {
  if (!dateStr) return '';
  const ymd = dateStr.slice(0, 10);
  const [y, m, d] = ymd.split('-');
  if (y && m && d) return `${d}/${m}/${y}`;
  return new Date(dateStr).toLocaleDateString('pt-BR');
}
