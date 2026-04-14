import { getAccount } from './account.repository';
import { getCategories } from './category.repository';
import { getTransactionsByDateRange } from './transaction.repository';
import { sumTransactions, DATE_ONLY_LENGTH } from './utils';
import type { AccountWithStats } from '@shared/schema';

export async function getAccountStats(
  accountId: number,
  month: string
): Promise<AccountWithStats | undefined> {
  const account = await getAccount(accountId);
  if (!account) {
    return undefined;
  }

  const [year, monthStr] = month.split('-');
  const monthNumber = Number.parseInt(monthStr, 10) - 1;
  const yearNumber = Number.parseInt(year, 10);
  const startDate = new Date(Date.UTC(yearNumber, monthNumber, 1));
  const endDate = new Date(Date.UTC(yearNumber, monthNumber + 1, 0, 23, 59, 59, 999));

  const startDateStr = `${startDate.toISOString().slice(0, DATE_ONLY_LENGTH)}T00:00:00.000Z`;
  const endDateStr = endDate.toISOString();

  const monthlyTransactions = await getTransactionsByDateRange(
    accountId,
    startDateStr,
    endDateStr
  );

  const paidMonthlyTransactions = monthlyTransactions.filter((transaction) => transaction.paid);

  const monthlyIncome = sumTransactions(paidMonthlyTransactions, 'income');
  const monthlyExpenses = sumTransactions(paidMonthlyTransactions, 'expense');

  // Saldo considera apenas lançamentos pagos no período solicitado
  const balance = paidMonthlyTransactions.reduce((acc, transaction) => {
    const amount = Number.parseFloat(transaction.amount);
    return transaction.type === 'income' ? acc + amount : acc - amount;
  }, 0);

  return {
    ...account,
    totalBalance: balance.toFixed(2),
    monthlyIncome: monthlyIncome.toFixed(2),
    monthlyExpenses: monthlyExpenses.toFixed(2),
    transactionCount: paidMonthlyTransactions.length,
  };
}

export async function getCategoryStats(
  accountId: number,
  month: string
): Promise<Array<{ categoryId: number; categoryName: string; total: string; color: string }>> {
  const categories = await getCategories(accountId);
  if (categories.length === 0) {
    return [];
  }

  const [year, monthStr] = month.split('-');
  const monthNumber = Number.parseInt(monthStr, 10) - 1;
  const yearNumber = Number.parseInt(year, 10);
  const lastDay = new Date(Date.UTC(yearNumber, monthNumber + 1, 0));
  const endDateStr = `${yearNumber}-${String(monthNumber + 1).padStart(2, '0')}-${String(lastDay.getUTCDate()).padStart(2, '0')}`;

  const transactions = await getTransactionsByDateRange(
    accountId,
    `${month}-01`,
    endDateStr
  );
  const totals = new Map<number, number>();

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    const current = totals.get(tx.categoryId) ?? 0;
    totals.set(tx.categoryId, current + Number.parseFloat(tx.amount));
  }

  return categories.map((category) => ({
    categoryId: category.id,
    categoryName: category.name,
    color: category.color,
    total: (totals.get(category.id) ?? 0).toFixed(2),
  }));
}
