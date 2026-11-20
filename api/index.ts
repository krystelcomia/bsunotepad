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

function normalizeVercelApiUrl(req: Request): void {
  const rawUrl = req.url || '/';
  // Preserve /api/... directly when Vercel rewrites /api/(.*) -> /api
  if (rawUrl.startsWith('/api/') || rawUrl === '/api' || rawUrl.startsWith('/api?')) {
    // Handle query-based rewrite fallback if Vercel forwarded ?__path=...
    const qIdx = rawUrl.indexOf('?');
    if (qIdx !== -1 && (rawUrl.slice(0, qIdx) === '/api' || rawUrl.slice(0, qIdx) === '/api/')) {
      const params = new URLSearchParams(rawUrl.slice(qIdx + 1));
      const matched = params.get('path') || params.get('__path');
      if (matched) {
        params.delete('path');
        params.delete('__path');
        const rest = params.toString();
        const cleanSub = matched.replace(/^\/+/, '');
        req.url = `/api/${cleanSub}${rest ? `?${rest}` : ''}`;
      }
    }
    return;
  }
  req.url = rawUrl.startsWith('/') ? `/api${rawUrl}` : `/api/${rawUrl}`;
}

export default function handler(req: Request, res: Response) {
  try {
    normalizeVercelApiUrl(req);
    const app = getApp();
    return app(req, res);
  } catch (err) {
    console.error('[INKORA Vercel Handler Error]', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Serverless function initialization failed',
    });
  }
}
