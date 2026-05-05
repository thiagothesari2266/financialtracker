import { prisma } from '../db';
import { mapAsaasImport, mapTransaction } from './mappers';
import type { AsaasImport, AsaasImportWithTransactions, InsertAsaasImport } from '@shared/schema';

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function createAsaasImport(data: InsertAsaasImport): Promise<AsaasImport> {
  const entityType = data.asaasEntityType ?? 'payment';
  const direction = data.direction ?? 'income';
  const transactionId = data.asaasTransactionId ?? data.asaasPaymentId ?? null;

  if (!transactionId) {
    throw new Error('createAsaasImport exige asaasTransactionId ou asaasPaymentId');
  }

  const record = await prisma.asaasImport.upsert({
    where: {
      asaas_import_entity_ref: {
        accountId: data.accountId,
        asaasEntityType: entityType,
        asaasTransactionId: transactionId,
      },
    },
    create: {
      accountId: data.accountId,
      bankAccountId: data.bankAccountId ?? null,
      asaasPaymentId: data.asaasPaymentId ?? null,
      asaasTransactionId: transactionId,
      asaasEntityType: entityType,
      direction,
      event: data.event,
      status: data.status ?? 'pending',
      amount: data.amount,
      dueDate: parseDateOnly(data.dueDate),
      paymentDate: data.paymentDate ? parseDateOnly(data.paymentDate) : null,
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
      paymentDate: data.paymentDate ? parseDateOnly(data.paymentDate) : null,
      ...(data.description !== undefined ? { description: data.description } : {}),
    },
  });
  return mapAsaasImport(record);
}

export async function getAsaasImports(
  accountId: number,
  status?: string,
  direction?: string,
): Promise<AsaasImportWithTransactions[]> {
  const records = await prisma.asaasImport.findMany({
    where: {
      accountId,
      ...(status ? { status } : {}),
      ...(direction ? { direction } : {}),
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
      ...(data.direction !== undefined ? { direction: data.direction } : {}),
      ...(data.asaasEntityType !== undefined ? { asaasEntityType: data.asaasEntityType } : {}),
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
              ? parseDateOnly(data.paymentDate)
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
  const record = await prisma.asaasImport.findFirst({
    where: { asaasPaymentId },
    orderBy: { createdAt: 'desc' },
  });
  return record ? mapAsaasImport(record) : undefined;
}

export async function findAsaasImportByEntityRef(
  accountId: number,
  asaasEntityType: string,
  asaasTransactionId: string,
): Promise<AsaasImport | undefined> {
  const record = await prisma.asaasImport.findUnique({
    where: {
      asaas_import_entity_ref: {
        accountId,
        asaasEntityType,
        asaasTransactionId,
      },
    },
  });
  return record ? mapAsaasImport(record) : undefined;
}
