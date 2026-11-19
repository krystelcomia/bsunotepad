import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express, { Express, NextFunction, Request, Response } from 'express';
import { AppConfig } from './config.js';
import { createDatabase, InkoraDatabase } from './db/database.js';
import { ensureDemoUser } from './db/seed.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { createAccountRouter } from './routes/account.js';
import { createAuthRouter } from './routes/auth.js';
import { createFilesRouter } from './routes/files.js';
import { createNotebooksRouter } from './routes/notebooks.js';
import { createNotesRouter } from './routes/notes.js';
import { createStudyRouter } from './routes/study.js';
import { createWorkspaceRouter } from './routes/workspace.js';

export interface AppInstance {
  app: Express;
  db: InkoraDatabase;
  config: AppConfig;
}

export function createApp(
  config: AppConfig,
  options?: { seedDemo?: boolean; staticDir?: string; serveStatic?: boolean }
): AppInstance {
  const db = createDatabase(config);
  if (options?.seedDemo !== false) {
    ensureDemoUser(db);
  }

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(cookieParser());
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  const requireAuth = createAuthMiddleware(db, config);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'inkora', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', createAuthRouter(db, config, requireAuth));
  app.use('/api/account', createAccountRouter(db, config, requireAuth));
  app.use('/api/workspace', createWorkspaceRouter(db, requireAuth));
  app.use('/api/notebooks', createNotebooksRouter(db, requireAuth));

  const { notesRouter, sharedRouter } = createNotesRouter(db, requireAuth);
  app.use('/api/notes', notesRouter);
  app.use('/api/shared', sharedRouter);

  app.use('/api/files', createFilesRouter(db, config, requireAuth));
  app.use('/api/study', createStudyRouter(db, requireAuth));

  // Production static SPA serving if built client exists (disabled on Vercel Edge CDN)
  const shouldServeStatic =
    options?.serveStatic ?? !Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
  const staticDir = options?.staticDir || path.resolve(process.cwd(), 'dist', 'client');
  if (shouldServeStatic && fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      const indexFile = path.join(staticDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        next();
      }
    });
  }

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[INKORA Error]', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return { app, db, config };
}
