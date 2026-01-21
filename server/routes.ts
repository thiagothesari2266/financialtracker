import type { Express } from 'express';
import { createServer, type Server } from 'http';
import { storage } from './storage';
import { validateAccountOwnership } from './middleware/account-ownership';
import {
  uploadInvoice,
  uploadMultipleInvoiceImages,
  pasteInvoiceImage,
  getCardInvoiceImports,
  getInvoiceImportDetail,
  retryInvoiceImport,
} from './routes/invoice-upload.routes';
import { AIFinancialAdvisor } from './services/ai-financial-advisor';
import { aiChatRateLimit, createRateLimitMiddleware } from './middleware/rate-limit';
import {
  insertAccountSchema,
  insertCategorySchema,
  insertTransactionSchema,
  insertCreditCardSchema,
  insertCreditCardTransactionSchema,
  insertBankAccountSchema,
  insertInvoicePaymentSchema,
  insertProjectSchema,
  insertCostCenterSchema,
  insertClientSchema,
} from '@shared/schema';
import { z } from 'zod';
import { insertFixedCashflowSchema, insertDebtSchema } from '@shared/schema';

const normalizeAmount = (value: unknown, decimals = 2): string | undefined => {
  if (value === null || value === undefined) return undefined;

  const raw = String(value).trim();
  if (!raw) return undefined;

  const hasComma = raw.includes(',');
  const hasDot = raw.includes('.');

  // Vírgula como decimal: remove pontos de milhar e troca vírgula por ponto
  if (hasComma && (!hasDot || raw.lastIndexOf(',') > raw.lastIndexOf('.'))) {
    const withoutThousands = raw.replace(/\./g, '');
    const normalized = withoutThousands.replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    if (Number.isFinite(parsed)) return parsed.toFixed(decimals);
  }

  // Ponto como decimal: remover vírgulas usadas como milhar
  if (hasDot) {
    const normalized = raw.replace(/,/g, '');
    const parsed = Number.parseFloat(normalized);
    if (Number.isFinite(parsed)) return parsed.toFixed(decimals);
  }

  // Sem separadores explícitos: interpretar como número inteiro ou decimal já no formato do usuário
  const parsed = Number.parseFloat(raw.replace(/\s+/g, ''));
  return Number.isFinite(parsed) ? parsed.toFixed(decimals) : undefined;
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Account routes
  app.get('/api/accounts', async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Não autenticado' });
      }
      const accounts = await storage.getAccounts(userId);
      res.json(accounts);
    } catch (error) {
      console.error('[GET /api/accounts]', error);
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
      console.error('[GET /api/accounts/limits]', error);
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
      const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);
      const stats = await storage.getAccountStats(id, month);
      if (!stats) {
        return res.status(404).json({ message: 'Account not found' });
      }
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch account stats' });
    }
  });

  app.get('/api/accounts/:id/monthly-fixed', validateAccountOwnership, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const summary = await storage.getFixedCashflow(id);
      res.json(summary);
    } catch (error) {
      console.error('[GET /api/accounts/:id/monthly-fixed]', error);
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
      console.error('[POST /api/accounts/:id/monthly-fixed]', error);
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
      console.error('[PATCH /api/monthly-fixed/:id]', error);
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
      console.error('[DELETE /api/monthly-fixed/:id]', error);
      res.status(500).json({ message: 'Failed to delete monthly fixed entry' });
    }
  });

  app.get('/api/accounts/:accountId/debts', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const debts = await storage.getDebts(accountId);
      res.json(debts);
    } catch (error) {
      console.error('[GET /api/accounts/:accountId/debts]', error);
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
      console.error('[GET /api/debts/:id]', error);
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
      console.error('[POST /api/accounts/:accountId/debts]', error);
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
      console.error('[PATCH /api/debts/:id]', error);
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
      console.error('[DELETE /api/debts/:id]', error);
      res.status(500).json({ message: 'Failed to delete debt' });
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
      console.error('[POST /api/accounts]', error);
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
      console.error('[DELETE /api/accounts/:id]', error);
      res.status(500).json({ message: 'Failed to delete account', error: (error as Error).message });
    }
  });

  // AI Financial Advisor routes
  app.get('/api/accounts/:id/financial-summary', validateAccountOwnership, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const context = await AIFinancialAdvisor.getFinancialContext(id);
      res.json(context);
    } catch (error) {
      console.error('[GET /api/accounts/:id/financial-summary]', error);
      res.status(500).json({ message: 'Failed to fetch financial summary' });
    }
  });

  app.post(
    '/api/accounts/:id/ai-chat',
    validateAccountOwnership,
    createRateLimitMiddleware(aiChatRateLimit),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const { message, conversationHistory = [] } = req.body;

        // Validação de entrada
        if (!message || typeof message !== 'string') {
          return res.status(400).json({ message: 'Message is required' });
        }

        // Sanitização e validação de tamanho
        const sanitizedMessage = message.trim();
        if (sanitizedMessage.length === 0) {
          return res.status(400).json({ message: 'Message cannot be empty' });
        }

        if (sanitizedMessage.length > 500) {
          return res.status(400).json({ message: 'Message too long (max 500 characters)' });
        }

        // Verificar se a conta existe
        const account = await storage.getAccount(id);
        if (!account) {
          return res.status(404).json({ message: 'Account not found' });
        }

        console.log(
          `[AI Chat] Account ${id}: "${sanitizedMessage.substring(0, 50)}${sanitizedMessage.length > 50 ? '...' : ''}"`
        );

        const response = await AIFinancialAdvisor.analyzeFinances(
          id,
          sanitizedMessage,
          conversationHistory
        );
        res.json({ response });
      } catch (error) {
        console.error('[POST /api/accounts/:id/ai-chat]', error);
        res.status(500).json({ message: 'Failed to process AI request' });
      }
    }
  );

  // Category routes
  app.get('/api/accounts/:accountId/categories', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const categories = await storage.getCategories(accountId);
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch categories' });
    }
  });

  app.get('/api/accounts/:accountId/categories/stats', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);
      const stats = await storage.getCategoryStats(accountId, month);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch category stats' });
    }
  });

  app.post('/api/accounts/:accountId/categories', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const validatedData = insertCategorySchema.parse({
        ...req.body,
        accountId,
      });
      const category = await storage.createCategory(validatedData);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create category' });
    }
  });

  app.patch('/api/categories/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log('[PATCH /api/categories/:id] id:', id, 'body:', req.body);
      const validatedData = insertCategorySchema.partial().parse(req.body);
      if (!validatedData || Object.keys(validatedData).length === 0) {
        return res.status(400).json({ message: 'Nenhum campo para atualizar' });
      }
      const category = await storage.updateCategory(id, validatedData);
      if (!category) {
        console.log('[PATCH /api/categories/:id] Category not found');
        return res.status(404).json({ message: 'Category not found' });
      }
      res.json(category);
    } catch (error) {
      console.error('[PATCH /api/categories/:id] error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to update category' });
    }
  });

  app.delete('/api/categories/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log('[DELETE /api/categories/:id] id:', id);
      await storage.deleteCategory(id);
      res.status(204).send();
    } catch (error) {
      console.error('[DELETE /api/categories/:id] error:', error);
      res.status(500).json({ message: 'Failed to delete category' });
    }
  });

  // Transaction routes
  app.get('/api/accounts/:accountId/transactions', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      await storage.syncInvoiceTransactions(accountId);

      let transactions;
      if (startDate && endDate) {
        transactions = await storage.getTransactionsByDateRange(accountId, startDate, endDate);
      } else {
        transactions = await storage.getTransactions(accountId, limit);
      }

      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch transactions' });
    }
  });

  app.get('/api/transactions/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const transaction = await storage.getTransaction(id);
      if (!transaction) {
        return res.status(404).json({ message: 'Transaction not found' });
      }
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch transaction' });
    }
  });

  app.post('/api/accounts/:accountId/transactions', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      // Converte campos string para número antes da validação
      const raw = { ...req.body };
      // Limpa todos os campos opcionais que vierem como string vazia
      const optionalFields = [
        'bankAccountId',
        'installments',
        'currentInstallment',
        'installmentsGroupId',
        'recurrenceFrequency',
        'recurrenceEndDate',
        'launchType',
        'recurrenceGroupId',
        'paymentMethod',
        'clientName',
        'projectName',
        'costCenter',
      ];
      for (const key of optionalFields) {
        if (raw[key] === '' || raw[key] === null) {
          raw[key] = undefined;
        }
      }
      if (raw.bankAccountId !== undefined) {
        raw.bankAccountId = Number(raw.bankAccountId);
        if (isNaN(raw.bankAccountId)) raw.bankAccountId = undefined;
      }
      if (raw.installments !== undefined) {
        raw.installments = Number(raw.installments);
        if (isNaN(raw.installments)) raw.installments = 1;
      } else {
        raw.installments = 1;
      }
      if (raw.currentInstallment !== undefined) {
        raw.currentInstallment = Number(raw.currentInstallment);
        if (isNaN(raw.currentInstallment)) raw.currentInstallment = 1;
      }
      // --- Validação extra para parcelada ---
      if (raw.launchType === 'parcelada') {
        if (!raw.installments || isNaN(raw.installments) || raw.installments < 2) {
          return res.status(400).json({
            message:
              'Número de parcelas inválido. Informe um número de parcelas maior ou igual a 2.',
          });
        }
      }
      const validatedData = insertTransactionSchema.parse({
        ...raw,
        accountId,
      });
      const transaction = await storage.createTransaction(validatedData);
      res.status(201).json(transaction);
    } catch (error) {
      console.error('[POST /api/accounts/:accountId/transactions] Erro:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid data', errors: error.errors });
      }
      res.status(500).json({
        message: 'Failed to create transaction',
        error:
          typeof error === 'object' && error && 'message' in error
            ? (error as any).message
            : String(error),
      });
    }
  });

  app.patch('/api/transactions/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // Permite campos extras para edição em lote
      const { editScope, installmentsGroupId, recurrenceGroupId, ...raw } = req.body;
      console.log('[PATCH /api/transactions/:id] incoming', {
        id,
        editScope,
        installmentsGroupId,
        recurrenceGroupId,
        rawKeys: Object.keys(raw),
      });
      // Remove identificadores de grupo nulos/vazios para evitar falha de validação
      if (recurrenceGroupId === null || recurrenceGroupId === '') {
        delete (raw as any).recurrenceGroupId;
      }
      if (installmentsGroupId === null || installmentsGroupId === '') {
        delete (raw as any).installmentsGroupId;
      }
      const validatedData = insertTransactionSchema.partial().parse(raw);
      let transaction;
      if (editScope) {
        const scopedPayload: any = { ...validatedData, editScope };
        if (installmentsGroupId) scopedPayload.installmentsGroupId = installmentsGroupId;
        if (recurrenceGroupId) scopedPayload.recurrenceGroupId = recurrenceGroupId;
        transaction = await storage.updateTransactionWithScope(id, scopedPayload);
      } else {
        transaction = await storage.updateTransaction(id, validatedData);
      }
      if (!transaction) {
        return res.status(404).json({ message: 'Transação não encontrada' });
      }
      res.json(transaction);
    } catch (error) {
      console.error('[PATCH /api/transactions/:id] Erro:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid data', errors: error.errors });
      }
      res.status(500).json({
        message: 'Failed to update transaction',
        error:
          typeof error === 'object' && error && 'message' in error
            ? (error as any).message
            : String(error),
      });
    }
  });

  app.delete('/api/transactions/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // Suporte a exclusão em lote via body
      const { editScope, installmentsGroupId } = req.body || {};
      if (editScope && installmentsGroupId) {
        await storage.deleteTransaction(id, { editScope, installmentsGroupId });
      } else {
        await storage.deleteTransaction(id);
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete transaction' });
    }
  });

  // Credit card routes
  app.get('/api/accounts/:accountId/credit-cards', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      console.log(
        `[GET /api/accounts/${accountId}/credit-cards] Buscando cartões para accountId:`,
        accountId
      );
      const creditCards = await storage.getCreditCards(accountId);
      console.log(
        `[GET /api/accounts/${accountId}/credit-cards] Encontrados ${creditCards.length} cartões:`,
        creditCards
      );
      res.json(creditCards);
    } catch (error) {
      console.error(`[GET /api/accounts/:accountId/credit-cards] Erro:`, error);
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
      console.log('[POST /api/accounts/:accountId/credit-cards] Body recebido:', req.body);
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
      console.log('[POST /api/accounts/:accountId/credit-cards] Dados validados:', validatedData);
      const card = await storage.createCreditCard(normalizedData);
      res.status(201).json(card);
    } catch (error) {
      console.error('[POST /api/accounts/:accountId/credit-cards] Erro:', error);
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
      console.log('[DELETE /api/credit-cards/:id] Tentando excluir cartão ID:', id);
      await storage.deleteCreditCard(id);
      console.log('[DELETE /api/credit-cards/:id] Cartão excluído com sucesso');
      res.status(204).send();
    } catch (error) {
      console.error('[DELETE /api/credit-cards/:id] Erro:', error);
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
      const validatedData = insertCreditCardTransactionSchema.partial().parse(req.body);
      const transaction = await storage.updateCreditCardTransaction(id, validatedData);
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
      console.log('[DELETE /api/credit-card-transactions/:id] id:', id);
      await storage.deleteCreditCardTransaction(id);
      console.log('[DELETE /api/credit-card-transactions/:id] Transação excluída com sucesso');
      res.status(204).send();
    } catch (error) {
      console.error('[DELETE /api/credit-card-transactions/:id] error:', error);
      res.status(500).json({ message: 'Failed to delete credit card transaction' });
    }
  });

  // Bank account routes
  app.get('/api/accounts/:accountId/bank-accounts', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const bankAccounts = await storage.getBankAccounts(accountId);
      res.json(bankAccounts);
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

  // Endpoint para buscar transações antigas com "Fatura" na descrição
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

  // Endpoint para deletar transações antigas de fatura em lote
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

  // Project routes
  app.get('/api/accounts/:accountId/projects', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const projects = await storage.getProjects(accountId);
      res.json(projects);
    } catch (error) {
      console.error('[GET /api/accounts/:accountId/projects]', error);
      res.status(500).json({ message: 'Failed to fetch projects' });
    }
  });

  app.get('/api/projects/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch project' });
    }
  });

  app.get('/api/projects/:id/stats', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const stats = await storage.getProjectStats(id);
      if (!stats) {
        return res.status(404).json({ message: 'Project not found' });
      }
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch project stats' });
    }
  });

  app.post('/api/accounts/:accountId/projects', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const validatedData = insertProjectSchema.parse({ ...req.body, accountId });
      const project = await storage.createProject(validatedData);
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid project data', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to create project' });
      }
    }
  });

  app.patch('/api/projects/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertProjectSchema.partial().parse(req.body);
      const project = await storage.updateProject(id, validatedData);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      res.json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid project data', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to update project' });
      }
    }
  });

  app.delete('/api/projects/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteProject(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete project' });
    }
  });

  // Cost Center routes
  app.get('/api/accounts/:accountId/cost-centers', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const costCenters = await storage.getCostCenters(accountId);
      res.json(costCenters);
    } catch (error) {
      console.error('[GET /api/accounts/:accountId/cost-centers]', error);
      res.status(500).json({ message: 'Failed to fetch cost centers' });
    }
  });

  app.get('/api/cost-centers/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const costCenter = await storage.getCostCenter(id);
      if (!costCenter) {
        return res.status(404).json({ message: 'Cost center not found' });
      }
      res.json(costCenter);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch cost center' });
    }
  });

  app.get('/api/cost-centers/:id/stats', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const stats = await storage.getCostCenterStats(id);
      if (!stats) {
        return res.status(404).json({ message: 'Cost center not found' });
      }
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch cost center stats' });
    }
  });

  app.post('/api/accounts/:accountId/cost-centers', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const validatedData = insertCostCenterSchema.parse({ ...req.body, accountId });
      const costCenter = await storage.createCostCenter(validatedData);
      res.status(201).json(costCenter);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid cost center data', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to create cost center' });
      }
    }
  });

  app.patch('/api/cost-centers/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertCostCenterSchema.partial().parse(req.body);
      const costCenter = await storage.updateCostCenter(id, validatedData);
      if (!costCenter) {
        return res.status(404).json({ message: 'Cost center not found' });
      }
      res.json(costCenter);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid cost center data', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to update cost center' });
      }
    }
  });

  app.delete('/api/cost-centers/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCostCenter(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete cost center' });
    }
  });

  // Client routes
  app.get('/api/accounts/:accountId/clients', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const clients = await storage.getClients(accountId);
      res.json(clients);
    } catch (error) {
      console.error('[GET /api/accounts/:accountId/clients]', error);
      res.status(500).json({ message: 'Failed to fetch clients' });
    }
  });

  app.get('/api/clients/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const client = await storage.getClient(id);
      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch client' });
    }
  });

  app.get('/api/clients/:id/with-projects', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const clientWithProjects = await storage.getClientWithProjects(id);
      if (!clientWithProjects) {
        return res.status(404).json({ message: 'Client not found' });
      }
      res.json(clientWithProjects);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch client with projects' });
    }
  });

  app.post('/api/accounts/:accountId/clients', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const validatedData = insertClientSchema.parse({ ...req.body, accountId });
      const client = await storage.createClient(validatedData);
      res.status(201).json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid client data', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to create client' });
      }
    }
  });

  app.patch('/api/clients/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertClientSchema.partial().parse(req.body);
      const client = await storage.updateClient(id, validatedData);
      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }
      res.json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid client data', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to update client' });
      }
    }
  });

  app.delete('/api/clients/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteClient(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete client' });
    }
  });

  // Delete all transactions route
  app.delete('/api/accounts/:accountId/transactions/all', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);

      // Deletar todas as transações (validação de propriedade já feita pelo middleware)
      const result = await storage.deleteAllTransactions(accountId);

      console.log(
        `[DELETE /api/accounts/${accountId}/transactions/all] Deleted ${result.deletedTransactions} transactions and ${result.deletedCreditCardTransactions} credit card transactions`
      );

      res.json({
        message: 'All transactions deleted successfully',
        deletedTransactions: result.deletedTransactions,
        deletedCreditCardTransactions: result.deletedCreditCardTransactions,
        totalDeleted: result.deletedTransactions + result.deletedCreditCardTransactions,
      });
    } catch (error) {
      console.error('[DELETE /api/accounts/:accountId/transactions/all]', error);
      res.status(500).json({ message: 'Failed to delete all transactions' });
    }
  });

  // Invoice Upload routes
  app.post('/api/invoice-upload', uploadInvoice);
  app.post('/api/invoice-upload-multiple', uploadMultipleInvoiceImages);
  app.post('/api/invoice-paste', pasteInvoiceImage);
  app.get('/api/invoice-imports/:creditCardId', getCardInvoiceImports);
  app.get('/api/invoice-import/:importId', getInvoiceImportDetail);
  app.post('/api/invoice-import/:importId/retry', retryInvoiceImport);

  const httpServer = createServer(app);
  return httpServer;
}
