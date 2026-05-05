import { randomUUID } from 'crypto';
import * as CategoryRepo from '../storage/category.repository';
import * as TransactionRepo from '../storage/transaction.repository';
import * as AsaasImportRepo from '../storage/asaas-import.repository';
import * as AccountRepo from '../storage/account.repository';
import { prisma } from '../db';
import { addMonthsPreserveDay } from '../storage/utils';
import type { AsaasImportDirection } from '@shared/schema';

// ---- Helper: buscar ou criar categoria "Asaas" por direcao ----

export async function getOrCreateAsaasCategory(
  accountId: number,
  direction: AsaasImportDirection,
): Promise<number> {
  const categories = await CategoryRepo.getCategories(accountId);
  let category = categories.find(c => c.name === 'Asaas' && c.type === direction);
  if (!category) {
    category = await CategoryRepo.createCategory({
      name: 'Asaas',
      color: direction === 'income' ? '#3b82f6' : '#ef4444',
      icon: 'Landmark',
      type: direction,
      accountId,
    });
  }
  return category.id;
}

// ---- Ações atômicas por import ----

function isMonthlyRecurrenceTemplate(tx: { launchType: string | null; recurrenceFrequency: string | null; isException: boolean }): boolean {
  return tx.launchType === 'recorrente'
    && tx.recurrenceFrequency === 'mensal'
    && !tx.isException;
}

/**
 * Para um template recorrente mensal, calcula a data canônica da ocorrência
 * mais próxima de targetDate (alinhada com o ciclo do template).
 */
function alignToTemplateCycle(templateDate: Date, targetDate: Date): Date {
  const monthsDiff =
    (targetDate.getUTCFullYear() - templateDate.getUTCFullYear()) * 12 +
    (targetDate.getUTCMonth() - templateDate.getUTCMonth());
  return addMonthsPreserveDay(templateDate, monthsDiff);
}

function parseDate(input: Date | string): Date {
  if (input instanceof Date) return input;
  return new Date(input.includes('T') ? input : `${input}T00:00:00.000Z`);
}

export async function applyMatch(importId: number, transactionId: number): Promise<void> {
  const asaasImport = await AsaasImportRepo.getAsaasImportById(importId);
  if (!asaasImport) throw new Error(`Import ${importId} não encontrado`);

  const externalId = asaasImport.asaasPaymentId ?? asaasImport.asaasTransactionId ?? null;
  const paymentDate = asaasImport.paymentDate ?? asaasImport.dueDate;

  const target = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!target) throw new Error(`Transação ${transactionId} não encontrada`);

  let resolvedTransactionId = transactionId;

  if (isMonthlyRecurrenceTemplate(target)) {
    // Template recorrente: criar exceção paga em vez de marcar o template
    let groupId = target.recurrenceGroupId;
    if (!groupId) {
      groupId = randomUUID();
      await prisma.transaction.update({
        where: { id: target.id },
        data: { recurrenceGroupId: groupId },
      });
    }

    const referenceDate = parseDate(paymentDate);
    const exceptionForDate = alignToTemplateCycle(target.date, referenceDate);

    const existing = await prisma.transaction.findFirst({
      where: {
        accountId: target.accountId,
        recurrenceGroupId: groupId,
        isException: true,
        exceptionForDate,
      },
    });

    if (existing) {
      const updated = await prisma.transaction.update({
        where: { id: existing.id },
        data: {
          paid: true,
          externalId,
          paymentMethod: asaasImport.billingType ?? existing.paymentMethod,
          date: referenceDate,
        },
      });
      resolvedTransactionId = updated.id;
    } else {
      const created = await prisma.transaction.create({
        data: {
          description: target.description,
          amount: asaasImport.amount,
          type: target.type,
          date: referenceDate,
          categoryId: target.categoryId,
          accountId: target.accountId,
          bankAccountId: asaasImport.bankAccountId ?? target.bankAccountId,
          paymentMethod: asaasImport.billingType ?? target.paymentMethod,
          clientName: target.clientName,
          projectName: target.projectName,
          costCenter: target.costCenter,
          isException: true,
          exceptionForDate,
          recurrenceGroupId: groupId,
          launchType: 'unica',
          recurrenceFrequency: null,
          recurrenceEndDate: null,
          installments: 1,
          currentInstallment: 1,
          paid: true,
          externalId,
        },
      });
      resolvedTransactionId = created.id;
    }
  } else {
    await TransactionRepo.updateTransaction(transactionId, {
      paid: true,
      externalId,
      paymentMethod: asaasImport.billingType ?? null,
    });
  }

  await AsaasImportRepo.updateAsaasImport(importId, {
    status: 'matched',
    matchedTransactionId: resolvedTransactionId,
    resolvedAt: new Date().toISOString(),
  });
}

export async function applyStandalone(importId: number): Promise<void> {
  const asaasImport = await AsaasImportRepo.getAsaasImportById(importId);
  if (!asaasImport) throw new Error(`Import ${importId} não encontrado`);

  const direction = asaasImport.direction ?? 'income';
  const categoryId = await getOrCreateAsaasCategory(asaasImport.accountId, direction);

  const transactionDate = (asaasImport.isPaid && asaasImport.paymentDate)
    ? asaasImport.paymentDate
    : asaasImport.dueDate;

  const fallbackByDirection = direction === 'expense' ? 'Saída Asaas' : 'Recebimento Asaas';
  const description = asaasImport.description
    || (asaasImport.externalReference ? `Pedido ${asaasImport.externalReference}` : fallbackByDirection);

  const externalId = asaasImport.asaasPaymentId ?? asaasImport.asaasTransactionId ?? null;

  const created = await TransactionRepo.createTransaction({
    description,
    amount: String(asaasImport.amount),
    type: direction,
    date: String(transactionDate),
    categoryId,
    accountId: asaasImport.accountId,
    bankAccountId: asaasImport.bankAccountId ?? null,
    paid: asaasImport.isPaid,
    paymentMethod: asaasImport.billingType ?? null,
    externalId,
    isException: false,
  });

  await AsaasImportRepo.updateAsaasImport(importId, {
    status: 'standalone',
    matchedTransactionId: created.id,
    resolvedAt: new Date().toISOString(),
  });
}

export async function applyIgnore(importId: number): Promise<void> {
  await AsaasImportRepo.updateAsaasImport(importId, {
    status: 'ignored',
    resolvedAt: new Date().toISOString(),
  });
}

// ---- Bulk resolve ----

export interface BulkResolveItem {
  id: number;
  action: 'match' | 'standalone' | 'ignore';
  transactionId?: number;
}

export interface BulkResolveSummary {
  matched: number;
  standalone: number;
  ignored: number;
  errors: { id: number; error: string }[];
}

export async function bulkResolveImports(
  items: BulkResolveItem[],
  userId: number,
): Promise<BulkResolveSummary> {
  const summary: BulkResolveSummary = { matched: 0, standalone: 0, ignored: 0, errors: [] };

  await prisma.$transaction(async () => {
    for (const item of items) {
      try {
        const asaasImport = await AsaasImportRepo.getAsaasImportById(item.id);
        if (!asaasImport) {
          summary.errors.push({ id: item.id, error: 'Import não encontrado' });
          continue;
        }

        const account = await AccountRepo.getAccount(asaasImport.accountId);
        if (!account || account.userId !== userId) {
          summary.errors.push({ id: item.id, error: 'Acesso negado' });
          continue;
        }

        if (item.action === 'match') {
          if (!item.transactionId) {
            summary.errors.push({ id: item.id, error: 'transactionId obrigatório para action=match' });
            continue;
          }
          await applyMatch(item.id, item.transactionId);
          summary.matched++;
        } else if (item.action === 'standalone') {
          await applyStandalone(item.id);
          summary.standalone++;
        } else if (item.action === 'ignore') {
          await applyIgnore(item.id);
          summary.ignored++;
        }
      } catch (itemError) {
        summary.errors.push({
          id: item.id,
          error: itemError instanceof Error ? itemError.message : 'Erro desconhecido',
        });
      }
    }
  });

  return summary;
}
