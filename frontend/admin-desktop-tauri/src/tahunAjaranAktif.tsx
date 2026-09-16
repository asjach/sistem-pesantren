import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { prefGet, prefSet } from '@/api/client';
import { listTahunAjaran, type TahunAjaran } from '@/api/master';
import { useLembagaAktif } from '@/lembagaAktif';
import { useAuth } from '@/auth/AuthContext';

/** Tahun ajaran aktif (per perangkat): default filter tahun ajaran halaman.
 *  Daftarnya mengikuti lembaga aktif; nilainya dipakai halaman sebagai
 *  filter tetap (tanpa dropdown di bar filter halaman). */
const KEY = 'simpes_tahun_ajaran_aktif';

interface TahunAjaranAktifState {
  loading: boolean;
  tahunAjaranId: number | null;
  tahunAjaran: TahunAjaran | null;
  pilihan: TahunAjaran[];
  pilih: (id: number | null) => void;
}

const Ctx = createContext<TahunAjaranAktifState | null>(null);

/** Bawaan: TA aktif (global atau milik lembaga); jika tak ada → tanggal_mulai
 *  terbaru. Tanpa lembaga tunggal (mode "Semua lembaga") → "Semua tahun". */
function bawaan(daftar: TahunAjaran[], lembagaId: number | null): number | null {
  if (lembagaId == null) return null;
  const milik = daftar.filter((t) => t.lembaga_id === null || t.lembaga_id === lembagaId);
  const aktif = milik.find((t) => t.is_aktif);
  if (aktif) return aktif.id;
  const urut = [...milik].sort((a, b) =>
    (b.tanggal_mulai ?? '').localeCompare(a.tanggal_mulai ?? ''));
  return urut[0]?.id ?? null;
}

export function TahunAjaranAktifProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { lembagaId } = useLembagaAktif();
  const [pilihan, setPilihan] = useState<TahunAjaran[]>([]);
  const [tahunAjaranId, setTahunAjaranId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!user) {
        setPilihan([]);
        setTahunAjaranId(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      let daftar: TahunAjaran[] = [];
      try {
        const p = await listTahunAjaran({ lembaga_id: lembagaId ?? undefined, per_page: 1000 });
        daftar = p.data;
      } catch {
        daftar = [];
      }
      if (!alive) return;
      setPilihan(daftar);

      const simpanan = await prefGet(KEY).catch(() => null);
      let id: number | null;
      if (simpanan === '0') id = null;
      else if (simpanan && daftar.some((d) => String(d.id) === simpanan)) id = Number(simpanan);
      else id = bawaan(daftar, lembagaId);
      if (!alive) return;
      setTahunAjaranId(id);
      setLoading(false);
    })();

    return () => { alive = false; };
  }, [user, lembagaId]);

  const pilih = useMemo(() => (id: number | null) => {
    setTahunAjaranId(id);
    prefSet(KEY, id == null ? '0' : String(id)).catch(() => {});
  }, []);

  const value = useMemo<TahunAjaranAktifState>(() => ({
    loading,
    tahunAjaranId,
    tahunAjaran: pilihan.find((p) => p.id === tahunAjaranId) ?? null,
    pilihan,
    pilih,
  }), [loading, tahunAjaranId, pilihan, pilih]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTahunAjaranAktif() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTahunAjaranAktif di luar TahunAjaranAktifProvider');
  return ctx;
}
