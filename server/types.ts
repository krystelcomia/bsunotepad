import { Request } from 'express';

export interface SafeUser {
  id: string;
  email: string;
  full_name: string;
  university: string;
  major: string;
  academic_year: string;
  bio: string;
  avatar_file: string | null;
  theme_preference: 'system' | 'light' | 'dark';
  storage_quota_bytes: number;
  is_demo: number;
  created_at: string;
  updated_at: string;
}

export interface AuthenticatedRequest extends Request {
  user?: SafeUser;
  sessionId?: string;
}
