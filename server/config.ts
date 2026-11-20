import fs from 'node:fs';
import path from 'node:path';

export interface AppConfig {
  port: number;
  dataDir: string;
  storageDir: string;
  uploadsDir: string;
  avatarsDir: string;
  dbPath: string;
  sessionCookieName: string;
  refreshCookieName: string;
  sessionTtlMs: number;
  refreshTtlMs: number;
  emailTokenTtlMs: number;
  maxFileSizeBytes: number;
  maxAvatarSizeBytes: number;
  defaultStorageQuotaBytes: number;
  isProduction: boolean;
}

export function getConfig(): AppConfig {
  const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
  const defaultBase = isVercel ? path.join('/tmp', 'inkora') : process.cwd();

  const dataDir = process.env.INKORA_DATA_DIR
    ? path.resolve(process.env.INKORA_DATA_DIR)
    : path.join(defaultBase, 'data');

  const storageDir = process.env.INKORA_STORAGE_DIR
    ? path.resolve(process.env.INKORA_STORAGE_DIR)
    : path.join(defaultBase, 'storage');

  const uploadsDir = path.join(storageDir, 'uploads');
  const avatarsDir = path.join(storageDir, 'avatars');

  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(avatarsDir, { recursive: true });

  return {
    port: Number(process.env.PORT) || 3001,
    dataDir,
    storageDir,
    uploadsDir,
    avatarsDir,
    dbPath: path.join(dataDir, 'inkora.db'),
    sessionCookieName: 'inkora_session',
    refreshCookieName: 'inkora_refresh',
    sessionTtlMs: 2 * 60 * 60 * 1000, // 2 hours active access session
    refreshTtlMs: 30 * 24 * 60 * 60 * 1000, // 30 days persistent refresh token
    emailTokenTtlMs: 15 * 60 * 1000, // 15 minutes OTP / verification link
    maxFileSizeBytes: isVercel ? 4 * 1024 * 1024 : 20 * 1024 * 1024, // 4 MB on Vercel serverless, 20 MB standalone
    maxAvatarSizeBytes: isVercel ? 3 * 1024 * 1024 : 5 * 1024 * 1024,
    defaultStorageQuotaBytes: 250 * 1024 * 1024, // 250 MB per student
    isProduction: process.env.NODE_ENV === 'production',
  };
}
