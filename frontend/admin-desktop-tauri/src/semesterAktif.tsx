import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { prefGet, prefSet } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';

/** Semester aktif (per perangkat): filter global halaman bertabel ganjil/genap.
 *  Autoselect dari tanggal berjalan (Jul–Des = ganjil, Jan–Jun = genap);
 *  null = "Semua semester". */
const KEY = 'simpes_semester_aktif';

export type SemesterAktif = '1' | '2';

interface SemesterAktifState {
  loading: boolean;
  semester: SemesterAktif | null;
  pilih: (s: SemesterAktif | null) => void;
}

/** Semester berjalan dari tanggal hari ini (kalender pendidikan umum). */
export function semesterBerjalan(d = new Date()): SemesterAktif {
  return d.getMonth() < 6 ? '2' : '1';
}

const Ctx = createContext<SemesterAktifState | null>(null);

export function SemesterAktifProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [semester, setSemester] = useState<SemesterAktif | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) {
        setSemester(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const simpanan = await prefGet(KEY).catch(() => null);
      let s: SemesterAktif | null;
      if (simpanan === '0') s = null;
      else if (simpanan === '1' || simpanan === '2') s = simpanan;
      else s = semesterBerjalan();
      if (!alive) return;
      setSemester(s);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user?.id]);

  const pilih = useMemo(() => (s: SemesterAktif | null) => {
    setSemester(s);
    prefSet(KEY, s == null ? '0' : s).catch(() => {});
  }, []);

  const value = useMemo<SemesterAktifState>(() => ({
    loading,
    semester,
    pilih,
  }), [loading, semester, pilih]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSemesterAktif() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSemesterAktif di luar SemesterAktifProvider');
  return ctx;
}
