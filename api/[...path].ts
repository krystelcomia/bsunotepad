import type { Request, Response } from 'express';
import { createApp } from '../server/app.js';
import { getConfig } from '../server/config.js';

let cachedApp: ReturnType<typeof createApp>['app'] | null = null;

function getApp() {
  if (!cachedApp) {
    const config = getConfig();
    cachedApp = createApp(config, { seedDemo: true, serveStatic: false }).app;
  }
  return cachedApp;
}

export default function handler(req: Request, res: Response) {
  try {
    const app = getApp();
    return app(req, res);
  } catch (err) {
    console.error('[INKORA Vercel Handler Error]', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Serverless function initialization failed',
    });
  }
}
