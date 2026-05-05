import * as AsaasImportRepo from '../storage/asaas-import.repository';
import { prisma } from '../db';
import { AsaasClient, type AsaasFinancialTransaction } from './asaas-client';
import { getMatchCandidates, findBestMatch } from './asaas-reconciliation';
import logger from '../lib/logger';
import type {
  AsaasImportDirection,
  AsaasImportEntityType,
  InsertAsaasImport,
} from '@shared/schema';

const PIX_GENERIC_DESCRIPTION = 'Cobrança gerada automaticamente a partir de Pix recebido.';

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

async function resolveCustomerName(
  client: AsaasClient,
  paymentId: string,
  paymentToCustomer: Map<string, string | null>,
  customerNames: Map<string, string | null>,
): Promise<string | null> {
  let customerId = paymentToCustomer.get(paymentId);
  if (customerId === undefined) {
    try {
      const payment = await client.getPayment(paymentId);
      customerId = payment.customer ?? null;
    } catch (err) {
      logger.warn({ paymentId, err: err instanceof Error ? err.message : err }, 'Falha ao buscar payment no Asaas');
      customerId = null;
    }
    paymentToCustomer.set(paymentId, customerId);
  }
  if (!customerId) return null;

  let name = customerNames.get(customerId);
  if (name === undefined) {
    try {
      const customer = await client.getCustomer(customerId);
      name = customer.name?.trim() || null;
    } catch (err) {
      logger.warn({ customerId, err: err instanceof Error ? err.message : err }, 'Falha ao buscar customer no Asaas');
      name = null;
    }
    customerNames.set(customerId, name);
  }
  return name;
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

  const paymentToCustomer = new Map<string, string | null>();
  const customerNames = new Map<string, string | null>();

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

        // Ignorar transações com data futura (ex: boletos com vencimento futuro)
        if (txDate > finishDate) continue;

        // Para entityType 'payment', usar paymentId como asaasTransactionId
        // (mesmo id usado pelo webhook), garantindo dedup via upsert.
        // Para fees/transfers/saques, usar item.id (financialTransaction id).
        const canonicalTxId = entityType === 'payment' && item.paymentId
          ? item.paymentId
          : item.id;

        const existing = await AsaasImportRepo.findAsaasImportByEntityRef(
          bankAccount.accountId,
          entityType,
          canonicalTxId,
        );

        let description = describe(item);
        if (item.paymentId && description === PIX_GENERIC_DESCRIPTION) {
          const customerName = await resolveCustomerName(
            client,
            item.paymentId,
            paymentToCustomer,
            customerNames,
          );
          if (customerName) description = customerName;
        }

        const payload: InsertAsaasImport = {
          accountId: bankAccount.accountId,
          bankAccountId: bankAccount.id,
          asaasPaymentId: item.paymentId ?? null,
          asaasTransactionId: canonicalTxId,
          asaasEntityType: entityType,
          direction,
          event: item.type,
          status: 'pending',
          amount: absValue,
          dueDate: txDate,
          paymentDate: txDate,
          description,
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

        await AsaasImportRepo.createAsaasImport(payload);

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
