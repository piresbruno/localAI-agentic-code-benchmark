/**
 * Auth session state: token + current user, persisted to localStorage,
 * validated against /auth/me on mount.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { PublicUser } from 'deskboard-shared';
import { api, clearToken, readToken, storeToken } from '../api/client.js';

interface AuthContextValue {
  user: PublicUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = 'deskboard_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as PublicUser) : null;
    } catch {
      return null;
    }
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const token = readToken();
    if (!token) {
      setReady(true);
      return;
    }
    api
      .me()
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        localStorage.setItem(USER_KEY, JSON.stringify(me));
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        clearToken();
        localStorage.removeItem(USER_KEY);
        setUser(null);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login({ email, password });
    storeToken(res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    setUser(res.user);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await api.register({ name, email, password });
    storeToken(res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
