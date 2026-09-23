import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { prefGet, prefSet } from '@/api/client';
import { listTahunAjaran, type TahunAjaran } from '@/api/master';
import { useLembagaAktif } from '@/lembagaAktif';
import { useAuth } from '@/auth/AuthContext';

/** Tahun ajaran aktif (per perangkat): default filter tahun ajaran halaman.
 *  Daftarnya mengikuti lembaga aktif; nilainya dipakai halaman sebagai
 *  filter tetap (tanpa dropdown di bar filter halaman).
 *  Nilai = nama TA (kunci alami), mis. '2026/2027'. */
const KEY = 'simpes_tahun_ajaran_aktif';

interface TahunAjaranAktifState {
  loading: boolean;
  tahunAjaranNama: string | null;
  tahunAjaran: TahunAjaran | null;
  pilihan: TahunAjaran[];
  pilih: (nama: string | null) => void;
}

const Ctx = createContext<TahunAjaranAktifState | null>(null);

/** Bawaan: TA aktif; jika tak ada → tanggal_mulai terbaru, lalu nama terbesar.
 *  Tanpa lembaga tunggal (mode "Semua lembaga") → "Semua tahun". */
function bawaan(daftar: TahunAjaran[], jenjang: string | null): string | null {
  if (jenjang == null) return null;
  const aktif = daftar.find((t) => t.is_aktif);
  if (aktif) return aktif.nama;
  const urut = [...daftar].sort((a, b) =>
    (b.tanggal_mulai ?? '').localeCompare(a.tanggal_mulai ?? '') || b.nama.localeCompare(a.nama));
  return urut[0]?.nama ?? null;
}

export function TahunAjaranAktifProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { jenjang, loading: lembagaLoading } = useLembagaAktif();
  const [pilihan, setPilihan] = useState<TahunAjaran[]>([]);
  const [tahunAjaranNama, setTahunAjaranNama] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!user) {
        setPilihan([]);
        setTahunAjaranNama(null);
        setLoading(false);
        return;
      }
      // Tunggu lembaga aktif selesai dimuat agar tak memuat dua kali
      // (untuk "Semua" lalu untuk jenjang terpilih).
      if (lembagaLoading) return;

      setLoading(true);
      let daftar: TahunAjaran[] = [];
      try {
        const p = await listTahunAjaran({ jenjang: jenjang ?? undefined, per_page: 1000 });
        daftar = p.data;
      } catch {
        daftar = [];
      }
      if (!alive) return;
      setPilihan(daftar);

      const simpanan = await prefGet(KEY).catch(() => null);
      let nama: string | null;
      if (simpanan === '0') nama = null;
      else if (simpanan && daftar.some((d) => d.nama === simpanan)) nama = simpanan;
      else nama = bawaan(daftar, jenjang);
      if (!alive) return;
      setTahunAjaranNama(nama);
      setLoading(false);
    })();

    return () => { alive = false; };
  }, [user?.id, jenjang, lembagaLoading]);

  const pilih = useMemo(() => (nama: string | null) => {
    setTahunAjaranNama(nama);
    prefSet(KEY, nama == null ? '0' : nama).catch(() => {});
  }, []);

  const value = useMemo<TahunAjaranAktifState>(() => ({
    loading,
    tahunAjaranNama,
    tahunAjaran: pilihan.find((p) => p.nama === tahunAjaranNama) ?? null,
    pilihan,
    pilih,
  }), [loading, tahunAjaranNama, pilihan, pilih]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTahunAjaranAktif() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTahunAjaranAktif di luar TahunAjaranAktifProvider');
  return ctx;
}
