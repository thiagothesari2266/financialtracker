import type { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
  }
}

export const validateAccountOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const accountId = parseInt(req.params.accountId || req.params.id);
  const userId = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Não autenticado' });
  }

  if (!accountId || isNaN(accountId)) {
    return next(); // Não é rota de conta específica
  }

  const account = await storage.getAccount(accountId);
  if (!account) {
    return res.status(404).json({ message: 'Account not found' });
  }

  if (account.userId !== userId) {
    return res.status(403).json({ message: 'Acesso negado' });
  }

  // Anexa account ao request para uso posterior
  (req as any).account = account;
  next();
};
