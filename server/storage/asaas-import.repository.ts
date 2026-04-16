import { prisma } from '../db';
import { mapAsaasImport, mapTransaction } from './mappers';
import type { AsaasImport, AsaasImportWithTransactions, InsertAsaasImport } from '@shared/schema';

export async function createAsaasImport(data: InsertAsaasImport): Promise<AsaasImport> {
  const record = await prisma.asaasImport.upsert({
    where: { asaasPaymentId: data.asaasPaymentId },
    create: {
      accountId: data.accountId,
      bankAccountId: data.bankAccountId ?? null,
      asaasPaymentId: data.asaasPaymentId,
      event: data.event,
      status: data.status ?? 'pending',
      amount: data.amount,
      dueDate: new Date(`${data.dueDate}T00:00:00.000Z`),
      paymentDate: data.paymentDate ? new Date(`${data.paymentDate}T00:00:00.000Z`) : null,
      description: data.description ?? null,
      externalReference: data.externalReference ?? null,
      billingType: data.billingType ?? null,
      isPaid: data.isPaid ?? false,
      suggestedTransactionId: data.suggestedTransactionId ?? null,
      matchedTransactionId: data.matchedTransactionId ?? null,
      matchScore: data.matchScore ?? null,
      rawPayload: data.rawPayload as object,
      resolvedAt: data.resolvedAt ? new Date(data.resolvedAt) : null,
    },
    update: {
      event: data.event,
      isPaid: data.isPaid ?? false,
      paymentDate: data.paymentDate ? new Date(`${data.paymentDate}T00:00:00.000Z`) : null,
    },
  });
  return mapAsaasImport(record);
}

export async function getAsaasImports(
  accountId: number,
  status?: string
): Promise<AsaasImportWithTransactions[]> {
  const records = await prisma.asaasImport.findMany({
    where: {
      accountId,
      ...(status ? { status } : {}),
    },
    include: {
      suggestedTransaction: {
        include: { category: true },
      },
      matchedTransaction: {
        include: { category: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return records.map((record) => ({
    ...mapAsaasImport(record),
    suggestedTransaction: record.suggestedTransaction
      ? mapTransaction(record.suggestedTransaction, record.suggestedTransaction.category)
      : null,
    matchedTransaction: record.matchedTransaction
      ? mapTransaction(record.matchedTransaction, record.matchedTransaction.category)
      : null,
  }));
}

export async function getAsaasImportById(
  id: number
): Promise<AsaasImportWithTransactions | undefined> {
  const record = await prisma.asaasImport.findUnique({
    where: { id },
    include: {
      suggestedTransaction: {
        include: { category: true },
      },
      matchedTransaction: {
        include: { category: true },
      },
    },
  });

  if (!record) return undefined;

  return {
    ...mapAsaasImport(record),
    suggestedTransaction: record.suggestedTransaction
      ? mapTransaction(record.suggestedTransaction, record.suggestedTransaction.category)
      : null,
    matchedTransaction: record.matchedTransaction
      ? mapTransaction(record.matchedTransaction, record.matchedTransaction.category)
      : null,
  };
}

export async function updateAsaasImport(
  id: number,
  data: Partial<InsertAsaasImport> & { resolvedAt?: string | null }
): Promise<AsaasImport | undefined> {
  const updated = await prisma.asaasImport.update({
    where: { id },
    data: {
      ...(data.event !== undefined ? { event: data.event } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.isPaid !== undefined ? { isPaid: data.isPaid } : {}),
      ...(data.suggestedTransactionId !== undefined
        ? { suggestedTransactionId: data.suggestedTransactionId }
        : {}),
      ...(data.matchedTransactionId !== undefined
        ? { matchedTransactionId: data.matchedTransactionId }
        : {}),
      ...(data.matchScore !== undefined ? { matchScore: data.matchScore } : {}),
      ...(data.paymentDate !== undefined
        ? {
            paymentDate: data.paymentDate
              ? new Date(`${data.paymentDate}T00:00:00.000Z`)
              : null,
          }
        : {}),
      ...(data.resolvedAt !== undefined
        ? { resolvedAt: data.resolvedAt ? new Date(data.resolvedAt) : null }
        : {}),
    },
  });
  return updated ? mapAsaasImport(updated) : undefined;
}

export async function findAsaasImportByPaymentId(
  asaasPaymentId: string
): Promise<AsaasImport | undefined> {
  const record = await prisma.asaasImport.findUnique({
    where: { asaasPaymentId },
  });
  return record ? mapAsaasImport(record) : undefined;
}
