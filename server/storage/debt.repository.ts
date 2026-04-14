import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { mapDebt } from './mappers';
import { parseDateInput } from './utils';
import type { Debt, InsertDebt } from '@shared/schema';

export async function createDebt(insertDebt: InsertDebt): Promise<Debt> {
  const created = await prisma.debt.create({
    data: {
      accountId: insertDebt.accountId,
      name: insertDebt.name,
      type: insertDebt.type ?? null,
      balance: insertDebt.balance,
      interestRate: insertDebt.interestRate,
      ratePeriod: insertDebt.ratePeriod ?? 'monthly',
      targetDate: insertDebt.targetDate ? parseDateInput(insertDebt.targetDate) : null,
      notes: insertDebt.notes ?? null,
    },
  });

  return mapDebt(created);
}

export async function getDebts(accountId: number): Promise<Debt[]> {
  const debts = await prisma.debt.findMany({
    where: { accountId },
    orderBy: [{ targetDate: 'asc' }, { createdAt: 'desc' }],
  });

  return debts.map(mapDebt);
}

export async function getDebt(id: number): Promise<Debt | undefined> {
  const debt = await prisma.debt.findUnique({ where: { id } });
  return debt ? mapDebt(debt) : undefined;
}

export async function updateDebt(id: number, debt: Partial<InsertDebt>): Promise<Debt | undefined> {
  try {
    const updated = await prisma.debt.update({
      where: { id },
      data: {
        name: debt.name ?? undefined,
        type: debt.type === undefined ? undefined : (debt.type ?? null),
        balance: debt.balance ?? undefined,
        interestRate: debt.interestRate ?? undefined,
        ratePeriod: debt.ratePeriod ?? undefined,
        targetDate:
          debt.targetDate === undefined
            ? undefined
            : debt.targetDate
              ? parseDateInput(debt.targetDate)
              : null,
        notes: debt.notes === undefined ? undefined : (debt.notes ?? null),
      },
    });

    return mapDebt(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return undefined;
    }
    throw error;
  }
}

export async function deleteDebt(id: number): Promise<void> {
  await prisma.debt.delete({ where: { id } });
}
