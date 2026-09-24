import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { prefGet, prefSet } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useLembagaAktif } from '@/lembagaAktif';
import { useTahunAjaranAktif } from '@/tahunAjaranAktif';

/** Kelas aktif global (per perangkat): filter multi-pilih NAMA kelas, setara
 *  filter lembaga/TA/semester. Nama kelas bermakna dalam lingkup lembaga+TA,
 *  sehingga pilihan dikosongkan otomatis saat lingkup berganti; [] = semua. */
const KEY = 'simpes_kelas_aktif';

interface KelasAktifState {
  loading: boolean;
  kelas: string[];
  pilih: (v: string[]) => void;
}

const Ctx = createContext<KelasAktifState | null>(null);

export function KelasAktifProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { jenjang } = useLembagaAktif();
  const { tahunAjaranNama } = useTahunAjaranAktif();
  const [kelas, setKelas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) {
        setKelas([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const simpanan = await prefGet(KEY).catch(() => null);
        const arr = typeof simpanan === 'string' ? JSON.parse(simpanan) : null;
        if (!alive) return;
        setKelas(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []);
      } catch {
        if (alive) setKelas([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  const pilih = useMemo(() => (v: string[]) => {
    setKelas(v);
    prefSet(KEY, JSON.stringify(v)).catch(() => {});
  }, []);

  // Nama kelas usang bila lingkup berganti → kosongkan (kecuali pemuatan awal).
  const lingkup = `${jenjang ?? '∅'}:${tahunAjaranNama ?? '∅'}`;
  const lingkupAwal = useRef<string | null>(null);
  useEffect(() => {
    if (lingkupAwal.current === null) {
      lingkupAwal.current = lingkup;
      return;
    }
    if (lingkupAwal.current !== lingkup) {
      lingkupAwal.current = lingkup;
      setKelas([]);
      prefSet(KEY, '[]').catch(() => {});
    }
  }, [lingkup]);

  const value = useMemo<KelasAktifState>(() => ({
    loading,
    kelas,
    pilih,
  }), [loading, kelas, pilih]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useKelasAktif() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useKelasAktif di luar KelasAktifProvider');
  return ctx;
}
