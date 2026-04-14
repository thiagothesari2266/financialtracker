import { prisma } from '../db';
import { mapBankAccount, mapTransaction } from './mappers';
import type { BankAccount, InsertBankAccount, TransactionWithCategory } from '@shared/schema';

export async function createBankAccount(insertBankAccount: InsertBankAccount): Promise<BankAccount> {
  const created = await prisma.bankAccount.create({
    data: insertBankAccount,
  });
  return mapBankAccount(created);
}

export async function getBankAccounts(accountId: number, userId: number): Promise<BankAccount[]> {
  // Buscar todos os accountIds do mesmo usuário
  const userAccounts = await prisma.account.findMany({
    where: { userId },
    select: { id: true },
  });
  const userAccountIds = userAccounts.map(a => a.id);

  // Buscar contas bancárias: próprias OU compartilhadas do mesmo usuário
  const accounts = await prisma.bankAccount.findMany({
    where: {
      OR: [
        { accountId },
        { shared: true, accountId: { in: userAccountIds } },
      ],
    },
    orderBy: { name: 'asc' },
  });
  return accounts.map(mapBankAccount);
}

export async function getBankAccount(id: number): Promise<BankAccount | undefined> {
  const bankAccount = await prisma.bankAccount.findUnique({
    where: { id },
  });
  return bankAccount ? mapBankAccount(bankAccount) : undefined;
}

export async function updateBankAccount(
  id: number,
  bankAccount: Partial<InsertBankAccount>
): Promise<BankAccount | undefined> {
  const updated = await prisma.bankAccount.update({
    where: { id },
    data: bankAccount,
  });
  return updated ? mapBankAccount(updated) : undefined;
}

export async function deleteBankAccount(id: number): Promise<void> {
  await prisma.bankAccount.delete({ where: { id } });
}

export async function getBankAccountByWebhookToken(token: string): Promise<BankAccount | undefined> {
  const ba = await prisma.bankAccount.findFirst({ where: { asaasWebhookToken: token } });
  return ba ? mapBankAccount(ba) : undefined;
}

export async function findTransactionByExternalId(externalId: string, accountId: number): Promise<TransactionWithCategory | undefined> {
  const tx = await prisma.transaction.findFirst({
    where: { externalId, accountId },
    include: { category: true },
  });
  return tx ? mapTransaction(tx, tx.category) : undefined;
}
