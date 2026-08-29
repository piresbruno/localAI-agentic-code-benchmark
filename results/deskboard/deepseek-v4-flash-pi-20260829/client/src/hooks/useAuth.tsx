import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { PublicUser } from 'shared';
import { authApi } from '../api/endpoints';
import { getToken, setToken } from '../api/client';

interface AuthContextValue {
  user: PublicUser | null;
  /** True while a stored token is being re-validated on boot. */
  booting: boolean;
  login: (token: string, user: PublicUser) => void;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setBooting(false);
      return;
    }
    authApi
      .me()
      .then((me) => setUser(me))
      .catch(() => setToken(null))
      .finally(() => setBooting(false));
  }, []);

  const login = useCallback((token: string, nextUser: PublicUser) => {
    setToken(token);
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const me = await authApi.me();
    setUser(me);
  }, []);

  const value = useMemo(() => ({ user, booting, login, logout, refresh }), [user, booting, login, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
