import type { Express } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { storage } from '../storage';
import { registerWithInviteSchema, loginSchema, createInviteSchema } from '@shared/schema';
import { sendInviteEmail } from '../services/email.service';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function registerAuthRoutes(app: Express) {
  // Registro apenas via convite
  app.post('/api/auth/register', async (req, res) => {
    try {
      const payload = registerWithInviteSchema.parse({
        email: normalizeEmail(String(req.body.email ?? '')),
        password: String(req.body.password ?? ''),
        inviteToken: String(req.body.inviteToken ?? ''),
      });

      // Verificar convite
      const invite = await storage.getInviteByToken(payload.inviteToken);
      if (!invite) {
        return res.status(400).json({ message: 'Convite inválido' });
      }

      if (invite.status !== 'pending') {
        return res.status(400).json({ message: 'Convite já foi utilizado' });
      }

      if (new Date(invite.expiresAt) < new Date()) {
        return res.status(400).json({ message: 'Convite expirado' });
      }

      if (invite.email !== payload.email) {
        return res.status(400).json({ message: 'Email não corresponde ao convite' });
      }

      const existing = await storage.getUserByEmail(payload.email);
      if (existing) {
        return res.status(409).json({ message: 'Usuário já cadastrado' });
      }

      // Criar usuário e marcar convite como aceito
      const user = await storage.createUserWithRole(payload.email, payload.password, 'user');
      await storage.acceptInvite(payload.inviteToken);

      req.session.userId = user.id;
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
      }
      console.error('[POST /api/auth/register]', error);
      res.status(500).json({ message: 'Falha ao registrar' });
    }
  });

  // Verificar convite (para preencher email no form)
  app.get('/api/auth/invite/:token', async (req, res) => {
    try {
      const invite = await storage.getInviteByToken(req.params.token);
      if (!invite) {
        return res.status(404).json({ message: 'Convite não encontrado' });
      }

      if (invite.status !== 'pending') {
        return res.status(400).json({ message: 'Convite já foi utilizado' });
      }

      if (new Date(invite.expiresAt) < new Date()) {
        return res.status(400).json({ message: 'Convite expirado' });
      }

      res.json({ email: invite.email, expiresAt: invite.expiresAt });
    } catch (error) {
      console.error('[GET /api/auth/invite/:token]', error);
      res.status(500).json({ message: 'Falha ao verificar convite' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const payload = loginSchema.parse({
        email: normalizeEmail(String(req.body.email ?? '')),
        password: String(req.body.password ?? ''),
      });

      const userWithPassword = await storage.getUserByEmail(payload.email);
      if (!userWithPassword) {
        return res.status(401).json({ message: 'Credenciais inválidas' });
      }

      const isValid = await bcrypt.compare(payload.password, userWithPassword.passwordHash);
      if (!isValid) {
        return res.status(401).json({ message: 'Credenciais inválidas' });
      }

      req.session.userId = userWithPassword.id;
      const { passwordHash: _passwordHash, ...user } = userWithPassword;
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
      }
      console.error('[POST /api/auth/login]', error);
      res.status(500).json({ message: 'Falha ao autenticar' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    if (!req.session) {
      return res.status(204).send();
    }

    req.session.destroy((err) => {
      if (err) {
        console.error('[POST /api/auth/logout]', err);
        return res.status(500).json({ message: 'Falha ao encerrar sessão' });
      }
      res.clearCookie('connect.sid');
      return res.status(204).send();
    });
  });

  app.get('/api/auth/session', async (req, res) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: 'Não autenticado' });
      }

      const user = await storage.getUserById(req.session.userId);
      if (!user) {
        req.session.destroy(() => undefined);
        return res.status(401).json({ message: 'Sessão inválida' });
      }

      res.json(user);
    } catch (error) {
      console.error('[GET /api/auth/session]', error);
      res.status(500).json({ message: 'Falha ao carregar sessão' });
    }
  });

  // ========== ADMIN ROUTES ==========

  // Middleware para verificar se é admin
  const requireAdmin = async (req: any, res: any, next: any) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: 'Não autenticado' });
    }

    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    next();
  };

  // Criar convite (apenas admin)
  app.post('/api/admin/invites', requireAdmin, async (req, res) => {
    try {
      const payload = createInviteSchema.parse({
        email: normalizeEmail(String(req.body.email ?? '')),
      });

      // Verificar se já existe usuário com esse email
      const existingUser = await storage.getUserByEmail(payload.email);
      if (existingUser) {
        return res.status(409).json({ message: 'Usuário já cadastrado com esse email' });
      }

      // Verificar se já existe convite pendente
      const existingInvite = await storage.getInviteByEmail(payload.email);
      if (existingInvite) {
        return res.status(409).json({ message: 'Já existe um convite pendente para esse email' });
      }

      const invite = await storage.createInvite(payload.email, req.session!.userId as number);

      // Enviar email de convite
      const emailResult = await sendInviteEmail(payload.email, invite.token);

      res.status(201).json({
        ...invite,
        emailSent: emailResult.success,
        emailError: emailResult.error,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Email inválido', errors: error.errors });
      }
      console.error('[POST /api/admin/invites]', error);
      res.status(500).json({ message: 'Falha ao criar convite' });
    }
  });

  // Listar convites (apenas admin)
  app.get('/api/admin/invites', requireAdmin, async (_req, res) => {
    try {
      const invites = await storage.getInvites();
      res.json(invites);
    } catch (error) {
      console.error('[GET /api/admin/invites]', error);
      res.status(500).json({ message: 'Falha ao listar convites' });
    }
  });

  // Deletar convite (apenas admin)
  app.delete('/api/admin/invites/:id', requireAdmin, async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: 'ID inválido' });
      }

      await storage.deleteInvite(id);
      res.status(204).send();
    } catch (error) {
      console.error('[DELETE /api/admin/invites/:id]', error);
      res.status(500).json({ message: 'Falha ao deletar convite' });
    }
  });
}
