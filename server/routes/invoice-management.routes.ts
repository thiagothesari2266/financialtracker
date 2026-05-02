import type { Express } from 'express';
import { z } from 'zod';
import * as CreditCardRepo from '../storage/credit-card.repository';
import { validateAccountOwnership } from '../middleware/account-ownership';
import { insertInvoicePaymentSchema } from '@shared/schema';
import logger from '../lib/logger';

export function registerInvoiceManagementRoutes(app: Express) {
  // Listar faturas de cartão de crédito
  app.get('/api/accounts/:accountId/credit-card-invoices', validateAccountOwnership, async (req, res) => {
    const accountId = Number(req.params.accountId);
    if (!accountId) return res.status(400).json({ error: 'accountId obrigatório' });
    try {
      const invoices = await CreditCardRepo.getCreditCardInvoices(accountId);
      res.json(invoices);
    } catch (error) {
      logger.error({ err: error }, 'GET /credit-card-invoices');
      res.status(500).json({ error: 'Erro ao buscar faturas' });
    }
  });

  // Invoice payment routes
  app.get('/api/accounts/:accountId/invoice-payments', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const invoicePayments = await CreditCardRepo.getInvoicePayments(accountId);
      res.json(invoicePayments);
    } catch (error) {
      logger.error({ err: error }, 'GET /api/accounts/:accountId/invoice-payments');
      res.status(500).json({ message: 'Failed to fetch invoice payments' });
    }
  });

  app.get('/api/accounts/:accountId/invoice-payments/pending', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const pendingInvoices = await CreditCardRepo.getPendingInvoicePayments(accountId);
      res.json(pendingInvoices);
    } catch (error) {
      logger.error({ err: error }, 'GET /api/accounts/:accountId/invoice-payments/pending');
      res.status(500).json({ message: 'Failed to fetch pending invoice payments' });
    }
  });

  app.post('/api/accounts/:accountId/invoice-payments', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const invoicePaymentData = insertInvoicePaymentSchema.parse({
        ...req.body,
        accountId,
      });
      const invoicePayment = await CreditCardRepo.createInvoicePayment(invoicePaymentData);
      res.status(201).json(invoicePayment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: 'Invalid invoice payment data', errors: error.errors });
      }
      logger.error({ err: error }, 'POST /api/accounts/:accountId/invoice-payments');
      res.status(500).json({ message: 'Failed to create invoice payment' });
    }
  });

  app.post('/api/accounts/:accountId/invoice-payments/process-overdue', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const processedInvoices = await CreditCardRepo.processOverdueInvoices(accountId);
      res.json(processedInvoices);
    } catch (error) {
      logger.error({ err: error }, 'POST /api/accounts/:accountId/invoice-payments/process-overdue');
      res.status(500).json({ message: 'Failed to process overdue invoices' });
    }
  });

  app.put('/api/invoice-payments/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const invoicePaymentData = insertInvoicePaymentSchema.partial().parse(req.body);
      const invoicePayment = await CreditCardRepo.updateInvoicePayment(id, invoicePaymentData);
      if (!invoicePayment) {
        return res.status(404).json({ message: 'Invoice payment not found' });
      }
      res.json(invoicePayment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: 'Invalid invoice payment data', errors: error.errors });
      }
      logger.error({ err: error }, 'PUT /api/invoice-payments/:id');
      res.status(500).json({ message: 'Failed to update invoice payment' });
    }
  });

  app.put('/api/invoice-payments/:id/mark-paid', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { transactionId } = req.body;

      if (!transactionId) {
        return res.status(400).json({ message: 'Transaction ID is required' });
      }

      const invoicePayment = await CreditCardRepo.markInvoiceAsPaid(id, transactionId);
      if (!invoicePayment) {
        return res.status(404).json({ message: 'Invoice payment not found' });
      }
      res.json(invoicePayment);
    } catch (error) {
      logger.error({ err: error }, 'PUT /api/invoice-payments/:id/mark-paid');
      res.status(500).json({ message: 'Failed to mark invoice as paid' });
    }
  });

  app.delete('/api/invoice-payments/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await CreditCardRepo.deleteInvoicePayment(id);
      res.status(204).send();
    } catch (error) {
      logger.error({ err: error }, 'DELETE /api/invoice-payments/:id');
      res.status(500).json({ message: 'Failed to delete invoice payment' });
    }
  });
}
