import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { isDesktopRoleAllowed, me, type Me } from '../api/auth';
import { AUTH_EXPIRED_EVENT, getToken, clearSession } from '../api/client';

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
        const u = await me();
        // Sesi lama milik peran portal (orang_tua/santri) tidak boleh dipakai.
        if (!isDesktopRoleAllowed(u)) {
          await clearSession();
          setUser(null);
          return;
        }
        setUser(u);
      } catch {
        await clearSession();
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 401 dari request mana pun (api/apiUpload/downloadFile) → keluar ke login.
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
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
