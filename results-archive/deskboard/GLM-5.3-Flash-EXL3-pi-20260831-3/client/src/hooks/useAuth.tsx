import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthResponse, User } from '@deskboard/shared';
import { api, setAuthToken } from '../api/client.js';

const STORAGE_KEY = 'deskboard.session';

interface StoredSession {
  token: string;
  user: User;
}

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed.token && parsed.user ? parsed : null;
  } catch {
    return null;
  }
}

/** Session state: token in localStorage, attached to every API call. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => readStoredSession()?.user ?? null);

  useEffect(() => {
    setAuthToken(readStoredSession()?.token ?? null);
  }, []);

  const establish = useCallback((auth: AuthResponse) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: auth.token, user: auth.user }));
    setAuthToken(auth.token);
    setUser(auth.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      establish(await api.post<AuthResponse>('/auth/login', { email, password }));
    },
    [establish],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      establish(await api.post<AuthResponse>('/auth/register', { name, email, password }));
    },
    [establish],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAuthToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, register, logout }), [user, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
