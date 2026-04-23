import { storage } from '../storage';
import { prisma } from '../db';
import { AsaasClient, type AsaasFinancialTransaction } from './asaas-client';
import { getMatchCandidates, findBestMatch } from './asaas-reconciliation';
import type {
  AsaasImportDirection,
  AsaasImportEntityType,
  InsertAsaasImport,
} from '@shared/schema';

export interface SyncResult {
  scanned: number;
  created: number;
  updated: number;
  matched: number;
  errors: { id: string; error: string }[];
}

function classifyType(asaasType: string, value: number): {
  direction: AsaasImportDirection;
  entityType: AsaasImportEntityType;
} {
  const upper = asaasType.toUpperCase();
  const direction: AsaasImportDirection = value < 0 ? 'expense' : 'income';

  let entityType: AsaasImportEntityType = 'other';
  if (upper.includes('CHARGEBACK')) entityType = 'chargeback';
  else if (upper.includes('REFUND')) entityType = 'refund';
  else if (upper.includes('FEE')) entityType = 'fee';
  else if (upper.includes('TRANSFER')) entityType = 'transfer';
  else if (upper.includes('BILL_PAYMENT') || upper.includes('BILLPAYMENT')) entityType = 'bill_payment';
  else if (upper.includes('PAYMENT')) entityType = 'payment';
  else if (upper.includes('PIX')) entityType = 'transfer';

  return { direction, entityType };
}

function formatDateOnly(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  return d.toISOString().slice(0, 10);
}

function describe(tx: AsaasFinancialTransaction): string {
  if (tx.description && tx.description.trim().length > 0) return tx.description;
  return tx.type.replace(/_/g, ' ').toLowerCase();
}

export async function syncBankAccount(
  bankAccountId: number,
  sinceDays = 90,
): Promise<SyncResult> {
  const bankAccount = await prisma.bankAccount.findUnique({ where: { id: bankAccountId } });
  if (!bankAccount) throw new Error('BankAccount não encontrada');
  if (!bankAccount.asaasApiKey) throw new Error('BankAccount sem asaasApiKey');

  const client = new AsaasClient(bankAccount.asaasApiKey);

  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - sinceDays);
  const startDate = formatDateOnly(start);
  const finishDate = formatDateOnly(now);

  const result: SyncResult = { scanned: 0, created: 0, updated: 0, matched: 0, errors: [] };

  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const page = await client.listFinancialTransactions({ startDate, finishDate, offset, limit });

    for (const item of page.data) {
      result.scanned++;
      try {
        const { direction, entityType } = classifyType(item.type, item.value);
        const absValue = Math.abs(item.value).toFixed(2);
        const txDate = item.date ? formatDateOnly(item.date) : formatDateOnly(now);

        const existing = await storage.findAsaasImportByEntityRef(
          bankAccount.accountId,
          entityType,
          item.id,
        );

        const payload: InsertAsaasImport = {
          accountId: bankAccount.accountId,
          bankAccountId: bankAccount.id,
          asaasPaymentId: item.payment ?? null,
          asaasTransactionId: item.id,
          asaasEntityType: entityType,
          direction,
          event: item.type,
          status: 'pending',
          amount: absValue,
          dueDate: txDate,
          paymentDate: txDate,
          description: describe(item),
          externalReference: null,
          billingType: null,
          isPaid: true,
          rawPayload: item as unknown as Record<string, unknown>,
        };

        let suggestion: { transactionId: number; score: number } | null = null;
        if (!existing) {
          const candidates = await getMatchCandidates(
            {
              amount: absValue,
              dueDate: txDate,
              paymentDate: txDate,
              description: payload.description,
              externalReference: null,
              bankAccountId: bankAccount.id,
            },
            bankAccount.accountId,
            direction,
          );
          suggestion = findBestMatch(
            {
              amount: absValue,
              dueDate: txDate,
              paymentDate: txDate,
              description: payload.description,
              externalReference: null,
              bankAccountId: bankAccount.id,
            },
            candidates,
          );
          if (suggestion) {
            payload.suggestedTransactionId = suggestion.transactionId;
            payload.matchScore = suggestion.score;
          }
        }

        await storage.createAsaasImport(payload);

        if (existing) result.updated++;
        else {
          result.created++;
          if (suggestion) result.matched++;
        }
      } catch (err) {
        result.errors.push({
          id: item.id,
          error: err instanceof Error ? err.message : 'erro desconhecido',
        });
      }
    }

    hasMore = page.hasMore;
    offset += limit;
    if (offset > 5000) break;
  }

  return result;
}
