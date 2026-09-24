import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { prefGet, prefSet } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';

/** Tingkat aktif global (per perangkat): filter multi-pilih 1–12, setara
 *  filter lembaga/TA/semester. Nilai universal lintas lembaga/TA sehingga
 *  dipertahankan saat ganti lingkup; [] = semua tingkat. */
const KEY = 'simpes_tingkat_aktif';

interface TingkatAktifState {
  loading: boolean;
  tingkat: string[];
  pilih: (v: string[]) => void;
}

const Ctx = createContext<TingkatAktifState | null>(null);

export function TingkatAktifProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tingkat, setTingkat] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) {
        setTingkat([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const simpanan = await prefGet(KEY).catch(() => null);
        const arr = typeof simpanan === 'string' ? JSON.parse(simpanan) : null;
        if (!alive) return;
        setTingkat(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []);
      } catch {
        if (alive) setTingkat([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  const pilih = useMemo(() => (v: string[]) => {
    setTingkat(v);
    prefSet(KEY, JSON.stringify(v)).catch(() => {});
  }, []);

  const value = useMemo<TingkatAktifState>(() => ({
    loading,
    tingkat,
    pilih,
  }), [loading, tingkat, pilih]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTingkatAktif() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTingkatAktif di luar TingkatAktifProvider');
  return ctx;
}
