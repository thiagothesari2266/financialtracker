import type { Express } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { prisma } from '../db';
import { syncBankAccount } from '../services/asaas-sync';
import type { AsaasImportDirection } from '@shared/schema';

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

// ---- Helper: buscar ou criar categoria "Asaas" por direcao ----

async function getOrCreateAsaasCategory(
  accountId: number,
  direction: AsaasImportDirection,
): Promise<number> {
  const categories = await storage.getCategories(accountId);
  let category = categories.find(c => c.name === 'Asaas' && c.type === direction);
  if (!category) {
    category = await storage.createCategory({
      name: 'Asaas',
      color: direction === 'income' ? '#3b82f6' : '#ef4444',
      icon: 'Landmark',
      type: direction,
      accountId,
    });
  }
  return category.id;
}

// ---- Ações atômicas por import ----

async function applyMatch(importId: number, transactionId: number): Promise<void> {
  const asaasImport = await storage.getAsaasImportById(importId);
  if (!asaasImport) throw new Error(`Import ${importId} não encontrado`);

  const externalId = asaasImport.asaasPaymentId ?? asaasImport.asaasTransactionId ?? null;

  await storage.updateTransaction(transactionId, {
    paid: true,
    externalId,
    paymentMethod: asaasImport.billingType ?? null,
  });

  await storage.updateAsaasImport(importId, {
    status: 'matched',
    matchedTransactionId: transactionId,
    resolvedAt: new Date().toISOString(),
  });
}

async function applyStandalone(importId: number): Promise<void> {
  const asaasImport = await storage.getAsaasImportById(importId);
  if (!asaasImport) throw new Error(`Import ${importId} não encontrado`);

  const direction = asaasImport.direction ?? 'income';
  const categoryId = await getOrCreateAsaasCategory(asaasImport.accountId, direction);

  const transactionDate = (asaasImport.isPaid && asaasImport.paymentDate)
    ? asaasImport.paymentDate
    : asaasImport.dueDate;

  const fallbackByDirection = direction === 'expense' ? 'Saída Asaas' : 'Recebimento Asaas';
  const description = asaasImport.description
    || (asaasImport.externalReference ? `Pedido ${asaasImport.externalReference}` : fallbackByDirection);

  const externalId = asaasImport.asaasPaymentId ?? asaasImport.asaasTransactionId ?? null;

  const created = await storage.createTransaction({
    description,
    amount: String(asaasImport.amount),
    type: direction,
    date: String(transactionDate),
    categoryId,
    accountId: asaasImport.accountId,
    bankAccountId: asaasImport.bankAccountId ?? null,
    paid: asaasImport.isPaid,
    paymentMethod: asaasImport.billingType ?? null,
    externalId,
    isException: false,
  });

  await storage.updateAsaasImport(importId, {
    status: 'standalone',
    matchedTransactionId: created.id,
    resolvedAt: new Date().toISOString(),
  });
}

async function applyIgnore(importId: number): Promise<void> {
  await storage.updateAsaasImport(importId, {
    status: 'ignored',
    resolvedAt: new Date().toISOString(),
  });
}

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
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ message: 'Conta não encontrada' });
      }
      if (account.userId !== userId) {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      const imports = await storage.getAsaasImports(accountId, status, direction);
      res.json(imports);
    } catch (error) {
      console.error('[GET /api/asaas-imports]', error);
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

      const asaasImport = await storage.getAsaasImportById(importId);
      if (!asaasImport) {
        return res.status(404).json({ message: 'Import não encontrado' });
      }

      // Verificar propriedade da conta
      const account = await storage.getAccount(asaasImport.accountId);
      if (!account || account.userId !== userId) {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      await applyMatch(importId, parsed.data.transactionId);

      res.json({ success: true, action: 'matched', importId, transactionId: parsed.data.transactionId });
    } catch (error) {
      console.error('[POST /api/asaas-imports/:id/confirm-match]', error);
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

      const asaasImport = await storage.getAsaasImportById(importId);
      if (!asaasImport) {
        return res.status(404).json({ message: 'Import não encontrado' });
      }

      const account = await storage.getAccount(asaasImport.accountId);
      if (!account || account.userId !== userId) {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      await applyStandalone(importId);

      const updated = await storage.getAsaasImportById(importId);
      res.json({ success: true, action: 'standalone', importId, transactionId: updated?.matchedTransactionId });
    } catch (error) {
      console.error('[POST /api/asaas-imports/:id/create-standalone]', error);
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

      const asaasImport = await storage.getAsaasImportById(importId);
      if (!asaasImport) {
        return res.status(404).json({ message: 'Import não encontrado' });
      }

      const account = await storage.getAccount(asaasImport.accountId);
      if (!account || account.userId !== userId) {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      await applyIgnore(importId);

      res.json({ success: true, action: 'ignored', importId });
    } catch (error) {
      console.error('[POST /api/asaas-imports/:id/ignore]', error);
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

      const account = await storage.getAccount(bankAccount.accountId);
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
      console.error('[POST /api/bank-accounts/:id/asaas-sync]', error);
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

      const summary = { matched: 0, standalone: 0, ignored: 0, errors: [] as { id: number; error: string }[] };

      await prisma.$transaction(async () => {
        for (const item of parsed.data.items) {
          try {
            const asaasImport = await storage.getAsaasImportById(item.id);
            if (!asaasImport) {
              summary.errors.push({ id: item.id, error: 'Import não encontrado' });
              continue;
            }

            const account = await storage.getAccount(asaasImport.accountId);
            if (!account || account.userId !== userId) {
              summary.errors.push({ id: item.id, error: 'Acesso negado' });
              continue;
            }

            if (item.action === 'match') {
              if (!item.transactionId) {
                summary.errors.push({ id: item.id, error: 'transactionId obrigatório para action=match' });
                continue;
              }
              await applyMatch(item.id, item.transactionId);
              summary.matched++;
            } else if (item.action === 'standalone') {
              await applyStandalone(item.id);
              summary.standalone++;
            } else if (item.action === 'ignore') {
              await applyIgnore(item.id);
              summary.ignored++;
            }
          } catch (itemError) {
            summary.errors.push({
              id: item.id,
              error: itemError instanceof Error ? itemError.message : 'Erro desconhecido',
            });
          }
        }
      });

      res.json({ success: true, summary });
    } catch (error) {
      console.error('[POST /api/asaas-imports/bulk-resolve]', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
      }
      res.status(500).json({ message: 'Erro ao processar bulk-resolve' });
    }
  });
}
