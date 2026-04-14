import type { Express } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { validateAccountOwnership } from '../middleware/account-ownership';
import { insertInvoicePaymentSchema } from '@shared/schema';

export function registerInvoiceManagementRoutes(app: Express) {
  // Listar faturas de cartão de crédito
  app.get('/api/accounts/:accountId/credit-card-invoices', validateAccountOwnership, async (req, res) => {
    const accountId = Number(req.params.accountId);
    if (!accountId) return res.status(400).json({ error: 'accountId obrigatório' });
    try {
      await storage.syncInvoiceTransactions(accountId);
      const invoices = await storage.getCreditCardInvoices(accountId);
      res.json(invoices);
    } catch (error) {
      console.error('[GET /credit-card-invoices] Erro:', error);
      res.status(500).json({ error: 'Erro ao buscar faturas' });
    }
  });

  // Invoice payment routes
  app.get('/api/accounts/:accountId/invoice-payments', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const invoicePayments = await storage.getInvoicePayments(accountId);
      res.json(invoicePayments);
    } catch (error) {
      console.error('[GET /api/accounts/:accountId/invoice-payments]', error);
      res.status(500).json({ message: 'Failed to fetch invoice payments' });
    }
  });

  app.get('/api/accounts/:accountId/invoice-payments/pending', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const pendingInvoices = await storage.getPendingInvoicePayments(accountId);
      res.json(pendingInvoices);
    } catch (error) {
      console.error('[GET /api/accounts/:accountId/invoice-payments/pending]', error);
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
      const invoicePayment = await storage.createInvoicePayment(invoicePaymentData);
      res.status(201).json(invoicePayment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: 'Invalid invoice payment data', errors: error.errors });
      }
      console.error('[POST /api/accounts/:accountId/invoice-payments]', error);
      res.status(500).json({ message: 'Failed to create invoice payment' });
    }
  });

  app.post('/api/accounts/:accountId/invoice-payments/process-overdue', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const processedInvoices = await storage.processOverdueInvoices(accountId);
      res.json(processedInvoices);
    } catch (error) {
      console.error('[POST /api/accounts/:accountId/invoice-payments/process-overdue]', error);
      res.status(500).json({ message: 'Failed to process overdue invoices' });
    }
  });

  app.put('/api/invoice-payments/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const invoicePaymentData = insertInvoicePaymentSchema.partial().parse(req.body);
      const invoicePayment = await storage.updateInvoicePayment(id, invoicePaymentData);
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
      console.error('[PUT /api/invoice-payments/:id]', error);
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

      const invoicePayment = await storage.markInvoiceAsPaid(id, transactionId);
      if (!invoicePayment) {
        return res.status(404).json({ message: 'Invoice payment not found' });
      }
      res.json(invoicePayment);
    } catch (error) {
      console.error('[PUT /api/invoice-payments/:id/mark-paid]', error);
      res.status(500).json({ message: 'Failed to mark invoice as paid' });
    }
  });

  app.delete('/api/invoice-payments/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteInvoicePayment(id);
      res.status(204).send();
    } catch (error) {
      console.error('[DELETE /api/invoice-payments/:id]', error);
      res.status(500).json({ message: 'Failed to delete invoice payment' });
    }
  });

  // Legacy invoice transaction endpoints
  app.get('/api/accounts/:id/legacy-invoice-transactions', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.id);
      const legacyTransactions = await storage.getLegacyInvoiceTransactions(accountId);
      res.json(legacyTransactions);
    } catch (error) {
      console.error('[GET /api/accounts/:id/legacy-invoice-transactions]', error);
      res.status(500).json({ message: 'Failed to fetch legacy invoice transactions' });
    }
  });

  app.delete('/api/accounts/:id/legacy-invoice-transactions', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.id);
      const result = await storage.deleteLegacyInvoiceTransactions(accountId);
      res.json({
        message: 'Legacy invoice transactions deleted successfully',
        deletedCount: result.deletedCount,
      });
    } catch (error) {
      console.error('[DELETE /api/accounts/:id/legacy-invoice-transactions]', error);
      res.status(500).json({ message: 'Failed to delete legacy invoice transactions' });
    }
  });
}
