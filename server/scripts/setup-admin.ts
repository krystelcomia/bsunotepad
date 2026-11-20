import { getConfig } from '../config.js';
import { createDatabase } from '../db/database.js';
import { generateId, hashPassword } from '../utils/crypto.js';
import { isValidGmailAddress, normalizeGmail, validatePasswordStrength } from '../utils/gmail.js';

function main() {
  const email = normalizeGmail(process.env.INKORA_ADMIN_EMAIL || process.argv[2] || '');
  const password = process.env.INKORA_ADMIN_PASSWORD || process.argv[3] || '';
  const fullName = (process.env.INKORA_ADMIN_NAME || process.argv[4] || 'INKORA Administrator').trim();

  if (!isValidGmailAddress(email)) {
    console.error('Usage: INKORA_ADMIN_EMAIL=<name@gmail.com> INKORA_ADMIN_PASSWORD=<strong-password> npm run setup:admin');
    process.exit(1);
  }

  const pwError = validatePasswordStrength(password);
  if (pwError) {
    console.error(`Invalid password: ${pwError}`);
    process.exit(1);
  }

  const config = getConfig();
  const db = createDatabase(config);

  try {
    const existing = db
      .prepare('SELECT id, role FROM users WHERE LOWER(email) = ?')
      .get(email) as { id: string; role: string } | undefined;

    const now = new Date().toISOString();
    const passwordHash = hashPassword(password);

    if (existing) {
      db.prepare(
        `UPDATE users
         SET role = 'admin', email_verified = 1, status = 'active', status_reason = '',
             password_hash = ?, full_name = ?, updated_at = ?
         WHERE id = ?`
      ).run(passwordHash, fullName, now, existing.id);
      console.log(`Updated existing account "${email}" as Administrator.`);
    } else {
      db.prepare(
        `INSERT INTO users (
          id, email, email_verified, password_hash, role, status, status_reason, full_name,
          university, major, academic_year, bio, theme_preference, workspace_accent,
          storage_quota_bytes, is_demo, last_login_at, login_count, created_at, updated_at
        ) VALUES (?, ?, 1, ?, 'admin', 'active', '', ?, 'INKORA Operasyon ng Platform', 'Pangangasiwa', 'Kawani', '', 'light', 'blue', ?, 0, NULL, 0, ?, ?)`
      ).run(generateId(), email, passwordHash, fullName, config.defaultStorageQuotaBytes, now, now);
      console.log(`Created new Administrator account "${email}".`);
    }
  } finally {
    db.close();
  }
}

main();
