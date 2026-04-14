import { prisma } from '../db';
import { mapCostCenter } from './mappers';
import type {
  CostCenter,
  CostCenterWithStats,
  InsertCostCenter,
} from '@shared/schema';

export async function createCostCenter(insertCostCenter: InsertCostCenter): Promise<CostCenter> {
  const costCenter = await prisma.costCenter.create({
    data: {
      ...insertCostCenter,
      budget: insertCostCenter.budget ?? null,
    },
  });
  return mapCostCenter(costCenter);
}

export async function getCostCenters(accountId: number): Promise<CostCenter[]> {
  const centers = await prisma.costCenter.findMany({
    where: { accountId },
    orderBy: [{ name: 'asc' }],
  });
  return centers.map(mapCostCenter);
}

export async function getCostCenter(id: number): Promise<CostCenter | undefined> {
  const center = await prisma.costCenter.findUnique({
    where: { id },
  });
  return center ? mapCostCenter(center) : undefined;
}

export async function updateCostCenter(
  id: number,
  costCenter: Partial<InsertCostCenter>
): Promise<CostCenter | undefined> {
  const updated = await prisma.costCenter.update({
    where: { id },
    data: {
      ...costCenter,
      budget: costCenter.budget ?? undefined,
    },
  });
  return mapCostCenter(updated);
}

export async function deleteCostCenter(id: number): Promise<void> {
  await prisma.costCenter.delete({ where: { id } });
}

export async function getCostCenterStats(costCenterId: number): Promise<CostCenterWithStats | undefined> {
  const costCenter = await getCostCenter(costCenterId);
  if (!costCenter) return undefined;

  const expenses = await prisma.transaction.findMany({
    where: {
      accountId: costCenter.accountId,
      type: 'expense',
      costCenter: costCenter.code,
    },
    select: { amount: true },
  });

  const totalExpenses = expenses.reduce(
    (acc, tx) => acc + Number.parseFloat(tx.amount.toString()),
    0
  );
  const budget = costCenter.budget ? Number.parseFloat(costCenter.budget) : 0;
  const budgetUsed = budget > 0 ? ((totalExpenses / budget) * 100).toFixed(2) : '0';
  const remainingBudget = (budget - totalExpenses).toFixed(2);

  return {
    ...costCenter,
    totalExpenses: totalExpenses.toFixed(2),
    budgetUsed,
    remainingBudget,
    transactionCount: expenses.length,
  };
}
