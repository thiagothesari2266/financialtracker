import { Request, Response } from 'express';
import { storage } from '../storage';

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
    // Buscar ou criar categoria "Asaas" para o account
    const categories = await storage.getCategories(bankAccount.accountId);
    let category = categories.find(c => c.name === 'Asaas' && c.type === 'income');
    if (!category) {
      category = await storage.createCategory({
        name: 'Asaas',
        color: '#3b82f6',
        icon: 'Landmark',
        type: 'income',
        accountId: bankAccount.accountId,
      });
    }

    const transactionDate = (isPaid && payment.paymentDate) ? payment.paymentDate : payment.dueDate;

    const existing = await storage.findTransactionByExternalId(payment.id, bankAccount.accountId);

    if (existing) {
      await storage.updateTransaction(existing.id, { paid: isPaid });
      console.log(`[Asaas Webhook] Atualizado: id=${existing.id}, event=${event}, payment=${payment.id}`);
      res.status(200).json({ received: true, processed: true, action: 'updated', transactionId: existing.id });
      return;
    }

    const description = payment.description
      || (payment.externalReference ? `Pedido ${payment.externalReference}` : 'Recebimento Asaas');

    const created = await storage.createTransaction({
      description,
      amount: String(payment.value),
      type: 'income' as const,
      date: String(transactionDate),
      categoryId: category.id,
      accountId: bankAccount.accountId,
      bankAccountId: bankAccount.id ?? null,
      paid: isPaid,
      paymentMethod: payment.billingType ? String(payment.billingType) : null,
      externalId: payment.id ? String(payment.id) : null,
      isException: false,
    });

    console.log(`[Asaas Webhook] Criado: id=${created.id}, event=${event}, payment=${payment.id}`);
    res.status(200).json({ received: true, processed: true, action: 'created', transactionId: created.id });
  } catch (error) {
    console.error('[Asaas Webhook] Erro:', error);
    res.status(200).json({ received: true, processed: false, reason: 'internal_error' });
  }
}
