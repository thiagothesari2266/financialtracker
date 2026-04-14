import type { Express } from 'express';
import { storage } from '../storage';
import { validateAccountOwnership } from '../middleware/account-ownership';
import { AIFinancialAdvisor } from '../services/ai-financial-advisor';
import { aiChatRateLimit, createRateLimitMiddleware } from '../middleware/rate-limit';

export function registerAiAdvisorRoutes(app: Express) {
  app.get('/api/accounts/:id/financial-summary', validateAccountOwnership, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.session.userId!;
      const context = await AIFinancialAdvisor.getFinancialContext(id, userId);
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

        const userId = req.session.userId!;
        const response = await AIFinancialAdvisor.analyzeFinances(
          id,
          userId,
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
}
