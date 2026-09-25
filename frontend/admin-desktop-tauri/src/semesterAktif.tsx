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
  semesters: string[];
  semester: SemesterAktif | null;
  pilih: (s: SemesterAktif | null) => void;
  pilihBanyak: (s: string[]) => void;
}

/** Semester berjalan dari tanggal hari ini (kalender pendidikan umum). */
export function semesterBerjalan(d = new Date()): SemesterAktif {
  return d.getMonth() < 6 ? '2' : '1';
}

function normalisasiSemester(values: readonly string[]): SemesterAktif[] {
  return [...new Set(values.filter((value): value is SemesterAktif => value === '1' || value === '2'))];
}

function bacaSemester(simpanan: string | null): string[] {
  if (!simpanan || simpanan === '0') return [];
  try {
    const parsed: unknown = JSON.parse(simpanan);
    if (parsed === null) return [];
    if (Array.isArray(parsed)) {
      return parsed.filter((value): value is string => typeof value === 'string');
    }
    if (typeof parsed === 'string' && parsed !== '0') return [parsed];
  } catch {
    return [simpanan];
  }
  return [simpanan];
}

function simpanSemester(values: readonly string[]): string {
  return JSON.stringify(normalisasiSemester(values));
}

const Ctx = createContext<SemesterAktifState | null>(null);

export function SemesterAktifProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [semesters, setSemesters] = useState<SemesterAktif[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) {
        setSemesters([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const simpanan = await prefGet(KEY).catch(() => null);
      const valid = normalisasiSemester(bacaSemester(simpanan));
      const bawaan = [semesterBerjalan()];
      const s = simpanan === '0' || simpanan === '[]'
        ? []
        : valid.length > 0 ? valid : bawaan;
      if (!alive) return;
      setSemesters(s);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user?.id]);

  const pilihBanyak = useMemo(() => (values: string[]) => {
    const next = normalisasiSemester(values);
    setSemesters(next);
    prefSet(KEY, simpanSemester(next)).catch(() => {});
  }, []);

  const pilih = useMemo(() => (s: SemesterAktif | null) => {
    const next = s == null ? [] : [s];
    setSemesters(next);
    prefSet(KEY, next[0] ?? '0').catch(() => {});
  }, []);

  const value = useMemo<SemesterAktifState>(() => ({
    loading,
    semesters,
    semester: semesters[0] ?? null,
    pilih,
    pilihBanyak,
  }), [loading, semesters, pilih, pilihBanyak]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSemesterAktif() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSemesterAktif di luar SemesterAktifProvider');
  return ctx;
}
