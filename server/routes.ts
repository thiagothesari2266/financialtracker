import type { Express } from 'express';
import { createServer, type Server } from 'http';
import {
  uploadInvoice,
  uploadMultipleInvoiceImages,
  pasteInvoiceImage,
  getCardInvoiceImports,
  getInvoiceImportDetail,
  retryInvoiceImport,
} from './routes/invoice-upload.routes';
import { handleAsaasWebhook } from './routes/asaas-webhook.routes';
import { registerAccountRoutes } from './routes/account.routes';
import { registerTransactionRoutes } from './routes/transaction.routes';
import { registerCategoryRoutes } from './routes/category.routes';
import { registerCreditCardRoutes } from './routes/credit-card.routes';
import { registerBankAccountRoutes } from './routes/bank-account.routes';
import { registerInvoiceManagementRoutes } from './routes/invoice-management.routes';
import { registerBusinessEntityRoutes } from './routes/business-entity.routes';
import { registerAiAdvisorRoutes } from './routes/ai-advisor.routes';

export async function registerRoutes(app: Express): Promise<Server> {
  // Domain routes
  registerAccountRoutes(app);
  registerCategoryRoutes(app);
  registerTransactionRoutes(app);
  registerCreditCardRoutes(app);
  registerBankAccountRoutes(app);
  registerInvoiceManagementRoutes(app);
  registerBusinessEntityRoutes(app);
  registerAiAdvisorRoutes(app);

  // Invoice upload routes
  app.post('/api/invoice-upload', uploadInvoice);
  app.post('/api/invoice-upload-multiple', uploadMultipleInvoiceImages);
  app.post('/api/invoice-paste', pasteInvoiceImage);
  app.get('/api/invoice-imports/:creditCardId', getCardInvoiceImports);
  app.get('/api/invoice-import/:importId', getInvoiceImportDetail);
  app.post('/api/invoice-import/:importId/retry', retryInvoiceImport);

  // Webhook externo do Asaas
  app.post('/api/webhooks/asaas', handleAsaasWebhook);

  const httpServer = createServer(app);
  return httpServer;
}
