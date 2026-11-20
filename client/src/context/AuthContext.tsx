import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';
import { User } from '../types';
import { useTheme } from './ThemeContext';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  storageUsedBytes: number;
  setStorageUsedBytes: React.Dispatch<React.SetStateAction<number>>;
  refreshUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    email: string;
    password: string;
    full_name: string;
    university?: string;
    major?: string;
    academic_year?: string;
  }) => Promise<void>;
  demoLogin: () => Promise<void>;
  demoAdminLogin: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [storageUsedBytes, setStorageUsedBytes] = useState(0);
  const [loading, setLoading] = useState(true);
  const { setMode } = useTheme();

  const refreshUser = useCallback(async () => {
    try {
      const data = await api.me();
      setUser(data.user);
      setStorageUsedBytes(data.storageUsedBytes);
      if (data.user.theme_preference) {
        setMode(data.user.theme_preference);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [setMode]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    setUser(res.user);
    if (res.user.theme_preference) setMode(res.user.theme_preference);
    await refreshUser();
  };

  const register = async (payload: {
    email: string;
    password: string;
    full_name: string;
    university?: string;
    major?: string;
    academic_year?: string;
  }) => {
    const res = await api.register(payload);
    setUser(res.user);
    await refreshUser();
  };

  const demoLogin = async () => {
    const res = await api.demoLogin();
    setUser(res.user);
    if (res.user.theme_preference) setMode(res.user.theme_preference);
    await refreshUser();
  };

  const demoAdminLogin = async () => {
    const res = await api.demoAdminLogin();
    setUser(res.user);
    if (res.user.theme_preference) setMode(res.user.theme_preference);
    await refreshUser();
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setStorageUsedBytes(0);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        storageUsedBytes,
        setStorageUsedBytes,
        refreshUser,
        login,
        register,
        demoLogin,
        demoAdminLogin,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
