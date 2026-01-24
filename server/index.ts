import 'dotenv/config';
import express, { type Request, Response, NextFunction } from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { registerRoutes } from './routes';
import { registerAuthRoutes } from './routes/auth.routes';
import { setupVite, serveStatic, log } from './vite';

const shouldLogRequests = process.env.LOG_REQUESTS === 'true';

const app = express();
// Necessário para cookies "secure" funcionarem atrás do Nginx/Cloudflare
// (usa X-Forwarded-Proto para detectar HTTPS)
app.set('trust proxy', 1);
const PgSession = connectPgSimple(session);
// Increase request size limits for image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

const sessionSecret = process.env.SESSION_SECRET ?? 'change-me';

app.use(
  session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 dias
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE !== 'false', // false para Cloudflare Flexible
    },
  })
);

if (shouldLogRequests) {
  // Middleware global para logar todas as requisições recebidas
  app.use((req, res, next) => {
    console.log(`[${req.method}] ${req.originalUrl} - body:`, req.body);
    next();
  });

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on('finish', () => {
      const duration = Date.now() - start;
      if (path.startsWith('/api')) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + '…';
        }

        log(logLine);
      }
    });

    next();
  });
}

registerAuthRoutes(app);

app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) {
    return next();
  }

  if (req.path.startsWith('/api/auth')) {
    return next();
  }

  if (req.session?.userId) {
    return next();
  }

  return res.status(401).json({ message: 'Não autenticado' });
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    if (process.env.NODE_ENV === 'production') {
      console.error('[error]', err);
      return res.status(status).json({ message });
    }

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get('env') === 'development') {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen(port, '0.0.0.0', () => {
    log(`serving on port ${port}`);
  });
})();
