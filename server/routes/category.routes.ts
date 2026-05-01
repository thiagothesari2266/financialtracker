import type { Express } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { currentMonthBR } from '../utils/date-br';
import { validateAccountOwnership } from '../middleware/account-ownership';
import { insertCategorySchema } from '@shared/schema';
import logger from '../lib/logger';

export function registerCategoryRoutes(app: Express) {
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
      const month = (req.query.month as string) || currentMonthBR();
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
      logger.debug({ id, body: req.body }, 'PATCH /api/categories/:id');
      const validatedData = insertCategorySchema.partial().parse(req.body);
      if (!validatedData || Object.keys(validatedData).length === 0) {
        return res.status(400).json({ message: 'Nenhum campo para atualizar' });
      }
      const category = await storage.updateCategory(id, validatedData);
      if (!category) {
        logger.debug({ id }, 'PATCH /api/categories/:id: category not found');
        return res.status(404).json({ message: 'Category not found' });
      }
      res.json(category);
    } catch (error) {
      logger.error({ err: error }, 'PATCH /api/categories/:id');
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to update category' });
    }
  });

  app.delete('/api/categories/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      logger.debug({ id }, 'DELETE /api/categories/:id');
      await storage.deleteCategory(id);
      res.status(204).send();
    } catch (error) {
      logger.error({ err: error }, 'DELETE /api/categories/:id');
      res.status(500).json({ message: 'Failed to delete category' });
    }
  });
}
