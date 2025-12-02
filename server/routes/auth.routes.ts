import type { Express } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { storage } from "../storage";
import { insertUserSchema, loginSchema } from "@shared/schema";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/register", async (req, res) => {
    try {
      const payload = insertUserSchema.parse({
        email: normalizeEmail(String(req.body.email ?? "")),
        password: String(req.body.password ?? ""),
      });

      const existing = await storage.getUserByEmail(payload.email);
      if (existing) {
        return res.status(409).json({ message: "Usuário já cadastrado" });
      }

      const user = await storage.createUser(payload);
      req.session.userId = user.id;
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("[POST /api/auth/register]", error);
      res.status(500).json({ message: "Falha ao registrar" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const payload = loginSchema.parse({
        email: normalizeEmail(String(req.body.email ?? "")),
        password: String(req.body.password ?? ""),
      });

      const userWithPassword = await storage.getUserByEmail(payload.email);
      if (!userWithPassword) {
        return res.status(401).json({ message: "Credenciais inválidas" });
      }

      const isValid = await bcrypt.compare(payload.password, userWithPassword.passwordHash);
      if (!isValid) {
        return res.status(401).json({ message: "Credenciais inválidas" });
      }

      req.session.userId = userWithPassword.id;
      const { passwordHash: _passwordHash, ...user } = userWithPassword;
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("[POST /api/auth/login]", error);
      res.status(500).json({ message: "Falha ao autenticar" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    if (!req.session) {
      return res.status(204).send();
    }

    req.session.destroy((err) => {
      if (err) {
        console.error("[POST /api/auth/logout]", err);
        return res.status(500).json({ message: "Falha ao encerrar sessão" });
      }
      res.clearCookie("connect.sid");
      return res.status(204).send();
    });
  });

  app.get("/api/auth/session", async (req, res) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const user = await storage.getUserById(req.session.userId);
      if (!user) {
        req.session.destroy(() => undefined);
        return res.status(401).json({ message: "Sessão inválida" });
      }

      res.json(user);
    } catch (error) {
      console.error("[GET /api/auth/session]", error);
      res.status(500).json({ message: "Falha ao carregar sessão" });
    }
  });
}
