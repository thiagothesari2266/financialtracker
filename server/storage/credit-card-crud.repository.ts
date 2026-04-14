import { prisma } from '../db';
import { mapCreditCard } from './mappers';
import { updateAllInvoiceTransactions } from './credit-card-invoice.repository';
import type { CreditCard, InsertCreditCard } from '@shared/schema';

export async function createCreditCard(insertCreditCard: InsertCreditCard): Promise<CreditCard> {
  const created = await prisma.creditCard.create({
    data: insertCreditCard as any,
  });
  return mapCreditCard(created);
}

export async function getCreditCards(accountId: number, userId: number): Promise<CreditCard[]> {
  const userAccounts = await prisma.account.findMany({
    where: { userId },
    select: { id: true },
  });
  const userAccountIds = userAccounts.map((a) => a.id);

  const cards = await prisma.creditCard.findMany({
    where: {
      OR: [
        { accountId },
        { shared: true, accountId: { in: userAccountIds } },
      ],
    },
    orderBy: { name: 'asc' },
  });
  return cards.map(mapCreditCard);
}

export async function getCreditCard(id: number): Promise<CreditCard | undefined> {
  const card = await prisma.creditCard.findUnique({
    where: { id },
  });
  return card ? mapCreditCard(card) : undefined;
}

export async function updateCreditCard(
  id: number,
  creditCard: Partial<InsertCreditCard>
): Promise<CreditCard | undefined> {
  const updated = await prisma.creditCard.update({
    where: { id },
    data: creditCard,
  });
  return updated ? mapCreditCard(updated) : undefined;
}

export async function deleteCreditCard(id: number): Promise<void> {
  const card = await prisma.creditCard.findUnique({ where: { id } });
  if (!card) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.creditCardTransaction.deleteMany({
      where: { creditCardId: id },
    });

    await tx.transaction.updateMany({
      where: { creditCardId: id },
      data: { creditCardId: null, creditCardInvoiceId: null },
    });

    await tx.invoicePayment.deleteMany({
      where: { creditCardId: id },
    });

    await tx.creditCard.delete({
      where: { id },
    });
  });

  await updateAllInvoiceTransactions(card.accountId);
}
