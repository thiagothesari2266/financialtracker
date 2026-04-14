import type { Prisma } from '@prisma/client';
import type { Transaction } from '@shared/schema';

export const DATE_ONLY_LENGTH = 10;
export const INVOICE_CATEGORY_NAME = 'Faturas de Cartão';
export const INVOICE_CATEGORY_COLOR = '#f87171';
export const INVOICE_CATEGORY_ICON = 'CreditCard';

export const ensureDateString = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, DATE_ONLY_LENGTH);
};

export const ensureDateTimeString = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
};

export const decimalToString = (value: Prisma.Decimal | string | number | null | undefined): string => {
  if (value === null || value === undefined) {
    return '0.00';
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed.toFixed(2) : value;
  }
  if (typeof value === 'number') {
    return value.toFixed(2);
  }
  const parsed = Number.parseFloat(value.toString());
  return Number.isFinite(parsed) ? parsed.toFixed(2) : value.toString();
};

export const parseDateInput = (value: string): Date => {
  if (value.includes('T')) {
    return new Date(value);
  }
  return new Date(`${value}T00:00:00.000Z`);
};

export const addMonthsPreserveDay = (date: Date, months: number): Date => {
  // Usa métodos UTC para evitar problemas de timezone
  // As datas no banco são armazenadas como UTC (T00:00:00.000Z)
  const originalDay = date.getUTCDate();
  const newDate = new Date(date);

  // Primeiro, define o dia para 1 para evitar overflow ao mudar o mês
  // (ex: 31 de Janeiro + 1 mês sem isso viraria 3 de Março)
  newDate.setUTCDate(1);
  newDate.setUTCMonth(newDate.getUTCMonth() + months);

  // Calcula o último dia do mês de destino usando UTC
  const lastDayOfMonth = new Date(Date.UTC(newDate.getUTCFullYear(), newDate.getUTCMonth() + 1, 0)).getUTCDate();

  // Define o dia como o mínimo entre o dia original e o último dia do mês
  newDate.setUTCDate(Math.min(originalDay, lastDayOfMonth));

  return newDate;
};

export const calculateInvoiceMonth = (date: Date, closingDay: number): string => {
  const day = date.getUTCDate();
  let month = date.getUTCMonth() + 1; // 1-12
  let year = date.getUTCFullYear();

  if (closingDay >= 25) {
    if (day <= closingDay) {
      month += 1;
    } else {
      month += 2;
    }
  } else {
    if (day > closingDay) {
      month += 1;
    }
  }

  if (month > 12) {
    month -= 12;
    year += 1;
  }

  return `${year}-${String(month).padStart(2, '0')}`;
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

export const differenceInDays = (to: Date, from: Date): number => {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
};

export const computeInvoiceDueDate = (invoiceMonth: string, dueDay: number): Date => {
  const [yearStr, monthStr] = invoiceMonth.split('-');
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10); // 1-12
  const dueDate = new Date(Date.UTC(year, month - 1, dueDay));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (dueDay > lastDay) {
    dueDate.setUTCDate(lastDay);
  }
  return dueDate;
};

export const formatInvoiceDescription = (cardName: string, invoiceMonth: string): string => {
  const [yearStr, monthStr] = invoiceMonth.split('-');
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10) - 1;
  const formatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
  const formatted = formatter.format(new Date(Date.UTC(year, month, 1)));
  return `Fatura ${cardName} - ${formatted}`;
};

export const sumTransactions = (transactions: Transaction[], type: 'income' | 'expense'): number => {
  return transactions
    .filter((t) => t.type === type)
    .reduce((acc, t) => acc + Number.parseFloat(t.amount), 0);
};
