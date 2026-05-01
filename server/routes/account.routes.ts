import type { Express } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { currentMonthBR } from '../utils/date-br';
import { normalizeAmount } from '../utils/normalize-amount';
import { validateAccountOwnership } from '../middleware/account-ownership';
import { insertAccountSchema, insertFixedCashflowSchema, insertDebtSchema } from '@shared/schema';
import logger from '../lib/logger';

export function registerAccountRoutes(app: Express) {
  app.get('/api/accounts', async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Não autenticado' });
      }
      const accounts = await storage.getAccounts(userId);
      res.json(accounts);
    } catch (error) {
      logger.error({ err: error }, 'GET /api/accounts');
      res.status(500).json({ message: 'Failed to fetch accounts' });
    }
  });

  // IMPORTANTE: Esta rota DEVE vir ANTES de /api/accounts/:id
  // senão "limits" será interpretado como um :id
  app.get('/api/accounts/limits', async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Não autenticado' });
      }
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }
      const counts = await storage.getUserAccountCounts(userId);

      res.json({
        limits: {
          personal: user.maxPersonalAccounts,
          business: user.maxBusinessAccounts,
        },
        current: counts,
        canCreate: {
          personal: counts.personal < user.maxPersonalAccounts,
          business: counts.business < user.maxBusinessAccounts,
        },
      });
    } catch (error) {
      logger.error({ err: error }, 'GET /api/accounts/limits');
      res.status(500).json({ message: 'Failed to fetch account limits' });
    }
  });

  app.get('/api/accounts/:id', validateAccountOwnership, async (req, res) => {
    try {
      const account = (req as any).account;
      res.json(account);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch account' });
    }
  });

  app.get('/api/accounts/:id/stats', validateAccountOwnership, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const month = (req.query.month as string) || currentMonthBR();
      const stats = await storage.getAccountStats(id, month);
      if (!stats) {
        return res.status(404).json({ message: 'Account not found' });
      }
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch account stats' });
    }
  });

  app.post('/api/accounts', async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Não autenticado' });
      }
      const validatedData = insertAccountSchema.parse(req.body);
      const account = await storage.createAccount(validatedData, userId);
      res.status(201).json(account);
    } catch (error) {
      logger.error({ err: error }, 'POST /api/accounts');
      if (error instanceof Error && error.message.includes('Limite de contas')) {
        return res.status(403).json({ message: error.message });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create account' });
    }
  });

  app.patch('/api/accounts/:id', validateAccountOwnership, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertAccountSchema.partial().parse(req.body);
      const account = await storage.updateAccount(id, validatedData);
      if (!account) {
        return res.status(404).json({ message: 'Account not found' });
      }
      res.json(account);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to update account' });
    }
  });

  app.delete('/api/accounts/:id', validateAccountOwnership, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAccount(id);
      res.status(204).send();
    } catch (error) {
      logger.error({ err: error }, 'DELETE /api/accounts/:id');
      res.status(500).json({ message: 'Failed to delete account', error: (error as Error).message });
    }
  });

  // Fixed cashflow routes
  app.get('/api/accounts/:id/monthly-fixed', validateAccountOwnership, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const summary = await storage.getFixedCashflow(id);
      res.json(summary);
    } catch (error) {
      logger.error({ err: error }, 'GET /api/accounts/:id/monthly-fixed');
      res.status(500).json({ message: 'Failed to fetch monthly fixed cashflow' });
    }
  });

  app.post('/api/accounts/:id/monthly-fixed', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.id);
      const validated = insertFixedCashflowSchema.parse({
        ...req.body,
        amount: normalizeAmount(req.body.amount),
        accountId,
      });
      const created = await storage.createFixedCashflow(validated);
      res.status(201).json(created);
    } catch (error) {
      logger.error({ err: error }, 'POST /api/accounts/:id/monthly-fixed');
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create monthly fixed entry' });
    }
  });

  app.patch('/api/monthly-fixed/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validated = insertFixedCashflowSchema.partial().parse({
        ...req.body,
        amount: req.body.amount !== undefined ? normalizeAmount(req.body.amount) : undefined,
      });
      const updated = await storage.updateFixedCashflow(id, validated);
      if (!updated) return res.status(404).json({ message: 'Item not found' });
      res.json(updated);
    } catch (error) {
      logger.error({ err: error }, 'PATCH /api/monthly-fixed/:id');
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to update monthly fixed entry' });
    }
  });

  app.delete('/api/monthly-fixed/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteFixedCashflow(id);
      res.status(204).send();
    } catch (error) {
      logger.error({ err: error }, 'DELETE /api/monthly-fixed/:id');
      res.status(500).json({ message: 'Failed to delete monthly fixed entry' });
    }
  });

  // Debt routes
  app.get('/api/accounts/:accountId/debts', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const debts = await storage.getDebts(accountId);
      res.json(debts);
    } catch (error) {
      logger.error({ err: error }, 'GET /api/accounts/:accountId/debts');
      res.status(500).json({ message: 'Failed to fetch debts' });
    }
  });

  app.get('/api/debts/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const debt = await storage.getDebt(id);
      if (!debt) return res.status(404).json({ message: 'Debt not found' });
      res.json(debt);
    } catch (error) {
      logger.error({ err: error }, 'GET /api/debts/:id');
      res.status(500).json({ message: 'Failed to fetch debt' });
    }
  });

  app.post('/api/accounts/:accountId/debts', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const validated = insertDebtSchema.parse({
        ...req.body,
        balance: normalizeAmount(req.body.balance),
        interestRate: normalizeAmount(req.body.interestRate, 3),
        accountId,
      });

      const created = await storage.createDebt(validated);
      res.status(201).json(created);
    } catch (error) {
      logger.error({ err: error }, 'POST /api/accounts/:accountId/debts');
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create debt' });
    }
  });

  app.patch('/api/debts/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validated = insertDebtSchema.partial().parse({
        ...req.body,
        balance: req.body.balance !== undefined ? normalizeAmount(req.body.balance) : undefined,
        interestRate:
          req.body.interestRate !== undefined
            ? normalizeAmount(req.body.interestRate, 3)
            : undefined,
      });

      const updated = await storage.updateDebt(id, validated);
      if (!updated) return res.status(404).json({ message: 'Debt not found' });
      res.json(updated);
    } catch (error) {
      logger.error({ err: error }, 'PATCH /api/debts/:id');
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to update debt' });
    }
  });

  app.delete('/api/debts/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDebt(id);
      res.status(204).send();
    } catch (error) {
      logger.error({ err: error }, 'DELETE /api/debts/:id');
      res.status(500).json({ message: 'Failed to delete debt' });
    }
  });
}
