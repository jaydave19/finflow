import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client.ts';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  currency: string;
  theme: string;
  notificationPrefs?: {
    email?: boolean;
    inApp?: boolean;
    daysBefore?: number;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updatedUser: Partial<User>) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(api.getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshProfile = useCallback(async () => {
    try {
      const data = await api.get('/user/profile');
      setUser(data);
    } catch {
      // If token expired and cannot refresh, clear user
      setUser(null);
      setToken(null);
      api.setToken(null);
    }
  }, []);

  useEffect(() => {
    async function initAuth() {
      if (api.getToken()) {
        await refreshProfile();
      }
      setIsLoading(false);
    }
    initAuth();
  }, [refreshProfile]);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    api.setToken(res.accessToken);
    setToken(res.accessToken);
    setUser(res.user);
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await api.post('/auth/register', { name, email, password });
    api.setToken(res.accessToken);
    setToken(res.accessToken);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    } finally {
      api.setToken(null);
      setToken(null);
      setUser(null);
    }
  };

  const updateUser = (updatedUser: Partial<User>) => {
    setUser(prev => (prev ? { ...prev, ...updatedUser } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        updateUser,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
