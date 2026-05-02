import * as CategoryRepo from '../storage/category.repository';
import * as TransactionRepo from '../storage/transaction.repository';
import * as AsaasImportRepo from '../storage/asaas-import.repository';
import * as AccountRepo from '../storage/account.repository';
import { prisma } from '../db';
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

export async function applyMatch(importId: number, transactionId: number): Promise<void> {
  const asaasImport = await AsaasImportRepo.getAsaasImportById(importId);
  if (!asaasImport) throw new Error(`Import ${importId} não encontrado`);

  const externalId = asaasImport.asaasPaymentId ?? asaasImport.asaasTransactionId ?? null;

  await TransactionRepo.updateTransaction(transactionId, {
    paid: true,
    externalId,
    paymentMethod: asaasImport.billingType ?? null,
  });

  await AsaasImportRepo.updateAsaasImport(importId, {
    status: 'matched',
    matchedTransactionId: transactionId,
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
