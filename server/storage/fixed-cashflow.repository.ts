import { prisma } from '../db';
import { decimalToString } from './utils';
import { currentMonthBR } from '../utils/date-br';
import type { MonthlyFixedSummary, MonthlyFixedItem, InsertFixedCashflow } from '@shared/schema';

export async function getMonthlyFixedSummary(accountId: number): Promise<MonthlyFixedSummary> {
  const todayMonth = currentMonthBR();

  const entries = await prisma.fixedCashflow.findMany({
    where: {
      accountId,
      OR: [{ endMonth: null }, { endMonth: { gte: todayMonth } }],
    },
    orderBy: [{ startMonth: 'asc' }, { createdAt: 'asc' }],
  });

  const mapped: MonthlyFixedItem[] = entries
    .filter((entry) => entry.startMonth <= todayMonth)
    .map((entry) => ({
      id: entry.id,
      description: entry.description,
      amount: decimalToString(entry.amount),
      type: entry.type,
      startMonth: entry.startMonth,
      endMonth: entry.endMonth ?? null,
      dueDay: entry.dueDay ?? null,
    }));

  const income = mapped.filter((item) => item.type === 'income');
  const expenses = mapped.filter((item) => item.type === 'expense');
  const incomeTotal = income.reduce((sum, item) => sum + Number.parseFloat(item.amount), 0);
  const expenseTotal = expenses.reduce((sum, item) => sum + Number.parseFloat(item.amount), 0);

  return {
    income,
    expenses,
    totals: {
      income: incomeTotal.toFixed(2),
      expenses: expenseTotal.toFixed(2),
      net: (incomeTotal - expenseTotal).toFixed(2),
    },
  };
}

export async function getFixedCashflow(accountId: number): Promise<MonthlyFixedSummary> {
  return getMonthlyFixedSummary(accountId);
}

export async function createFixedCashflow(entry: InsertFixedCashflow): Promise<MonthlyFixedItem> {
  const todayMonth = currentMonthBR();
  const created = await prisma.fixedCashflow.create({
    data: {
      ...entry,
      startMonth: entry.startMonth ?? todayMonth,
      endMonth: entry.endMonth ?? null,
      dueDay: entry.dueDay ?? null,
    },
  });

  return {
    id: created.id,
    description: created.description,
    amount: decimalToString(created.amount),
    type: created.type,
    startMonth: created.startMonth,
    endMonth: created.endMonth ?? null,
    dueDay: created.dueDay ?? null,
  };
}

export async function updateFixedCashflow(
  id: number,
  entry: Partial<InsertFixedCashflow>
): Promise<MonthlyFixedItem | undefined> {
  const _todayMonth = currentMonthBR();
  const updated = await prisma.fixedCashflow.update({
    where: { id },
    data: {
      ...entry,
      startMonth: entry.startMonth ?? undefined,
      endMonth: entry.endMonth ?? undefined,
      dueDay: entry.dueDay,
    },
  });

  if (!updated) return undefined;

  return {
    id: updated.id,
    description: updated.description,
    amount: decimalToString(updated.amount),
    type: updated.type,
    startMonth: updated.startMonth,
    endMonth: updated.endMonth ?? null,
    dueDay: updated.dueDay ?? null,
  };
}

export async function deleteFixedCashflow(id: number): Promise<void> {
  await prisma.fixedCashflow.delete({ where: { id } });
}
