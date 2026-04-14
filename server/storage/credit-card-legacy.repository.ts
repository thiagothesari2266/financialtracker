import { prisma } from '../db';
import { mapTransaction } from './mappers';
import type { TransactionWithCategory } from '@shared/schema';

export async function getLegacyInvoiceTransactions(
  accountId: number
): Promise<TransactionWithCategory[]> {
  const transactions = await prisma.transaction.findMany({
    where: {
      accountId,
      description: {
        contains: 'fatura',
        mode: 'insensitive',
      },
      OR: [{ isInvoiceTransaction: false }, { isInvoiceTransaction: undefined }],
    },
    include: { category: true },
    orderBy: [{ date: 'asc' }],
  });

  return transactions.map((tx) => mapTransaction(tx, (tx as any).category));
}

export async function deleteLegacyInvoiceTransactions(
  accountId: number
): Promise<{ deletedCount: number }> {
  const legacy = await getLegacyInvoiceTransactions(accountId);
  const ids = legacy.map((item) => item.id);
  if (ids.length === 0) {
    return { deletedCount: 0 };
  }

  await prisma.$transaction([
    prisma.invoicePayment.updateMany({
      where: { transactionId: { in: ids } },
      data: { transactionId: null },
    }),
    prisma.transaction.deleteMany({
      where: {
        accountId,
        id: { in: ids },
      },
    }),
  ]);

  return { deletedCount: ids.length };
}
