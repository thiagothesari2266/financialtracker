import type { Express } from 'express';
import { z } from 'zod';
import * as AccountRepo from '../storage/account.repository';
import * as AsaasImportRepo from '../storage/asaas-import.repository';
import { prisma } from '../db';
import { syncBankAccount } from '../services/asaas-sync';
import {
  applyMatch,
  applyStandalone,
  applyIgnore,
  bulkResolveImports,
} from '../services/asaas-import.service';
import logger from '../lib/logger';

// ---- Schemas de validação ----

const confirmMatchSchema = z.object({
  transactionId: z.number().int().positive(),
});

const bulkResolveItemSchema = z.object({
  id: z.number().int().positive(),
  action: z.enum(['match', 'standalone', 'ignore']),
  transactionId: z.number().int().positive().optional(),
});

const bulkResolveSchema = z.object({
  items: z.array(bulkResolveItemSchema).min(1),
});

// ---- Registro de rotas ----

export function registerAsaasImportsRoutes(app: Express) {
  // GET /api/asaas-imports?status=pending
  app.get('/api/asaas-imports', async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Não autenticado' });
      }

      const accountId = req.query.accountId ? parseInt(req.query.accountId as string) : undefined;
      const status = req.query.status as string | undefined;
      const directionParam = req.query.direction as string | undefined;
      const direction = directionParam === 'income' || directionParam === 'expense' ? directionParam : undefined;

      if (!accountId) {
        return res.status(400).json({ message: 'accountId é obrigatório' });
      }

      // Verificar propriedade da conta
      const account = await AccountRepo.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ message: 'Conta não encontrada' });
      }
      if (account.userId !== userId) {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      const imports = await AsaasImportRepo.getAsaasImports(accountId, status, direction);
      res.json(imports);
    } catch (error) {
      logger.error({ err: error }, 'GET /api/asaas-imports');
      res.status(500).json({ message: 'Erro ao buscar imports' });
    }
  });

  // POST /api/asaas-imports/:id/confirm-match
  app.post('/api/asaas-imports/:id/confirm-match', async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Não autenticado' });
      }

      const importId = parseInt(req.params.id);
      if (isNaN(importId)) {
        return res.status(400).json({ message: 'ID inválido' });
      }

      const parsed = confirmMatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Dados inválidos', errors: parsed.error.errors });
      }

      const asaasImport = await AsaasImportRepo.getAsaasImportById(importId);
      if (!asaasImport) {
        return res.status(404).json({ message: 'Import não encontrado' });
      }

      // Verificar propriedade da conta
      const account = await AccountRepo.getAccount(asaasImport.accountId);
      if (!account || account.userId !== userId) {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      await applyMatch(importId, parsed.data.transactionId);

      res.json({ success: true, action: 'matched', importId, transactionId: parsed.data.transactionId });
    } catch (error) {
      logger.error({ err: error }, 'POST /api/asaas-imports/:id/confirm-match');
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
      }
      res.status(500).json({ message: 'Erro ao confirmar match' });
    }
  });

  // POST /api/asaas-imports/:id/create-standalone
  app.post('/api/asaas-imports/:id/create-standalone', async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Não autenticado' });
      }

      const importId = parseInt(req.params.id);
      if (isNaN(importId)) {
        return res.status(400).json({ message: 'ID inválido' });
      }

      const asaasImport = await AsaasImportRepo.getAsaasImportById(importId);
      if (!asaasImport) {
        return res.status(404).json({ message: 'Import não encontrado' });
      }

      const account = await AccountRepo.getAccount(asaasImport.accountId);
      if (!account || account.userId !== userId) {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      await applyStandalone(importId);

      const updated = await AsaasImportRepo.getAsaasImportById(importId);
      res.json({ success: true, action: 'standalone', importId, transactionId: updated?.matchedTransactionId });
    } catch (error) {
      logger.error({ err: error }, 'POST /api/asaas-imports/:id/create-standalone');
      res.status(500).json({ message: 'Erro ao criar transação standalone' });
    }
  });

  // POST /api/asaas-imports/:id/ignore
  app.post('/api/asaas-imports/:id/ignore', async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Não autenticado' });
      }

      const importId = parseInt(req.params.id);
      if (isNaN(importId)) {
        return res.status(400).json({ message: 'ID inválido' });
      }

      const asaasImport = await AsaasImportRepo.getAsaasImportById(importId);
      if (!asaasImport) {
        return res.status(404).json({ message: 'Import não encontrado' });
      }

      const account = await AccountRepo.getAccount(asaasImport.accountId);
      if (!account || account.userId !== userId) {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      await applyIgnore(importId);

      res.json({ success: true, action: 'ignored', importId });
    } catch (error) {
      logger.error({ err: error }, 'POST /api/asaas-imports/:id/ignore');
      res.status(500).json({ message: 'Erro ao ignorar import' });
    }
  });

  // POST /api/bank-accounts/:id/asaas-sync
  app.post('/api/bank-accounts/:id/asaas-sync', async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Não autenticado' });
      }

      const bankAccountId = parseInt(req.params.id);
      if (isNaN(bankAccountId)) {
        return res.status(400).json({ message: 'ID inválido' });
      }

      const bankAccount = await prisma.bankAccount.findUnique({ where: { id: bankAccountId } });
      if (!bankAccount) {
        return res.status(404).json({ message: 'Conta bancária não encontrada' });
      }

      const account = await AccountRepo.getAccount(bankAccount.accountId);
      if (!account || account.userId !== userId) {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      if (!bankAccount.asaasApiKey) {
        return res.status(400).json({ message: 'Conta sem integração Asaas (apiKey ausente)' });
      }

      const sinceDaysRaw = req.body?.sinceDays;
      const sinceDays = typeof sinceDaysRaw === 'number' && sinceDaysRaw > 0 && sinceDaysRaw <= 365
        ? Math.floor(sinceDaysRaw)
        : 90;

      const result = await syncBankAccount(bankAccountId, sinceDays);
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error({ err: error }, 'POST /api/bank-accounts/:id/asaas-sync');
      const message = error instanceof Error ? error.message : 'Erro ao sincronizar';
      res.status(500).json({ message });
    }
  });

  // POST /api/asaas-imports/bulk-resolve
  // IMPORTANTE: esta rota deve vir ANTES de /:id/* para não capturar "bulk-resolve" como :id
  app.post('/api/asaas-imports/bulk-resolve', async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Não autenticado' });
      }

      const parsed = bulkResolveSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Dados inválidos', errors: parsed.error.errors });
      }

      const summary = await bulkResolveImports(parsed.data.items, userId);

      res.json({ success: true, summary });
    } catch (error) {
      logger.error({ err: error }, 'POST /api/asaas-imports/bulk-resolve');
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
      }
      res.status(500).json({ message: 'Erro ao processar bulk-resolve' });
    }
  });
}
