import { Request, Response } from 'express';
import { storage } from '../storage';
import { getMatchCandidates, findBestMatch } from '../services/asaas-reconciliation';

// PAID_EVENTS: dinheiro confirmado ou disponível -> paid=true
// Boleto: PAYMENT_CREATED -> PAYMENT_CONFIRMED -> PAYMENT_RECEIVED
// Pix:    PAYMENT_CREATED -> PAYMENT_RECEIVED
// Cartão: PAYMENT_CREATED -> PAYMENT_CONFIRMED -> PAYMENT_RECEIVED (32 dias depois)
const PAID_EVENTS = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']);
const PENDING_EVENTS = new Set(['PAYMENT_CREATED']);

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

  const { event, payment } = req.body;
  if (!event || !payment?.id) {
    res.status(200).json({ received: true, processed: false, reason: 'invalid_payload' });
    return;
  }

  const isPaid = PAID_EVENTS.has(event);
  const isPending = PENDING_EVENTS.has(event);

  if (!isPaid && !isPending) {
    res.status(200).json({ received: true, processed: false, reason: 'event_ignored' });
    return;
  }

  try {
    // Verificar idempotência: import já existe para este paymentId?
    const existing = await storage.findAsaasImportByPaymentId(payment.id);

    if (existing) {
      // Import já resolvido e evento de pagamento confirmado: propagar paid=true
      if ((existing.status === 'matched' || existing.status === 'standalone') && isPaid) {
        if (existing.matchedTransactionId) {
          await storage.updateTransaction(existing.matchedTransactionId, { paid: true });
          console.log(`[Asaas Webhook] Propagando paid=true para transação ${existing.matchedTransactionId}, import=${existing.id}`);
        }
      }

      // Atualizar import com dados atualizados do evento
      const updateData: Record<string, unknown> = { event, isPaid };
      if (isPaid && payment.paymentDate) {
        updateData.paymentDate = new Date(payment.paymentDate);
      }
      await storage.updateAsaasImport(existing.id, updateData);

      console.log(`[Asaas Webhook] Import atualizado: id=${existing.id}, event=${event}, payment=${payment.id}`);
      res.status(200).json({ received: true, processed: true, action: 'updated_existing_import', importId: existing.id });
      return;
    }

    // Import não existe: criar novo
    const payloadResumido = {
      asaasPaymentId: String(payment.id),
      amount: payment.value,
      dueDate: payment.dueDate,
      paymentDate: payment.paymentDate ?? null,
      description: payment.description ?? null,
      externalReference: payment.externalReference ?? null,
      billingType: payment.billingType ?? null,
      event,
      isPaid,
    };

    // Buscar candidatos e calcular melhor match
    const candidates = await getMatchCandidates(payloadResumido, bankAccount.accountId);
    const bestMatch = findBestMatch(payloadResumido, candidates);

    const created = await storage.createAsaasImport({
      accountId: bankAccount.accountId,
      bankAccountId: bankAccount.id ?? null,
      asaasPaymentId: String(payment.id),
      event,
      amount: String(payment.value),
      dueDate: String(payment.dueDate),
      paymentDate: payment.paymentDate ? String(payment.paymentDate) : null,
      description: payloadResumido.description,
      externalReference: payloadResumido.externalReference,
      billingType: payloadResumido.billingType,
      isPaid,
      suggestedTransactionId: bestMatch ? bestMatch.transactionId : null,
      matchScore: bestMatch ? bestMatch.score : null,
      rawPayload: req.body,
      status: 'pending',
    });

    console.log(`[Asaas Webhook] Import criado: id=${created.id}, event=${event}, payment=${payment.id}, score=${bestMatch?.score ?? null}`);
    res.status(200).json({ received: true, processed: true, action: 'created_import', importId: created.id });
  } catch (error) {
    console.error('[Asaas Webhook] Erro:', error);
    res.status(200).json({ received: true, processed: false, reason: 'internal_error' });
  }
}
