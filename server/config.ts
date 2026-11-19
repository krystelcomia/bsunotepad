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
  sessionTtlMs: number;
  maxFileSizeBytes: number;
  maxAvatarSizeBytes: number;
  defaultStorageQuotaBytes: number;
  isProduction: boolean;
}

export function getConfig(): AppConfig {
  const dataDir = process.env.INKORA_DATA_DIR
    ? path.resolve(process.env.INKORA_DATA_DIR)
    : path.resolve(process.cwd(), 'data');

  const storageDir = process.env.INKORA_STORAGE_DIR
    ? path.resolve(process.env.INKORA_STORAGE_DIR)
    : path.resolve(process.cwd(), 'storage');

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
    sessionTtlMs: 14 * 24 * 60 * 60 * 1000,
    maxFileSizeBytes: 20 * 1024 * 1024, // 20 MB
    maxAvatarSizeBytes: 5 * 1024 * 1024, // 5 MB
    defaultStorageQuotaBytes: 250 * 1024 * 1024, // 250 MB per student
    isProduction: process.env.NODE_ENV === 'production',
  };
}
