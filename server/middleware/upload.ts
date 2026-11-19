import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { AppConfig } from '../config.js';
import { AuthenticatedRequest } from '../types.js';
import { generateId } from '../utils/crypto.js';
import { sanitizeFilename } from '../utils/sanitize.js';

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.msi', '.dll', '.scr', '.ps1', '.vbs', '.com', '.pif', '.sh',
]);

const ALLOWED_AVATAR_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

export function createFileUploader(config: AppConfig) {
  const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.id || 'anonymous';
      const userDir = path.join(config.uploadsDir, userId);
      fs.mkdirSync(userDir, { recursive: true });
      cb(null, userDir);
    },
    filename: (_req, file, cb) => {
      const cleanName = sanitizeFilename(file.originalname);
      const ext = path.extname(cleanName);
      const stem = path.basename(cleanName, ext).slice(0, 64);
      cb(null, `${generateId()}-${stem}${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: config.maxFileSizeBytes },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      if (BLOCKED_EXTENSIONS.has(ext)) {
        cb(new Error('Executable file types are not permitted for security reasons.'));
        return;
      }
      cb(null, true);
    },
  });
}

export function createAvatarUploader(config: AppConfig) {
  const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.id || 'anonymous';
      const userDir = path.join(config.avatarsDir, userId);
      fs.mkdirSync(userDir, { recursive: true });
      cb(null, userDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '.png').toLowerCase() || '.png';
      const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) ? ext : '.png';
      cb(null, `avatar-${generateId()}${safeExt}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: config.maxAvatarSizeBytes },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_AVATAR_MIME.has((file.mimetype || '').toLowerCase())) {
        cb(new Error('Avatar must be a PNG, JPG, WEBP, or GIF image.'));
        return;
      }
      cb(null, true);
    },
  });
}
