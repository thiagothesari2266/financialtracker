import type { Express } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { validateAccountOwnership } from '../middleware/account-ownership';
import { insertCreditCardSchema, insertCreditCardTransactionSchema } from '@shared/schema';
import logger from '../lib/logger';

export function registerCreditCardRoutes(app: Express) {
  app.get('/api/accounts/:accountId/credit-cards', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const userId = req.session.userId!;
      const creditCards = await storage.getCreditCards(accountId, userId);
      res.json(creditCards);
    } catch (error) {
      logger.error({ err: error }, 'GET /api/accounts/:accountId/credit-cards');
      res.status(500).json({ message: 'Failed to fetch credit cards' });
    }
  });

  app.get('/api/credit-cards/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const card = await storage.getCreditCard(id);
      if (!card) {
        return res.status(404).json({ message: 'Credit card not found' });
      }
      res.json(card);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch credit card' });
    }
  });

  app.post('/api/accounts/:accountId/credit-cards', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const rawData = {
        ...req.body,
        accountId,
      };
      const sanitizedInput = {
        ...rawData,
        brand: rawData.brand?.trim() || undefined,
        creditLimit: rawData.creditLimit?.trim() || undefined,
      };
      const validatedData = insertCreditCardSchema.parse(sanitizedInput);
      const normalizedData = {
        ...validatedData,
        brand: (validatedData.brand ?? '').trim(),
        creditLimit:
          validatedData.creditLimit && validatedData.creditLimit.trim() !== ''
            ? validatedData.creditLimit
            : '0',
      };
      const card = await storage.createCreditCard(normalizedData);
      res.status(201).json(card);
    } catch (error) {
      logger.error({ err: error }, 'POST /api/accounts/:accountId/credit-cards');
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid data', errors: error.errors });
      }
      res.status(500).json({
        message: 'Failed to create credit card',
        error:
          typeof error === 'object' && error && 'message' in error
            ? (error as any).message
            : String(error),
      });
    }
  });

  app.patch('/api/credit-cards/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const sanitizedInput = {
        ...req.body,
        ...(req.body.brand !== undefined && { brand: req.body.brand?.trim() || undefined }),
        ...(req.body.creditLimit !== undefined && {
          creditLimit: req.body.creditLimit?.trim() || undefined,
        }),
      };
      const validatedData = insertCreditCardSchema.partial().parse(sanitizedInput);
      const normalizedData = {
        ...validatedData,
        ...(validatedData.brand !== undefined && {
          brand: validatedData.brand?.trim() ?? '',
        }),
        ...(validatedData.creditLimit !== undefined && {
          creditLimit:
            validatedData.creditLimit && validatedData.creditLimit.trim() !== ''
              ? validatedData.creditLimit
              : '0',
        }),
      };
      const creditCard = await storage.updateCreditCard(id, normalizedData);
      if (!creditCard) {
        return res.status(404).json({ message: 'Credit card not found' });
      }
      res.json(creditCard);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to update credit card' });
    }
  });

  app.delete('/api/credit-cards/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCreditCard(id);
      res.status(204).send();
    } catch (error) {
      logger.error({ err: error }, 'DELETE /api/credit-cards/:id');
      res.status(500).json({
        message: 'Failed to delete credit card',
        error:
          typeof error === 'object' && error && 'message' in error
            ? (error as any).message
            : String(error),
      });
    }
  });

  // Credit card transaction routes
  app.get('/api/accounts/:accountId/credit-card-transactions', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const creditCardId = req.query.creditCardId
        ? parseInt(req.query.creditCardId as string)
        : undefined;
      const transactions = await storage.getCreditCardTransactions(accountId, creditCardId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch credit card transactions' });
    }
  });

  app.post('/api/accounts/:accountId/credit-card-transactions', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const validatedData = insertCreditCardTransactionSchema.parse({
        ...req.body,
        accountId,
      });
      const transaction = await storage.createCreditCardTransaction(validatedData);
      res.status(201).json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create credit card transaction' });
    }
  });

  app.put('/api/credit-card-transactions/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { editScope, exceptionForDate, ...body } = req.body ?? {};
      const validatedData = insertCreditCardTransactionSchema.partial().parse(body);
      const transaction = await storage.updateCreditCardTransaction(id, {
        ...validatedData,
        editScope,
        exceptionForDate,
      });
      if (!transaction) {
        return res.status(404).json({ message: 'Credit card transaction not found' });
      }
      res.json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to update credit card transaction' });
    }
  });

  app.delete('/api/credit-card-transactions/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const editScope = (req.query.editScope ?? req.body?.editScope) as
        | 'single'
        | 'all'
        | 'future'
        | undefined;
      const exceptionForDate = (req.query.exceptionForDate ?? req.body?.exceptionForDate) as
        | string
        | undefined;
      await storage.deleteCreditCardTransaction(id, { editScope, exceptionForDate });
      res.status(204).send();
    } catch (error) {
      logger.error({ err: error }, 'DELETE /api/credit-card-transactions/:id');
      res.status(500).json({ message: 'Failed to delete credit card transaction' });
    }
  });
}
