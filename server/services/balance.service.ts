import { prisma } from '../db';
import * as BankAccountRepo from '../storage/bank-account.repository';
import type { BankAccount } from '@shared/schema';

export type BankAccountWithBalance = BankAccount & { currentBalance: string };

// Saldo fiel ao registro das transações:
// initialBalance + SUM(paid, bankAccountId, date<=today, excluindo templates de recorrência mensal).
// Mesma regra usada pelo MCP nexfin_saldos.
export async function getBankAccountsWithBalance(
  accountId: number,
  userId: number
): Promise<BankAccountWithBalance[]> {
  const bankAccounts = await BankAccountRepo.getBankAccounts(accountId, userId);

  const aggregates = await prisma.$queryRaw<
    Array<{ bank_account_id: number; type: string; total: string }>
  >`
    SELECT t.bank_account_id, t.type, SUM(t.amount)::text AS total
    FROM transactions t
    WHERE t.account_id = ${accountId}
      AND t.paid = true
      AND t.bank_account_id IS NOT NULL
      AND t.date <= CURRENT_DATE
      AND NOT (
        COALESCE(t.launch_type, '') = 'recorrente'
        AND COALESCE(t.recurrence_frequency, '') = 'mensal'
        AND t.is_exception = false
      )
    GROUP BY t.bank_account_id, t.type
  `;

  const balanceMap = new Map<number, number>();
  for (const row of aggregates) {
    const current = balanceMap.get(row.bank_account_id) || 0;
    const amount = Number(row.total ?? 0);
    balanceMap.set(row.bank_account_id, current + (row.type === 'income' ? amount : -amount));
  }

  return bankAccounts.map((ba) => {
    const txBalance = balanceMap.get(ba.id) || 0;
    const currentBalance = parseFloat(ba.initialBalance || '0') + txBalance;
    return { ...ba, currentBalance: currentBalance.toFixed(2) };
  });
}
