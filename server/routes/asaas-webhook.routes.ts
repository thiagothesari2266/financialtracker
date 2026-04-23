import { Request, Response } from 'express';
import { storage } from '../storage';
import { getMatchCandidates, findBestMatch } from '../services/asaas-reconciliation';
import type { AsaasImportDirection, AsaasImportEntityType } from '@shared/schema';

interface EventMeta {
  direction: AsaasImportDirection;
  entityType: AsaasImportEntityType;
  isPaid: boolean;
  ignore?: boolean;
}

// Mapa de eventos do Asaas: define direction/entityType/isPaid por evento.
// Eventos nao mapeados: retornam 'event_ignored'.
const EVENT_MAP: Record<string, EventMeta> = {
  // Entradas (income/payment)
  PAYMENT_CREATED: { direction: 'income', entityType: 'payment', isPaid: false },
  PAYMENT_CONFIRMED: { direction: 'income', entityType: 'payment', isPaid: true },
  PAYMENT_RECEIVED: { direction: 'income', entityType: 'payment', isPaid: true },

  // Estornos: dinheiro saindo
  PAYMENT_REFUNDED: { direction: 'expense', entityType: 'refund', isPaid: true },
  PAYMENT_REFUND_IN_PROGRESS: { direction: 'expense', entityType: 'refund', isPaid: false },

  // Chargebacks: contestacao de cartao
  PAYMENT_CHARGEBACK_REQUESTED: { direction: 'expense', entityType: 'chargeback', isPaid: false },
  PAYMENT_CHARGEBACK_DISPUTE: { direction: 'expense', entityType: 'chargeback', isPaid: false },
  PAYMENT_AWAITING_CHARGEBACK_REVERSAL: { direction: 'expense', entityType: 'chargeback', isPaid: false },

  // Transferencias (saque pra banco)
  TRANSFER_CREATED: { direction: 'expense', entityType: 'transfer', isPaid: false },
  TRANSFER_PENDING: { direction: 'expense', entityType: 'transfer', isPaid: false },
  TRANSFER_IN_BANK_PROCESSING: { direction: 'expense', entityType: 'transfer', isPaid: false },
  TRANSFER_DONE: { direction: 'expense', entityType: 'transfer', isPaid: true },
  TRANSFER_FAILED: { direction: 'expense', entityType: 'transfer', isPaid: false, ignore: true },
  TRANSFER_CANCELLED: { direction: 'expense', entityType: 'transfer', isPaid: false, ignore: true },
};

export async function handleAsaasWebhook(req: Request, res: Response): Promise<void> {
  const token = req.headers['asaas-access-token'] as string | undefined;

  if (!token) {
    res.status(200).json({ received: true, processed: false, reason: 'missing_token' });
    return;
  }

  const bankAccount = await storage.getBankAccountByWebhookToken(token);
  if (!bankAccount) {
    res.status(200).json({ received: true, processed: false, reason: 'unknown_token' });
    return;
  }

  const { event } = req.body;
  if (!event) {
    res.status(200).json({ received: true, processed: false, reason: 'invalid_payload' });
    return;
  }

  const meta = EVENT_MAP[event];
  if (!meta || meta.ignore) {
    res.status(200).json({ received: true, processed: false, reason: 'event_ignored' });
    return;
  }

  // Extrai entidade principal do payload: payment para eventos PAYMENT_*/TRANSFER_* traz 'transfer'
  const payment = req.body.payment;
  const transfer = req.body.transfer;
  const entity = payment ?? transfer;

  if (!entity?.id) {
    res.status(200).json({ received: true, processed: false, reason: 'invalid_payload' });
    return;
  }

  const entityId = String(entity.id);
  const paymentId = payment?.id ? String(payment.id) : null;

  try {
    // Idempotencia: busca por (account, entityType, entityId)
    const existing = await storage.findAsaasImportByEntityRef(
      bankAccount.accountId,
      meta.entityType,
      entityId,
    );

    if (existing) {
      // Propaga paid=true para transacao resolvida
      if ((existing.status === 'matched' || existing.status === 'standalone') && meta.isPaid) {
        if (existing.matchedTransactionId) {
          await storage.updateTransaction(existing.matchedTransactionId, { paid: true });
          console.log(`[Asaas Webhook] Propagando paid=true para transação ${existing.matchedTransactionId}, import=${existing.id}`);
        }
      }

      const updateData: Record<string, unknown> = { event, isPaid: meta.isPaid };
      const paymentDate = entity.paymentDate ?? entity.effectiveDate ?? null;
      if (meta.isPaid && paymentDate) {
        updateData.paymentDate = String(paymentDate).slice(0, 10);
      }
      await storage.updateAsaasImport(existing.id, updateData);

      console.log(`[Asaas Webhook] Import atualizado: id=${existing.id}, event=${event}, entity=${entityId}`);
      res.status(200).json({ received: true, processed: true, action: 'updated_existing_import', importId: existing.id });
      return;
    }

    const amount = entity.value ?? entity.netValue ?? 0;
    const dueDate = entity.dueDate ?? entity.scheduledDate ?? entity.effectiveDate ?? new Date().toISOString().slice(0, 10);
    const paymentDate = entity.paymentDate ?? entity.effectiveDate ?? null;

    const payloadResumido = {
      amount,
      dueDate,
      paymentDate,
      description: entity.description ?? null,
      externalReference: entity.externalReference ?? null,
      bankAccountId: bankAccount.id ?? null,
    };

    const candidates = await getMatchCandidates(
      payloadResumido,
      bankAccount.accountId,
      meta.direction,
    );
    const bestMatch = findBestMatch(payloadResumido, candidates);

    const created = await storage.createAsaasImport({
      accountId: bankAccount.accountId,
      bankAccountId: bankAccount.id ?? null,
      asaasPaymentId: paymentId,
      asaasTransactionId: entityId,
      asaasEntityType: meta.entityType,
      direction: meta.direction,
      event,
      amount: String(amount),
      dueDate: String(dueDate).slice(0, 10),
      paymentDate: paymentDate ? String(paymentDate).slice(0, 10) : null,
      description: payloadResumido.description,
      externalReference: payloadResumido.externalReference,
      billingType: entity.billingType ?? null,
      isPaid: meta.isPaid,
      suggestedTransactionId: bestMatch ? bestMatch.transactionId : null,
      matchScore: bestMatch ? bestMatch.score : null,
      rawPayload: req.body,
      status: 'pending',
    });

    console.log(`[Asaas Webhook] Import criado: id=${created.id}, event=${event}, entity=${entityId}, score=${bestMatch?.score ?? null}`);
    res.status(200).json({ received: true, processed: true, action: 'created_import', importId: created.id });
  } catch (error) {
    console.error('[Asaas Webhook] Erro:', error);
    res.status(200).json({ received: true, processed: false, reason: 'internal_error' });
  }
}
