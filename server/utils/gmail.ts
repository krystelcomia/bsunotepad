export function normalizeGmail(raw: string): string {
  return String(raw || '').trim().toLowerCase();
}

export function isValidGmailAddress(raw: string): boolean {
  const email = normalizeGmail(raw);
  if (!email || email.length > 120) return false;
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (domain !== 'gmail.com') return false;
  if (!local || local.length < 3 || local.length > 64) return false;
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  return /^[a-z0-9._+-]+$/.test(local);
}

export function validatePasswordStrength(password: string): string | null {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must contain at least one letter and one number.';
  }
  return null;
}
