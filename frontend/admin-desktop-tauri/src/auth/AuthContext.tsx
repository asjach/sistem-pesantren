import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { me, type Me } from '../api/auth';
import { getToken, clearSession } from '../api/client';

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
    (async () => {
      if (!await getToken()) {
        setLoading(false);
        return;
      }
      try {
        setUser(await me());
      } catch {
        await clearSession();
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function logoutLocal() {
    await clearSession();
    setUser(null);
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
