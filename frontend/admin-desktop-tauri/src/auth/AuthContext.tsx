import { toast } from 'sonner';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { isDesktopRoleAllowed, me, type Me } from '../api/auth';
import { AUTH_EXPIRED_EVENT, TOKEN_STORAGE_WARNING_EVENT, getToken, getSessionVersion, clearSession } from '../api/client';

interface AuthState {
  user: Me | null;
  loading: boolean;
  setUser: (u: Me | null) => void;
  logoutLocal: () => Promise<void>;
}

const Ctx = createContext<AuthState>({ user: null, loading: true, setUser: () => {}, logoutLocal: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const version = getSessionVersion();
    const current = () => alive && version === getSessionVersion();
    (async () => {
      const token = await getToken();
      if (!current()) return;
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const u = await me();
        if (!current()) return;

        if (!isDesktopRoleAllowed(u)) {
          await clearSession();
          if (alive && getSessionVersion() === version + 1) setUser(null);
          return;
        }
        setUser(u);
      } catch {
        if (current()) setUser(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  useEffect(() => {
    const onWarning = (event: Event) => toast.warning((event as CustomEvent<string>).detail);
    window.addEventListener(TOKEN_STORAGE_WARNING_EVENT, onWarning);
    return () => window.removeEventListener(TOKEN_STORAGE_WARNING_EVENT, onWarning);
  }, []);

  async function logoutLocal() {
    const version = getSessionVersion() + 1;
    await clearSession();
    if (getSessionVersion() === version) setUser(null);
  }

  return (
    <Ctx.Provider value={{ user, loading, setUser, logoutLocal }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
