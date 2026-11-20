import { Request } from 'express';

export type UserRole = 'student' | 'admin';
export type AccountStatus = 'active' | 'deactivated' | 'suspended';

export interface SafeUser {
  id: string;
  email: string;
  email_verified: number;
  role: UserRole;
  status: AccountStatus;
  status_reason: string;
  full_name: string;
  university: string;
  major: string;
  academic_year: string;
  bio: string;
  avatar_file: string | null;
  theme_preference: 'system' | 'light' | 'dark';
  workspace_accent: string;
  storage_quota_bytes: number;
  is_demo: number;
  last_login_at: string | null;
  login_count: number;
  created_at: string;
  updated_at: string;
}

export interface AuthenticatedRequest extends Request {
  user?: SafeUser;
  sessionId?: string;
}
