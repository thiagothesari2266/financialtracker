import type { Express } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { getBankAccountsWithBalance } from '../services/balance.service';
import { validateAccountOwnership } from '../middleware/account-ownership';
import { insertBankAccountSchema } from '@shared/schema';

export function registerBankAccountRoutes(app: Express) {
  app.get('/api/accounts/:accountId/bank-accounts', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const userId = req.session.userId!;
      const enriched = await getBankAccountsWithBalance(accountId, userId);
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch bank accounts' });
    }
  });

  app.get('/api/bank-accounts/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const bankAccount = await storage.getBankAccount(id);
      if (!bankAccount) {
        return res.status(404).json({ message: 'Bank account not found' });
      }
      res.json(bankAccount);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch bank account' });
    }
  });

  app.post('/api/accounts/:accountId/bank-accounts', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const validatedData = insertBankAccountSchema.parse({
        ...req.body,
        accountId,
      });
      const bankAccount = await storage.createBankAccount(validatedData);
      res.status(201).json(bankAccount);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create bank account' });
    }
  });

  app.patch('/api/bank-accounts/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertBankAccountSchema.partial().parse(req.body);
      const bankAccount = await storage.updateBankAccount(id, validatedData);
      if (!bankAccount) {
        return res.status(404).json({ message: 'Bank account not found' });
      }
      res.json(bankAccount);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to update bank account' });
    }
  });

  app.delete('/api/bank-accounts/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBankAccount(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete bank account' });
    }
  });
}
