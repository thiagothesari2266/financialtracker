import type { Express } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import express from 'express';
import { z } from 'zod';
import * as TransactionRepo from '../storage/transaction.repository';
import { prisma } from '../db';
import { validateAccountOwnership } from '../middleware/account-ownership';
import { insertTransactionSchema } from '@shared/schema';
import logger from '../lib/logger';

export function registerTransactionRoutes(app: Express) {
  // Receipt upload config
  const receiptsDir = path.join(process.cwd(), 'server/uploads/receipts');
  if (!fs.existsSync(receiptsDir)) {
    fs.mkdirSync(receiptsDir, { recursive: true });
  }

  const receiptStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, receiptsDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, `receipt-${uniqueSuffix}${ext}`);
    },
  });

  const receiptUpload = multer({
    storage: receiptStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
      cb(null, allowed.includes(file.mimetype));
    },
  });

  // Serve uploaded receipts
  app.use('/api/uploads/receipts', express.static(receiptsDir));

  app.get('/api/accounts/:accountId/transactions', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      let transactions;
      if (startDate && endDate) {
        transactions = await TransactionRepo.getTransactionsByDateRange(accountId, startDate, endDate);
      } else {
        transactions = await TransactionRepo.getTransactions(accountId, limit);
      }

      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch transactions' });
    }
  });

  app.get('/api/transactions/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const transaction = await TransactionRepo.getTransaction(id);
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
      const transaction = await TransactionRepo.createTransaction(validatedData);
      res.status(201).json(transaction);
    } catch (error) {
      logger.error({ err: error }, 'POST /api/accounts/:accountId/transactions');
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

  // Upload receipt for a transaction
  app.post('/api/transactions/:id/receipt', receiptUpload.single('receipt'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (!req.file) {
        return res.status(400).json({ message: 'Nenhum arquivo enviado' });
      }
      const receiptPath = req.file.filename;
      await prisma.transaction.update({
        where: { id },
        data: { receiptPath },
      });
      res.json({ receiptPath });
    } catch (error) {
      logger.error({ err: error }, 'POST /api/transactions/:id/receipt');
      res.status(500).json({ message: 'Erro ao salvar comprovante' });
    }
  });

  // Delete receipt from a transaction
  app.delete('/api/transactions/:id/receipt', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const transaction = await prisma.transaction.findUnique({ where: { id } });
      if (!transaction?.receiptPath) {
        return res.status(404).json({ message: 'Comprovante não encontrado' });
      }
      // Remove file from disk
      const filePath = path.join(receiptsDir, transaction.receiptPath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      await prisma.transaction.update({
        where: { id },
        data: { receiptPath: null },
      });
      res.json({ success: true });
    } catch (error) {
      logger.error({ err: error }, 'DELETE /api/transactions/:id/receipt');
      res.status(500).json({ message: 'Erro ao remover comprovante' });
    }
  });

  app.patch('/api/transactions/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // Permite campos extras para edição em lote
      const { editScope, installmentsGroupId, recurrenceGroupId, ...raw } = req.body;
      logger.debug({ id, editScope, installmentsGroupId, recurrenceGroupId, rawKeys: Object.keys(raw) }, 'PATCH /api/transactions/:id incoming');
      // Remove identificadores de grupo nulos/vazios para evitar falha de validação
      if (recurrenceGroupId === null || recurrenceGroupId === '') {
        delete (raw as any).recurrenceGroupId;
      }
      if (installmentsGroupId === null || installmentsGroupId === '') {
        delete (raw as any).installmentsGroupId;
      }
      // Converte campos numéricos que podem vir como string do frontend
      if (raw.creditCardId !== undefined && raw.creditCardId !== null) {
        raw.creditCardId = Number(raw.creditCardId) || null;
      }
      if (raw.categoryId !== undefined && raw.categoryId !== null) {
        raw.categoryId = Number(raw.categoryId);
      }
      if (raw.bankAccountId !== undefined && raw.bankAccountId !== null) {
        raw.bankAccountId = Number(raw.bankAccountId) || null;
      }
      const validatedData = insertTransactionSchema.partial().parse(raw);
      let transaction;
      if (editScope) {
        const scopedPayload: any = { ...validatedData, editScope };
        if (installmentsGroupId) scopedPayload.installmentsGroupId = installmentsGroupId;
        if (recurrenceGroupId) scopedPayload.recurrenceGroupId = recurrenceGroupId;
        transaction = await TransactionRepo.updateTransactionWithScope(id, scopedPayload);
      } else {
        transaction = await TransactionRepo.updateTransaction(id, validatedData);
      }
      if (!transaction) {
        return res.status(404).json({ message: 'Transação não encontrada' });
      }
      res.json(transaction);
    } catch (error) {
      logger.error({ err: error }, 'PATCH /api/transactions/:id');
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
        await TransactionRepo.deleteTransaction(id, { editScope, installmentsGroupId });
      } else {
        await TransactionRepo.deleteTransaction(id);
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete transaction' });
    }
  });

  // Delete all transactions
  app.delete('/api/accounts/:accountId/transactions/all', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);

      const result = await TransactionRepo.deleteAllTransactions(accountId);

      logger.info({ accountId, deletedTransactions: result.deletedTransactions, deletedCreditCardTransactions: result.deletedCreditCardTransactions }, 'DELETE all transactions');

      res.json({
        message: 'All transactions deleted successfully',
        deletedTransactions: result.deletedTransactions,
        deletedCreditCardTransactions: result.deletedCreditCardTransactions,
        totalDeleted: result.deletedTransactions + result.deletedCreditCardTransactions,
      });
    } catch (error) {
      logger.error({ err: error }, 'DELETE /api/accounts/:accountId/transactions/all');
      res.status(500).json({ message: 'Failed to delete all transactions' });
    }
  });
}
